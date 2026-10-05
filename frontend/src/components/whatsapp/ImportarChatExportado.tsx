/**
 * ImportarChatExportado — sube el .zip de «Exportar chat → Incluir archivos»
 * de WhatsApp y mete las fotos de comprobantes de UNA familia en revisión.
 *
 * Para los comprobantes de antes de conectar el número, que solo están en el
 * celular de la escuela. Cada foto sigue el mismo camino que la recuperación
 * de la cola: queda en «Gestión de pagos → Por validar» para que la escuela la
 * apruebe; nunca se aprueba sola ni se le escribe a la familia.
 *
 * Tres pasos: subir el zip (el BFF dice quién mandó fotos) → elegir el
 * remitente que es la familia y su acudiente (una vez por chat) → importar.
 * El BFF procesa por lotes; acá se repite la llamada hasta que no quede nada.
 *
 * Spec: docs/specs/whatsapp-importar-chat-exportado.md
 */

import { useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BFF_URL } from '@/lib/api/bffClient';
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Upload, Loader2 } from 'lucide-react';

/** Mismo tope que el BFF (MAX_ZIP_BYTES): avisar antes de subir de más. */
const MAX_ZIP_MB = 40;

interface Familia { tipo: string; parentId?: string }
interface Remitente { nombre: string; telefono: string | null; adjuntos: number; familia: Familia | null }
interface Acudiente { id: string; nombre: string; telefono: string | null; hijos: string[] }
interface Analisis { conectado: boolean; remitentes: Remitente[]; adjuntos: number; acudientes: Acudiente[] }
interface Resultado {
    archivo: string; fecha: string | null; decision: string; motivo: string;
    monto: number | null; cobro: string | null;
}

/** Cómo se le cuenta a la escuela cada decisión. */
const ETIQUETA: Record<string, string> = {
    en_revision: 'En revisión',
    ya_registrado: 'Ya estaba registrado',
    ya_importado: 'Ya importado antes',
    no_es_comprobante: 'No es comprobante',
    es_listado: 'Listado de movimientos',
    destino_ajeno: 'Otra cuenta destino',
    sin_pendientes: 'Sin cobros pendientes',
    varios_cobros: 'Elegir cobro a mano',
    monto_distinto: 'Monto distinto al cobro',
    familia_sin_cuenta: 'Familia sin cuenta',
    enviado_por_equipo: 'Lo envió la escuela',
    reintentar: 'No se pudo leer: reintentar',
    archivo_no_disponible: 'Archivo ilegible',
};

const cop = (n: number | null) => n === null ? '—'
    : new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

/** POST del zip crudo. bffClient serializa JSON, así que acá va a mano. */
async function postZip<T>(ruta: string, archivo: File, schoolId: string): Promise<T> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('No hay sesión activa.');
    const res = await fetch(`${BFF_URL}${ruta}`, {
        method: 'POST',
        // x-school-id: el authMiddleware resuelve la membresía con él (igual que bffClient).
        headers: { 'Content-Type': 'application/zip', Authorization: `Bearer ${session.access_token}`, 'x-school-id': schoolId },
        body: archivo,
    });
    const cuerpo = await res.json().catch(() => null);
    if (!res.ok) throw new Error(cuerpo?.error ?? `Error ${res.status}`);
    return cuerpo as T;
}

export function ImportarChatExportado({ schoolId, alTerminar }: { schoolId: string; alTerminar?: () => void }) {
    const [abierto, setAbierto] = useState(false);
    const [archivo, setArchivo] = useState<File | null>(null);
    const [analisis, setAnalisis] = useState<Analisis | null>(null);
    const [remitente, setRemitente] = useState<string | null>(null);
    const [acudiente, setAcudiente] = useState<string | null>(null);
    const [filtro, setFiltro] = useState('');
    const [trabajando, setTrabajando] = useState(false);
    const [progreso, setProgreso] = useState<{ hechas: number; total: number } | null>(null);
    const [resultados, setResultados] = useState<Resultado[]>([]);
    const [error, setError] = useState<string | null>(null);

    const reiniciar = () => {
        setArchivo(null); setAnalisis(null); setRemitente(null); setAcudiente(null); setFiltro('');
        setProgreso(null); setResultados([]); setError(null);
    };

    const analizar = async (f: File) => {
        reiniciar();
        if (!f.name.toLowerCase().endsWith('.zip')) { setError('Tiene que ser el .zip que genera WhatsApp.'); return; }
        if (f.size > MAX_ZIP_MB * 1024 * 1024) { setError(`El archivo pesa más de ${MAX_ZIP_MB} MB.`); return; }
        setArchivo(f);
        setTrabajando(true);
        try {
            const a = await postZip<Analisis>(`/api/v1/whatsapp/${schoolId}/importar-chat/analizar`, f, schoolId);
            setAnalisis(a);
            // Lo más probable: el que más fotos mandó que no es la escuela.
            const primero = a.remitentes.find((r) => r.familia?.tipo !== 'staff') ?? a.remitentes[0];
            if (primero) elegirRemitente(primero);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'No se pudo leer el archivo.');
        } finally {
            setTrabajando(false);
        }
    };

    const elegirRemitente = (r: Remitente) => {
        setRemitente(r.nombre);
        // Si el número del chat ya se reconoce, el acudiente viene elegido.
        setAcudiente(r.familia?.tipo === 'identificado' && r.familia.parentId ? r.familia.parentId : null);
    };

    const acudientesFiltrados = useMemo(() => {
        const q = filtro.trim().toLowerCase();
        const lista = analisis?.acudientes ?? [];
        if (!q) return lista.slice(0, 30);
        return lista.filter((a) =>
            a.nombre.toLowerCase().includes(q)
            || a.hijos.some((h) => h.toLowerCase().includes(q))
            || (a.telefono ?? '').includes(q)).slice(0, 30);
    }, [analisis, filtro]);

    const acudienteElegido = analisis?.acudientes.find((a) => a.id === acudiente) ?? null;
    const fotosDelRemitente = analisis?.remitentes.find((r) => r.nombre === remitente)?.adjuntos ?? 0;

    const importar = async () => {
        if (!archivo || !remitente || !acudiente) return;
        setTrabajando(true);
        setError(null);
        setResultados([]);
        setProgreso({ hechas: 0, total: fotosDelRemitente });
        try {
            const ruta = `/api/v1/whatsapp/${schoolId}/importar-chat?remitente=${encodeURIComponent(remitente)}&parentId=${acudiente}`;
            const todos: Resultado[] = [];
            // Por lotes: el BFF corta en ~15 fotos por llamada (el OCR tarda).
            // Lo ya importado se salta sin costo, así que cada vuelta avanza.
            for (let vuelta = 0; vuelta < 40; vuelta++) {
                const r = await postZip<{ resultados: Resultado[]; total: number; quedan: number }>(ruta, archivo, schoolId);
                const nuevos = r.resultados.filter((x) => !todos.some((t) => t.archivo === x.archivo));
                todos.push(...nuevos);
                setResultados([...todos]);
                setProgreso({ hechas: r.total - r.quedan, total: r.total });
                if (r.quedan === 0 || r.resultados.length === 0) break;
            }
            alTerminar?.();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Falló la importación. Puedes volver a intentarlo: lo ya importado no se repite.');
        } finally {
            setTrabajando(false);
        }
    };

    const enRevision = resultados.filter((r) => r.decision === 'en_revision').length;

    return (
        <Dialog open={abierto} onOpenChange={(v) => { setAbierto(v); if (!v) reiniciar(); }}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <Upload className="h-4 w-4 mr-1" /> Importar chat exportado
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Importar comprobantes de un chat</DialogTitle>
                    <DialogDescription>
                        En WhatsApp abre el chat de la familia → ⋮ / nombre del contacto → <b>Exportar chat</b> →
                        <b> Incluir archivos</b>, y sube aquí el .zip. Cada comprobante queda <b>por validar</b> en
                        Gestión de pagos; nada se aprueba solo y a la familia no se le escribe.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <Input
                        type="file"
                        accept=".zip,application/zip"
                        disabled={trabajando}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) void analizar(f); }}
                    />

                    {error && <p className="text-sm text-destructive">{error}</p>}
                    {trabajando && !progreso && (
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" /> Leyendo el chat…
                        </p>
                    )}

                    {analisis && !analisis.conectado && (
                        <p className="text-sm text-destructive">La escuela no tiene WhatsApp conectado.</p>
                    )}

                    {analisis && analisis.remitentes.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                            El chat no trae fotos ni PDF. ¿Lo exportaste con «Incluir archivos»?
                        </p>
                    )}

                    {analisis && analisis.remitentes.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-sm font-medium">1. ¿Quién es la familia en este chat?</p>
                            <div className="flex flex-wrap gap-2">
                                {analisis.remitentes.map((r) => (
                                    <Button
                                        key={r.nombre}
                                        size="sm"
                                        variant={remitente === r.nombre ? 'default' : 'outline'}
                                        onClick={() => elegirRemitente(r)}
                                        disabled={trabajando}
                                    >
                                        {r.nombre} · {r.adjuntos} archivo{r.adjuntos === 1 ? '' : 's'}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    )}

                    {remitente && analisis && (
                        <div className="space-y-2">
                            <p className="text-sm font-medium">2. ¿A qué acudiente le corresponden?</p>
                            {acudienteElegido ? (
                                <div className="flex items-center justify-between rounded border p-2 text-sm">
                                    <div>
                                        <div className="font-medium">{acudienteElegido.nombre}</div>
                                        <div className="text-muted-foreground text-xs">
                                            {acudienteElegido.hijos.join(', ')}
                                            {acudienteElegido.telefono && ` · …${acudienteElegido.telefono}`}
                                        </div>
                                    </div>
                                    <Button size="sm" variant="ghost" disabled={trabajando} onClick={() => setAcudiente(null)}>
                                        Cambiar
                                    </Button>
                                </div>
                            ) : (
                                <>
                                    <Input
                                        placeholder="Busca por acudiente, atleta o últimos dígitos del celular"
                                        value={filtro}
                                        onChange={(e) => setFiltro(e.target.value)}
                                    />
                                    <div className="max-h-56 overflow-y-auto rounded border divide-y">
                                        {acudientesFiltrados.map((a) => (
                                            <button
                                                key={a.id}
                                                type="button"
                                                className="w-full text-left p-2 text-sm hover:bg-muted"
                                                onClick={() => setAcudiente(a.id)}
                                            >
                                                <div className="font-medium">{a.nombre}</div>
                                                <div className="text-muted-foreground text-xs">
                                                    {a.hijos.join(', ')}{a.telefono && ` · …${a.telefono}`}
                                                </div>
                                            </button>
                                        ))}
                                        {acudientesFiltrados.length === 0 && (
                                            <p className="p-2 text-sm text-muted-foreground">
                                                Sin resultados. Solo aparecen acudientes con cuenta y un atleta activo.
                                            </p>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {remitente && acudiente && (
                        <Button onClick={() => void importar()} disabled={trabajando || !analisis?.conectado} className="w-full">
                            {trabajando
                                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importando {progreso ? `${progreso.hechas}/${progreso.total}` : ''}…</>
                                : `3. Importar ${fotosDelRemitente} archivo${fotosDelRemitente === 1 ? '' : 's'}`}
                        </Button>
                    )}

                    {resultados.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-sm">
                                <b>{enRevision}</b> quedaron por validar en Gestión de pagos. El resto queda anotado abajo
                                y en la bandeja.
                            </p>
                            <div className="rounded border divide-y text-sm">
                                {resultados.map((r) => (
                                    <div key={r.archivo} className="p-2 flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <div className="font-mono text-xs truncate">{r.archivo}</div>
                                            <div className="text-muted-foreground text-xs">
                                                {r.fecha ?? 's/f'} · {cop(r.monto)}{r.cobro ? ` · ${r.cobro}` : ''}
                                            </div>
                                            {r.decision !== 'en_revision' && (
                                                <div className="text-muted-foreground text-xs">{r.motivo}</div>
                                            )}
                                        </div>
                                        <Badge variant={r.decision === 'en_revision' ? 'default' : 'outline'} className="shrink-0">
                                            {ETIQUETA[r.decision] ?? r.decision}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
