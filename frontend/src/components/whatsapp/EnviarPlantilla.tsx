/**
 * «Enviar plantilla» desde el hilo del buzón.
 *
 * Con la ventana de 24 h cerrada WhatsApp solo deja escribir con una plantilla
 * aprobada, y el buzón lo decía sin dar cómo hacerlo (inventario 2026-10-12
 * §10.2). Este selector lista las plantillas aprobadas de la cuenta de la
 * escuela, pide los datos de cada {{n}} y la envía por el BFF, que vuelve a
 * revisar todo: consentimiento (y bajas), categoría, botones con enlace, horario
 * de cobranza y freno de abuso. Lo que no se puede mandar se ve deshabilitado
 * con el motivo, para que nadie se quede adivinando.
 *
 * En el celular es una hoja desde abajo; en escritorio, un diálogo.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { bffClient } from '@/lib/api/bffClient';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AlertTriangle, FileText, Loader2, Send } from 'lucide-react';

export interface PlantillaDelHilo {
    nombre: string;
    idioma: string;
    categoria: string | null;
    estado: string;
    cuerpo: string;
    variables: number;
    ejemplos: string[];
    enviable: boolean;
    motivo: string | null;
    motivo_texto: string | null;
}

interface RespuestaPlantillas {
    puede_enviar: boolean;
    motivo: string | null;
    motivo_texto: string | null;
    ventana_abierta?: boolean;
    plantillas: PlantillaDelHilo[];
}

/** Nombre de la plantilla en palabras: «clase_cancelada» → «Clase cancelada». */
export function nombreLegible(nombre: string): string {
    const t = nombre.replace(/_v\d+$/, '').replace(/_/g, ' ').trim();
    return t.charAt(0).toUpperCase() + t.slice(1);
}

/** El cuerpo con lo escrito en cada {{n}} (o el número si está vacío). Pura. */
export function vistaPrevia(cuerpo: string, valores: string[]): string {
    return cuerpo.replace(/\{\{(\d+)\}\}/g, (_, n) => valores[Number(n) - 1]?.trim() || `{{${n}}}`);
}

/** Primer nombre del contacto para el saludo «Hola {{1}}». */
function primerNombre(nombre: string | null | undefined): string {
    return (nombre ?? '').trim().split(/\s+/)[0] ?? '';
}

export function EnviarPlantilla({ schoolId, conversacionId, contacto, abierto, onAbiertoChange, onEnviada }: {
    schoolId: string;
    conversacionId: string;
    contacto: string | null;
    abierto: boolean;
    onAbiertoChange: (v: boolean) => void;
    onEnviada: () => void;
}) {
    const { toast } = useToast();
    const esCelular = useIsMobile();
    const [datos, setDatos] = useState<RespuestaPlantillas | null>(null);
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [elegida, setElegida] = useState<PlantillaDelHilo | null>(null);
    const [valores, setValores] = useState<string[]>([]);
    const [enviando, setEnviando] = useState(false);

    const cargar = useCallback(async () => {
        setCargando(true);
        setError(null);
        try {
            const r = await bffClient.get<RespuestaPlantillas>(
                `/api/v1/whatsapp/${schoolId}/conversaciones/${conversacionId}/plantillas`);
            setDatos(r);
        } catch (e: any) {
            setError(e?.message ?? 'No se pudieron cargar las plantillas.');
        } finally {
            setCargando(false);
        }
    }, [schoolId, conversacionId]);

    useEffect(() => {
        if (!abierto) return;
        setElegida(null);
        setValores([]);
        void cargar();
    }, [abierto, cargar]);

    const elegir = (p: PlantillaDelHilo) => {
        setElegida(p);
        const v = Array.from({ length: p.variables }, () => '');
        // «Hola {{1}}…»: el saludo va con el nombre de quien escribió.
        if (p.variables > 0 && /^\s*hola\s*\{\{1\}\}/i.test(p.cuerpo)) v[0] = primerNombre(contacto);
        setValores(v);
    };

    const completos = !!elegida && valores.length === elegida.variables && valores.every((v) => v.trim().length > 0);
    const previa = useMemo(() => (elegida ? vistaPrevia(elegida.cuerpo, valores) : ''), [elegida, valores]);

    const enviar = async () => {
        if (!elegida || !completos) return;
        setEnviando(true);
        try {
            await bffClient.post(`/api/v1/whatsapp/${schoolId}/conversaciones/${conversacionId}/plantilla`,
                { nombre: elegida.nombre, idioma: elegida.idioma, variables: valores.map((v) => v.trim()) });
            toast({ title: 'Plantilla enviada', description: 'Le llegó por WhatsApp. Si responde, se abre la ventana para escribirle.' });
            onAbiertoChange(false);
            onEnviada();
        } catch (e: any) {
            toast({ title: 'No se pudo enviar', description: e?.body?.detalle ?? e?.message, variant: 'destructive' });
        } finally {
            setEnviando(false);
        }
    };

    const bloqueada = datos && !datos.puede_enviar;
    const enviables = datos?.plantillas.filter((p) => p.enviable) ?? [];
    const otras = datos?.plantillas.filter((p) => !p.enviable) ?? [];

    const cuerpo = (
        <div className="space-y-4">
            {cargando && (
                <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground justify-center">
                    <Loader2 className="h-4 w-4 animate-spin" /> Cargando plantillas…
                </p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}

            {bloqueada && (
                <div role="alert" data-testid="plantilla-bloqueada"
                     className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                    <p>{datos!.motivo_texto}</p>
                </div>
            )}

            {datos && !elegida && (
                <div className="space-y-2">
                    {enviables.length === 0 && !bloqueada && (
                        <p className="text-sm text-muted-foreground">
                            No hay plantillas de texto aprobadas que se puedan enviar desde el chat. Créalas en la pestaña
                            «Plantillas» y espera la aprobación de Meta.
                        </p>
                    )}
                    {[...enviables, ...otras].map((p) => {
                        const deshabilitada = !p.enviable || !!bloqueada;
                        return (
                            <button key={`${p.nombre}|${p.idioma}`} type="button" disabled={deshabilitada}
                                    onClick={() => elegir(p)}
                                    className="w-full min-h-touch rounded-lg border p-3 text-left transition-colors hover:bg-muted/50
                                               disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent
                                               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                <span className="flex items-center gap-1.5 text-sm font-medium">
                                    <FileText className="h-4 w-4 shrink-0" /> {nombreLegible(p.nombre)}
                                </span>
                                <span className="mt-1 block text-xs text-muted-foreground line-clamp-2">{p.cuerpo}</span>
                                {!p.enviable && p.motivo_texto && (
                                    <span className="mt-1 block text-xs text-amber-700 dark:text-amber-400">{p.motivo_texto}</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {elegida && (
                <div className="space-y-3">
                    <button type="button" className="text-xs text-primary underline-offset-2 hover:underline"
                            onClick={() => setElegida(null)}>
                        ← Elegir otra plantilla
                    </button>
                    <p className="text-sm font-medium">{nombreLegible(elegida.nombre)}</p>
                    {valores.map((v, i) => (
                        <div key={i} className="space-y-1">
                            <Label htmlFor={`var-${i}`} className="text-xs">Dato {`{{${i + 1}}}`}</Label>
                            <Input id={`var-${i}`} value={v} maxLength={300}
                                   placeholder={elegida.ejemplos[i] ? `Ej.: ${elegida.ejemplos[i]}` : ''}
                                   onChange={(e) => setValores((xs) => xs.map((x, j) => (j === i ? e.target.value : x)))} />
                        </div>
                    ))}
                    <div className="rounded-lg bg-muted/50 p-3">
                        <p className="mb-1 text-xs text-muted-foreground">Así le llega:</p>
                        <p className="whitespace-pre-wrap break-words text-sm" data-testid="plantilla-previa">{previa}</p>
                    </div>
                </div>
            )}
        </div>
    );

    const pie = (
        <>
            <Button variant="outline" onClick={() => onAbiertoChange(false)} disabled={enviando}>Cancelar</Button>
            <Button onClick={() => void enviar()} disabled={!completos || enviando || !!bloqueada}>
                {enviando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Enviar plantilla
            </Button>
        </>
    );

    const titulo = 'Enviar plantilla';
    const descripcion = `A ${contacto || 'este contacto'}. Solo se pueden enviar plantillas aprobadas por Meta.`;

    if (esCelular) {
        return (
            <Sheet open={abierto} onOpenChange={onAbiertoChange}>
                <SheetContent side="bottom" className="max-h-sheet overflow-y-auto px-gutter pb-safe-b">
                    <SheetHeader className="text-left">
                        <SheetTitle>{titulo}</SheetTitle>
                        <SheetDescription>{descripcion}</SheetDescription>
                    </SheetHeader>
                    <div className="py-4">{cuerpo}</div>
                    <SheetFooter className="flex-row justify-end gap-2 pb-2">{pie}</SheetFooter>
                </SheetContent>
            </Sheet>
        );
    }
    return (
        <Dialog open={abierto} onOpenChange={onAbiertoChange}>
            <DialogContent className="max-w-modal max-h-screen-d overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><FileText className="h-4 w-4" /> {titulo}</DialogTitle>
                    <DialogDescription>{descripcion}</DialogDescription>
                </DialogHeader>
                {cuerpo}
                <DialogFooter>{pie}</DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
