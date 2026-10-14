/**
 * TipoDeContactoDialog — «¿Quién es este número?» desde el buzón o la bandeja.
 *
 * Familia / Personal / Negocio / Otro club / Plataforma, más la casilla
 * «También es familia». Marcar cierra las filas abiertas de ese número en la
 * bandeja de comprobantes (lo hace el BFF, PATCH …/tipo), así que siempre se
 * confirma aquí: nunca se marca solo, ni desde una sugerencia.
 */

import { useEffect, useState } from 'react';
import { bffClient } from '@/lib/api/bffClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Check, Loader2 } from 'lucide-react';
import {
    OPCIONES_DE_TIPO, pedidoDeTipo, textoDelResultado,
    type OpcionDeTipo, type RespuestaDeTipo,
} from './tipoDeContacto';

export function TipoDeContactoDialog({
    schoolId, conversacionId, nombre, tipoInicial, tambienFamiliaInicial = false, abierto, onAbiertoChange, onHecho,
}: {
    schoolId: string;
    conversacionId: string | null;
    /** Nombre o número, para el título. */
    nombre: string | null;
    tipoInicial: OpcionDeTipo;
    tambienFamiliaInicial?: boolean;
    abierto: boolean;
    onAbiertoChange: (v: boolean) => void;
    onHecho: (r: RespuestaDeTipo & { tipo: OpcionDeTipo; tambienFamilia: boolean }) => void;
}) {
    const { toast } = useToast();
    const [tipo, setTipo] = useState<OpcionDeTipo>(tipoInicial);
    const [tambienFamilia, setTambienFamilia] = useState(tambienFamiliaInicial);
    const [guardando, setGuardando] = useState(false);

    // Cada vez que se abre, arranca de lo que tiene el contacto (o lo sugerido).
    useEffect(() => {
        if (abierto) { setTipo(tipoInicial); setTambienFamilia(tambienFamiliaInicial); }
    }, [abierto, tipoInicial, tambienFamiliaInicial]);

    const guardar = async () => {
        if (!conversacionId) return;
        setGuardando(true);
        try {
            const { ruta, cuerpo } = pedidoDeTipo(schoolId, conversacionId, tipo, tambienFamilia);
            const r = await bffClient.patch<RespuestaDeTipo>(ruta, cuerpo);
            toast(textoDelResultado(tipo, r?.filas_cerradas ?? 0));
            onHecho({ ...(r ?? { ok: true, contact_kind: null }), tipo, tambienFamilia: cuerpo.tambien_familia });
            onAbiertoChange(false);
        } catch (e) {
            toast({ title: 'No se pudo cambiar el tipo de contacto', description: e instanceof Error ? e.message : undefined,
                    variant: 'destructive' });
        } finally {
            setGuardando(false);
        }
    };

    return (
        <Dialog open={abierto} onOpenChange={(v) => { if (!guardando) onAbiertoChange(v); }}>
            <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-modal max-h-sheet overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Tipo de contacto</DialogTitle>
                    <DialogDescription>
                        {nombre ? <strong>{nombre}</strong> : 'Este número'}. Si no es una familia, el asistente no le
                        responde, no se guarda lo que escribe y sus fotos dejan de llegar a «Comprobantes sin
                        resolver» (las que ya estaban se cierran). Puedes cambiarlo cuando quieras.
                    </DialogDescription>
                </DialogHeader>

                <div role="radiogroup" aria-label="Tipo de contacto" className="space-y-2">
                    {OPCIONES_DE_TIPO.map((o) => {
                        const elegido = tipo === o.valor;
                        return (
                            <button key={o.valor} type="button" role="radio" aria-checked={elegido}
                                    onClick={() => setTipo(o.valor)}
                                    className={`flex w-full min-h-touch items-center gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                                        elegido ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}>
                                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                                    elegido ? 'border-primary bg-primary text-primary-foreground' : ''}`}>
                                    {elegido && <Check className="h-3 w-3" />}
                                </span>
                                <span className="min-w-0">
                                    <span className="block font-medium">{o.texto}</span>
                                    <span className="block text-xs text-muted-foreground">{o.ayuda}</span>
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div className={`flex min-h-touch items-start gap-3 rounded-md border px-3 py-2 ${tipo === 'familia' ? 'opacity-50' : ''}`}>
                    <Checkbox id="tipo-tambien-familia" className="mt-0.5" disabled={tipo === 'familia'}
                              checked={tipo !== 'familia' && tambienFamilia}
                              onCheckedChange={(v) => setTambienFamilia(v === true)} />
                    <Label htmlFor="tipo-tambien-familia" className="text-sm font-normal leading-snug">
                        <span className="block font-medium">También es familia</span>
                        <span className="block text-xs text-muted-foreground">
                            Tiene un hijo en la escuela: sus comprobantes de pago sí se aplican (sin escribirle);
                            sus fotos personales no llegan a la bandeja.
                        </span>
                    </Label>
                </div>

                <DialogFooter className="gap-2 [&>button]:min-h-touch md:[&>button]:min-h-0">
                    <Button variant="outline" onClick={() => onAbiertoChange(false)} disabled={guardando}>Cancelar</Button>
                    <Button onClick={() => void guardar()} disabled={guardando || !conversacionId}>
                        {guardando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Guardar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
