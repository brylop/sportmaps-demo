/**
 * Base falsa en memoria para las pruebas del modal «Cobros y pagos» (F2).
 * No es un *.test.ts: lo importan las pruebas desde su `vi.mock`.
 *
 * El builder FILTRA de verdad (eq, in, not is null, lt/gte…): las pruebas de
 * autorización dependen de que `.eq('school_id', …)` y `.in('role', …)` filtren,
 * igual que invoicing.authz.test.ts.
 */
export type Fila = Record<string, any>;

export interface EstadoFalso {
    tablas: Record<string, Fila[]>;
    /** Errores forzados por tabla (p. ej. { charge_batches: { code: '42P01', message: '…' } }). */
    erroresTabla: Record<string, { code?: string; message: string }>;
    rpc: Record<string, (args: any) => { data?: any; error?: any } | Promise<{ data?: any; error?: any }>>;
    llamadasRpc: { nombre: string; args: any }[];
    tokens: Record<string, { id: string; email: string }>;
}

export function estadoVacio(): EstadoFalso {
    return { tablas: {}, erroresTabla: {}, rpc: {}, llamadasRpc: [], tokens: {} };
}

export function supabaseFalso(estado: EstadoFalso) {
    function builder(tabla: string) {
        let filas: Fila[] = [...(estado.tablas[tabla] ?? [])];
        const err = () => estado.erroresTabla[tabla] ?? null;
        const api: any = {
            select: () => api,
            eq: (c: string, v: any) => { filas = filas.filter((f) => f[c] === v); return api; },
            neq: (c: string, v: any) => { filas = filas.filter((f) => f[c] !== v); return api; },
            in: (c: string, vs: any[]) => { filas = filas.filter((f) => vs.includes(f[c])); return api; },
            is: (c: string, v: any) => { filas = filas.filter((f) => (f[c] ?? null) === v); return api; },
            not: (c: string, op: string, v: any) => {
                if (op === 'is' && v === null) filas = filas.filter((f) => (f[c] ?? null) !== null);
                return api;
            },
            lt: (c: string, v: any) => { filas = filas.filter((f) => f[c] < v); return api; },
            lte: (c: string, v: any) => { filas = filas.filter((f) => f[c] <= v); return api; },
            gt: (c: string, v: any) => { filas = filas.filter((f) => f[c] > v); return api; },
            gte: (c: string, v: any) => { filas = filas.filter((f) => f[c] >= v); return api; },
            order: (c: string, o?: { ascending?: boolean }) => {
                const asc = o?.ascending !== false;
                filas = [...filas].sort((a, b) => (a[c] < b[c] ? -1 : a[c] > b[c] ? 1 : 0) * (asc ? 1 : -1));
                return api;
            },
            limit: (n: number) => { filas = filas.slice(0, n); return api; },
            maybeSingle: async () => (err() ? { data: null, error: err() } : { data: filas[0] ?? null, error: null }),
            single: async () => (err() ? { data: null, error: err() } : { data: filas[0] ?? null, error: null }),
            then: (ok: any, ko: any) => Promise.resolve(err() ? { data: null, error: err() } : { data: filas, error: null }).then(ok, ko),
        };
        return api;
    }
    return {
        from: (t: string) => builder(t),
        rpc: async (nombre: string, args: any) => {
            estado.llamadasRpc.push({ nombre, args });
            const h = estado.rpc[nombre];
            if (!h) return { data: null, error: { code: 'PGRST202', message: `Could not find the function public.${nombre}` } };
            const r = await h(args);
            return { data: r.data ?? null, error: r.error ?? null };
        },
        auth: {
            getUser: async (token: string) => {
                const user = estado.tokens[token];
                return user ? { data: { user }, error: null } : { data: { user: null }, error: { message: 'invalid token' } };
            },
        },
    };
}
