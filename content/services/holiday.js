// FlowDesk MV3 — holiday.js

/**
 * HolidayService — Serviço de Feriados Nacionais com Manutenção Zero.
 * Busca feriados do Google Calendar API uma vez por semana e armazena em cache.
 * Usa a lista fixa (FERIADOS_NACIONAIS_FIXOS) como fallback.
 */
if (!globalThis.HolidayService) {

const HolidayService = {
    /**
     * Retorna feriados do ano especificado como Set de strings 'DD/MM/YYYY'.
     * @param {number} year
     * @returns {Promise<Set<string>>}
     */
    async getHolidaySet(year) {
        const cache = await globalThis.SafeStorage.get(globalThis.CONFIG_APP.STORAGE_HOLIDAYS, null);
        const now = Date.now();
        const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

        let holidays = new Set();

        if (cache && cache.timestamp && (now - cache.timestamp) < ONE_WEEK_MS && cache.dates) {
            // Usar cache — filtrar datas do ano solicitado
            cache.dates
                .filter(d => d.endsWith(`/${year}`))
                .forEach(d => holidays.add(d));

            // Solicitar atualização silenciosa se o cache não tiver datas do próximo ano
            const nextYear = year + 1;
            const hasNextYear = cache.dates.some(d => d.endsWith(`/${nextYear}`));
            if (!hasNextYear) this.fetchFromCalendar();

        } else {
            // Cache expirado ou inexistente: usar fallback e iniciar fetch
            globalThis.FERIADOS_NACIONAIS_FIXOS.forEach(mmdd => {
                const [m, d] = mmdd.split('-');
                holidays.add(`${d}/${m}/${year}`);
            });
            this.fetchFromCalendar();
        }

        return holidays;
    },

    /**
     * Busca feriados do Google Calendar (br) para os próximos 2 anos e atualiza o cache.
     * Filtra apenas feriados nacionais (exclui carnaval e regionais).
     */
    async fetchFromCalendar() {
        const feedUrl = `https://calendar.google.com/calendar/ical/pt.brazilian%23holiday%40group.v.calendar.google.com/public/basic.ics`;

        try {
            const text = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage(
                    { action: 'fetch-get', url: feedUrl },
                    (response) => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                            return;
                        }
                        if (response && response.ok) resolve(response.data);
                        else reject(new Error(response?.error || 'Erro no background fetch'));
                    }
                );
            });
            try {
                const dates = HolidayService._parseIcal(text);
                await globalThis.SafeStorage.set(globalThis.CONFIG_APP.STORAGE_HOLIDAYS, {
                    timestamp: Date.now(),
                    dates
                });
                console.log(`[FlowDesk] HolidayService: ${dates.length} feriados nacionais carregados.`);
            } catch (e) {
                console.log('[FlowDesk] HolidayService: Erro ao parsear iCal.', e);
            }
        } catch (e) {
            console.log('[FlowDesk] HolidayService: Erro de rede, usando fallback.');
        }
    },

    /**
     * Parseia conteúdo iCal e extrai datas de feriados nacionais.
     * @param {string} ical - Conteúdo do arquivo .ics
     * @returns {string[]} Array de datas no formato 'DD/MM/YYYY'
     */
    _parseIcal(ical) {
        const events = ical.split('BEGIN:VEVENT');
        const dates = [];

        events.forEach(evt => {
            const summaryMatch = evt.match(/SUMMARY[^:]*:(.+)/);
            const dateMatch = evt.match(/DTSTART[^:]*:(\d{8})/);
            if (!summaryMatch || !dateMatch) return;

            const summary = summaryMatch[1].trim().toLowerCase();
            // Filtrar feriados regionais/carnaval
            if (globalThis.HOLIDAY_BLACKLIST.some(b => summary.includes(b))) return;

            const raw = dateMatch[1]; // YYYYMMDD
            const d = raw.slice(6, 8);
            const m = raw.slice(4, 6);
            const y = raw.slice(0, 4);
            dates.push(`${d}/${m}/${y}`);
        });

        return dates;
    }
};

globalThis.HolidayService = HolidayService;

}
