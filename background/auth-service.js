// FlowDesk MV3 — background/auth-service.js
// Etapa 1 (v5.2.7) — Autenticação OAuth 2.0 (Google & Microsoft) com PKCE + Sessão JWT

const AUTH_STORAGE_KEYS = {
    SUPABASE_URL: 'fd_supabase_url',
    SUPABASE_ANON_KEY: 'fd_supabase_anon_key',
    SESSION: 'fd_auth_session',
    PKCE_VERIFIER: 'fd_pkce_verifier'
};

/**
 * Codifica ArrayBuffer em Base64URL (RFC 7636 para PKCE)
 * @param {ArrayBuffer|Uint8Array} buffer
 * @returns {string}
 */
function base64UrlEncode(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

/**
 * Gera par PKCE (code_verifier e code_challenge S256)
 * @returns {Promise<{ verifier: string, challenge: string }>}
 */
async function createPKCEPair() {
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    const verifier = base64UrlEncode(randomBytes);
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    const challenge = base64UrlEncode(digest);
    return { verifier, challenge };
}

const AuthService = {
    /**
     * Retorna a URL de redirecionamento OAuth oficial da extensão Chromium.
     * Exemplo: https://<extension-id>.chromiumapp.org/oauth2
     * @returns {string}
     */
    getRedirectUri() {
        return chrome.identity.getRedirectURL('oauth2');
    },

    /**
     * Obtém as credenciais configuradas do projeto Supabase.
     * @returns {Promise<{ url: string, anonKey: string, isConfigured: boolean }>}
     */
    async getCloudConfig() {
        const data = await chrome.storage.local.get([
            AUTH_STORAGE_KEYS.SUPABASE_URL,
            AUTH_STORAGE_KEYS.SUPABASE_ANON_KEY
        ]);
        const url = (data[AUTH_STORAGE_KEYS.SUPABASE_URL] || '').trim().replace(/\/+$/, '');
        const anonKey = (data[AUTH_STORAGE_KEYS.SUPABASE_ANON_KEY] || '').trim();
        return {
            url,
            anonKey,
            isConfigured: Boolean(url && anonKey && url.startsWith('https://'))
        };
    },

    /**
     * Testa a conectividade com o Supabase e verifica provedores habilitados (Google / Microsoft).
     * @param {string} rawUrl
     * @param {string} rawAnonKey
     */
    async testConnection(rawUrl, rawAnonKey) {
        const url = (rawUrl || '').trim().replace(/\/+$/, '');
        const anonKey = (rawAnonKey || '').trim();

        if (!url.startsWith('https://') || !anonKey) {
            return { ok: false, error: 'Informe a Project URL (https://...) e a Anon Key do Supabase.' };
        }

        try {
            const res = await fetch(`${url}/auth/v1/settings`, {
                method: 'GET',
                headers: {
                    'apikey': anonKey,
                    'Authorization': `Bearer ${anonKey}`
                }
            });

            if (!res.ok) {
                return { ok: false, error: `Falha ao autenticar no Supabase (HTTP ${res.status}). Verifique a Anon Key.` };
            }

            const settings = await res.json();
            const external = settings?.external || {};
            return {
                ok: true,
                providers: {
                    google: Boolean(external.google),
                    microsoft: Boolean(external.azure)
                }
            };
        } catch (err) {
            return { ok: false, error: `Erro de rede ao conectar ao Supabase: ${err.message}` };
        }
    },

    /**
     * Inicia o fluxo OAuth 2.0 (Google ou Microsoft/Azure) via chrome.identity.launchWebAuthFlow.
     * @param {'google'|'azure'} provider
     */
    async signInWithOAuth(provider = 'google') {
        const normalizedProvider = provider === 'microsoft' ? 'azure' : provider;
        const config = await this.getCloudConfig();

        if (!config.isConfigured) {
            return {
                ok: false,
                error: 'Banco de dados ainda não configurado. Acesse Configurações > Segurança e informe a URL e Anon Key do Supabase.'
            };
        }

        const redirectUri = this.getRedirectUri();
        const { verifier, challenge } = await createPKCEPair();
        await chrome.storage.local.set({ [AUTH_STORAGE_KEYS.PKCE_VERIFIER]: verifier });

        const authParams = new URLSearchParams({
            provider: normalizedProvider,
            redirect_to: redirectUri,
            code_challenge: challenge,
            code_challenge_method: 'S256'
        });

        if (normalizedProvider === 'azure') {
            authParams.set('scopes', 'email profile openid offline_access');
        } else if (normalizedProvider === 'google') {
            authParams.set('access_type', 'offline');
            authParams.set('prompt', 'select_account');
        }

        const authUrl = `${config.url}/auth/v1/authorize?${authParams.toString()}`;

        try {
            const responseUrl = await new Promise((resolve, reject) => {
                chrome.identity.launchWebAuthFlow(
                    { url: authUrl, interactive: true },
                    (callbackUrl) => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                            return;
                        }
                        if (!callbackUrl) {
                            reject(new Error('Fluxo de autenticação cancelado.'));
                            return;
                        }
                        resolve(callbackUrl);
                    }
                );
            });

            const parsedUrl = new URL(responseUrl);
            const urlParams = parsedUrl.searchParams;
            const hashParams = new URLSearchParams(parsedUrl.hash.replace(/^#/, ''));

            const errorMsg = urlParams.get('error_description') || hashParams.get('error_description') || urlParams.get('error');
            if (errorMsg) {
                return { ok: false, error: decodeURIComponent(errorMsg) };
            }

            let sessionData = null;
            const authCode = urlParams.get('code');

            if (authCode) {
                // Troca código PKCE por sessão JWT
                const tokenRes = await fetch(`${config.url}/auth/v1/token?grant_type=pkce`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': config.anonKey
                    },
                    body: JSON.stringify({
                        auth_code: authCode,
                        code_verifier: verifier
                    })
                });

                const tokenJson = await tokenRes.json();
                if (!tokenRes.ok) {
                    return {
                        ok: false,
                        error: tokenJson?.error_description || tokenJson?.msg || 'Falha ao validar código OAuth PKCE.'
                    };
                }
                sessionData = tokenJson;
            } else if (hashParams.get('access_token')) {
                // Fallback para fluxo implícito caso retornado no hash
                const accessToken = hashParams.get('access_token');
                const refreshToken = hashParams.get('refresh_token');
                const expiresIn = parseInt(hashParams.get('expires_in') || '3600', 10);

                const userRes = await fetch(`${config.url}/auth/v1/user`, {
                    headers: {
                        'apikey': config.anonKey,
                        'Authorization': `Bearer ${accessToken}`
                    }
                });
                const userObj = userRes.ok ? await userRes.json() : null;
                sessionData = {
                    access_token: accessToken,
                    refresh_token: refreshToken,
                    expires_in: expiresIn,
                    expires_at: Math.floor(Date.now() / 1000) + expiresIn,
                    user: userObj
                };
            } else {
                return { ok: false, error: 'Nenhum código ou token retornado pelo provedor OAuth.' };
            }

            const savedProfile = await this._persistSessionAndProfile(sessionData, normalizedProvider);
            return { ok: true, profile: savedProfile };
        } catch (err) {
            return { ok: false, error: err.message || 'Erro durante login OAuth.' };
        } finally {
            await chrome.storage.local.remove(AUTH_STORAGE_KEYS.PKCE_VERIFIER);
        }
    },

    /**
     * Salva a sessão JWT localmente, sincroniza com a tabela public.profiles e atualiza
     * as chaves legadas (user_nome, user_equipe) para compatibilidade com todos os módulos.
     */
    async _persistSessionAndProfile(sessionData, fallbackProvider = 'google') {
        const config = await this.getCloudConfig();
        const user = sessionData.user || {};
        const meta = user.user_metadata || {};
        const appMeta = user.app_metadata || {};

        const expiresAt = sessionData.expires_at
            ? sessionData.expires_at * 1000
            : Date.now() + (sessionData.expires_in || 3600) * 1000;

        const fullName = meta.full_name || meta.name || (user.email ? user.email.split('@')[0] : 'Operador');
        const avatarUrl = meta.avatar_url || meta.picture || '';
        const provider = appMeta.provider || fallbackProvider;

        // Preservar equipe atual se já configurada localmente
        const localData = await chrome.storage.local.get('user_equipe');
        let currentTeam = 'Geral';
        if (localData.user_equipe) {
            try {
                currentTeam = typeof localData.user_equipe === 'string'
                    ? JSON.parse(localData.user_equipe)
                    : localData.user_equipe;
            } catch (_) {
                currentTeam = localData.user_equipe;
            }
        }

        // Consultar/atualizar public.profiles no Supabase
        let remoteProfile = null;
        if (config.isConfigured && sessionData.access_token && user.id) {
            try {
                const profRes = await fetch(`${config.url}/rest/v1/profiles?id=eq.${user.id}&select=*`, {
                    headers: {
                        'apikey': config.anonKey,
                        'Authorization': `Bearer ${sessionData.access_token}`
                    }
                });
                if (profRes.ok) {
                    const rows = await profRes.json();
                    if (Array.isArray(rows) && rows.length > 0) {
                        remoteProfile = rows[0];
                        if (remoteProfile.team_name && remoteProfile.team_name !== 'Geral') {
                            currentTeam = remoteProfile.team_name;
                        }
                    }
                }

                // Upsert garantindo perfil atualizado
                await fetch(`${config.url}/rest/v1/profiles`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': config.anonKey,
                        'Authorization': `Bearer ${sessionData.access_token}`,
                        'Prefer': 'resolution=merge-duplicates,return=representation'
                    },
                    body: JSON.stringify({
                        id: user.id,
                        email: user.email,
                        full_name: remoteProfile?.full_name || fullName,
                        avatar_url: avatarUrl || remoteProfile?.avatar_url || null,
                        provider: provider,
                        team_name: currentTeam,
                        updated_at: new Date().toISOString()
                    })
                });
            } catch (err) {
                console.warn('[FlowDesk Auth] Aviso ao sincronizar tabela profiles:', err.message);
            }
        }

        const profileSummary = {
            id: user.id,
            email: user.email || '',
            nome: remoteProfile?.full_name || fullName,
            equipe: currentTeam || 'Geral',
            avatarUrl: avatarUrl || remoteProfile?.avatar_url || '',
            provider: provider === 'azure' ? 'microsoft' : provider,
            loggedAt: new Date().toISOString()
        };

        await chrome.storage.local.set({
            [AUTH_STORAGE_KEYS.SESSION]: {
                access_token: sessionData.access_token,
                refresh_token: sessionData.refresh_token,
                expires_at: expiresAt,
                user: profileSummary
            },
            // Chaves serializadas em JSON para compatibilidade 100% com SafeStorage e popup.js
            user_nome: JSON.stringify(profileSummary.nome),
            user_equipe: JSON.stringify(profileSummary.equipe),
            user_email: JSON.stringify(profileSummary.email),
            user_avatar: JSON.stringify(profileSummary.avatarUrl),
            user_provider: JSON.stringify(profileSummary.provider)
        });

        return profileSummary;
    },

    /**
     * Retorna uma sessão válida, renovando o JWT via refresh_token se faltar menos de 5 min para expirar.
     */
    async getValidSession() {
        const data = await chrome.storage.local.get(AUTH_STORAGE_KEYS.SESSION);
        const session = data[AUTH_STORAGE_KEYS.SESSION];
        if (!session || !session.access_token) return null;

        const fiveMinutes = 5 * 60 * 1000;
        if (session.expires_at && Date.now() + fiveMinutes < session.expires_at) {
            return session;
        }

        if (!session.refresh_token) return session;
        return await this.refreshSession(session.refresh_token);
    },

    /**
     * Renova o access_token usando o refresh_token do Supabase Auth.
     * @param {string} [refreshToken]
     */
    async refreshSession(refreshToken) {
        const config = await this.getCloudConfig();
        if (!config.isConfigured) return null;

        let tokenToUse = refreshToken;
        if (!tokenToUse) {
            const data = await chrome.storage.local.get(AUTH_STORAGE_KEYS.SESSION);
            tokenToUse = data[AUTH_STORAGE_KEYS.SESSION]?.refresh_token;
        }
        if (!tokenToUse) return null;

        try {
            const res = await fetch(`${config.url}/auth/v1/token?grant_type=refresh_token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': config.anonKey
                },
                body: JSON.stringify({ refresh_token: tokenToUse })
            });

            if (!res.ok) {
                console.warn('[FlowDesk Auth] Refresh token expirado ou inválido:', res.status);
                return null;
            }

            const newSession = await res.json();
            await this._persistSessionAndProfile(newSession);
            const updated = await chrome.storage.local.get(AUTH_STORAGE_KEYS.SESSION);
            return updated[AUTH_STORAGE_KEYS.SESSION] || null;
        } catch (err) {
            console.warn('[FlowDesk Auth] Erro de rede ao renovar token:', err.message);
            return null;
        }
    },

    /**
     * Atualiza o nome/equipe no perfil local e na tabela public.profiles do Supabase (se autenticado).
     */
    async updateProfileIdentity(nome, equipe) {
        const cleanNome = (nome || '').trim();
        const cleanEquipe = (equipe || 'Geral').trim();

        await chrome.storage.local.set({
            user_nome: JSON.stringify(cleanNome),
            user_equipe: JSON.stringify(cleanEquipe)
        });

        const session = await this.getValidSession();
        const config = await this.getCloudConfig();

        if (session?.access_token && session?.user?.id && config.isConfigured) {
            session.user.nome = cleanNome;
            session.user.equipe = cleanEquipe;
            await chrome.storage.local.set({ [AUTH_STORAGE_KEYS.SESSION]: session });

            try {
                await fetch(`${config.url}/rest/v1/profiles?id=eq.${session.user.id}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': config.anonKey,
                        'Authorization': `Bearer ${session.access_token}`
                    },
                    body: JSON.stringify({
                        full_name: cleanNome,
                        team_name: cleanEquipe,
                        updated_at: new Date().toISOString()
                    })
                });
            } catch (err) {
                console.warn('[FlowDesk Auth] Falha ao atualizar perfil remoto:', err.message);
            }
        }

        return { ok: true };
    },

    /**
     * Retorna o status completo de autenticação e configuração da nuvem para Popup/Options/Content.
     */
    async getStatus() {
        const config = await this.getCloudConfig();
        const session = await this.getValidSession();
        return {
            ok: true,
            redirectUri: this.getRedirectUri(),
            cloudConfigured: config.isConfigured,
            supabaseUrl: config.url,
            authenticated: Boolean(session?.access_token),
            user: session?.user || null
        };
    },

    /**
     * Desconecta a sessão OAuth atual sem apagar as notas/dados locais do operador.
     */
    async signOut() {
        const config = await this.getCloudConfig();
        const data = await chrome.storage.local.get(AUTH_STORAGE_KEYS.SESSION);
        const session = data[AUTH_STORAGE_KEYS.SESSION];

        if (config.isConfigured && session?.access_token) {
            try {
                await fetch(`${config.url}/auth/v1/logout`, {
                    method: 'POST',
                    headers: {
                        'apikey': config.anonKey,
                        'Authorization': `Bearer ${session.access_token}`
                    }
                });
            } catch (_) {
                // Ignora erro de rede no logout remoto
            }
        }

        await chrome.storage.local.remove([
            AUTH_STORAGE_KEYS.SESSION,
            AUTH_STORAGE_KEYS.PKCE_VERIFIER,
            'user_email',
            'user_avatar',
            'user_provider'
        ]);

        return { ok: true };
    }
};

globalThis.AuthService = AuthService;
