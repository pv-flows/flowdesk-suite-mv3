-- =============================================================================
-- FLOWDESK SUITE v6.0 (Step 1 / v5.2.7) — SUPABASE POSTGRESQL SCHEMA
-- Autenticação Google & Microsoft OAuth 2.0 + Sincronização de Dados por Conta
-- =============================================================================
-- INSTRUÇÕES:
-- 1. Acesse o painel do seu projeto no Supabase (https://supabase.com/dashboard)
-- 2. Abra o menu "SQL Editor" -> "New query"
-- 3. Cole todo este script e clique em "Run"
-- =============================================================================

-- 1. TABELA DE PERFIS DE USUÁRIO (Vinculada a auth.users do Google / Microsoft)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL DEFAULT 'Operador',
    avatar_url TEXT,
    provider TEXT DEFAULT 'google', -- 'google' | 'azure' (Microsoft)
    team_name TEXT DEFAULT 'Geral',
    email_domain TEXT GENERATED ALWAYS AS (split_part(email, '@', 2)) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. TABELA DE ESTADO SINCRONIZADO (Offline-First JSONB por domínio funcional)
CREATE TABLE IF NOT EXISTS public.user_sync_state (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    notes_data JSONB NOT NULL DEFAULT '{"activeTabId": 1, "tabs": [{"id": 1, "title": "Guia 1", "content": "", "history": []}]}'::jsonb,
    agenda_data JSONB NOT NULL DEFAULT '{"items": []}'::jsonb,
    macros_data JSONB NOT NULL DEFAULT '[]'::jsonb,
    settings_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    notes_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    agenda_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    macros_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    settings_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. TABELA DE HISTÓRICO DE PROPOSTAS E NEGOCIAÇÕES
CREATE TABLE IF NOT EXISTS public.proposals_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    operator_name TEXT NOT NULL,
    team_name TEXT NOT NULL DEFAULT 'Geral',
    customer_ref TEXT, -- Matrícula, CPF, CNPJ, Protocolo ou ID do Cliente
    total_amount TEXT NOT NULL,
    proposal_payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para consultas rápidas de histórico por usuário e identificador
CREATE INDEX IF NOT EXISTS idx_proposals_log_user_created
    ON public.proposals_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_proposals_log_customer_ref
    ON public.proposals_log (user_id, customer_ref);

-- =============================================================================
-- 4. ROW-LEVEL SECURITY (RLS) — Isolamento total por conta autenticada
-- =============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals_log ENABLE ROW LEVEL SECURITY;

-- Políticas para public.profiles
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Políticas para public.user_sync_state
DROP POLICY IF EXISTS "sync_state_all_own" ON public.user_sync_state;
CREATE POLICY "sync_state_all_own" ON public.user_sync_state
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Políticas para public.proposals_log
DROP POLICY IF EXISTS "proposals_log_all_own" ON public.proposals_log;
CREATE POLICY "proposals_log_all_own" ON public.proposals_log
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- 5. TRIGGER AUTOMÁTICO NO PRIMEIRO LOGIN GOOGLE / MICROSOFT
-- Cria automaticamente a linha em public.profiles e public.user_sync_state
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_oauth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_full_name TEXT;
    v_avatar_url TEXT;
    v_provider TEXT;
BEGIN
    v_full_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        split_part(NEW.email, '@', 1),
        'Operador'
    );
    v_avatar_url := COALESCE(
        NEW.raw_user_meta_data->>'avatar_url',
        NEW.raw_user_meta_data->>'picture',
        NULL
    );
    v_provider := COALESCE(
        NEW.raw_app_meta_data->>'provider',
        'google'
    );

    INSERT INTO public.profiles (id, email, full_name, avatar_url, provider, updated_at)
    VALUES (NEW.id, NEW.email, v_full_name, v_avatar_url, v_provider, now())
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(NULLIF(public.profiles.full_name, 'Operador'), EXCLUDED.full_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
        provider = EXCLUDED.provider,
        updated_at = now();

    INSERT INTO public.user_sync_state (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_oauth_user();
