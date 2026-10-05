/**
 * /p/:token — enlace público de UN cobro, sin login.
 *
 * Es el destino del botón de las plantillas de cobranza de WhatsApp
 * (https://sportmaps.co/p/<token>; la landing redirige /p/* a app.sportmaps.co).
 * Muestra el cobro y deja pagarlo:
 *   · en línea, si la escuela tiene pasarela en producción (Wompi), con la firma
 *     calculada por el BFF — no hay sesión para pedírsela a la Edge Function;
 *   · por transferencia a las cuentas de la escuela, y mandar el comprobante
 *     por el WhatsApp de la escuela (lo lee el bot de comprobantes).
 * Nada de lo que se muestra identifica al acudiente: solo escuela, concepto,
 * nombre corto del deportista y montos. Mobile first: se abre desde WhatsApp.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
    AlertCircle, CheckCircle2, Clock, Copy, CreditCard, Loader2, MessageCircle, Landmark, XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BFFError } from '@/lib/api/bffClient';
import {
    abrirWidgetWompi, iniciarPagoCobroPublico, obtenerCobroPublico,
    type EstadoCobro, type VistaCobroPublico,
} from '@/lib/api/cobroPublico';

const cop = (n: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

const fecha = (d: string | null) =>
    d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) : null;

const ETIQUETA: Record<EstadoCobro, { texto: string; clase: string }> = {
    pendiente: { texto: 'Pendiente', clase: 'bg-amber-100 text-amber-800' },
    vencido: { texto: 'Vencido', clase: 'bg-red-100 text-red-800' },
    en_revision: { texto: 'Comprobante en revisión', clase: 'bg-blue-100 text-blue-800' },
    pagado: { texto: 'Pagado', clase: 'bg-green-100 text-green-800' },
    abono: { texto: 'Con abono', clase: 'bg-amber-100 text-amber-800' },
    anulado: { texto: 'Anulado', clase: 'bg-gray-200 text-gray-700' },
    rechazado: { texto: 'Comprobante rechazado', clase: 'bg-red-100 text-red-800' },
};

type Carga =
    | { tipo: 'cargando' }
    | { tipo: 'error'; titulo: string; detalle: string }
    | { tipo: 'ok'; vista: VistaCobroPublico };

export default function CobroPublicoPage() {
    const { token = '' } = useParams<{ token: string }>();
    const [params] = useSearchParams();
    const [carga, setCarga] = useState<Carga>({ tipo: 'cargando' });
    const [pagando, setPagando] = useState(false);
    const [aviso, setAviso] = useState<string | null>(null);
    const [copiado, setCopiado] = useState<string | null>(null);
    const sondeo = useRef<number | null>(null);

    const cargar = useCallback(async (silencioso = false) => {
        if (!silencioso) setCarga({ tipo: 'cargando' });
        try {
            const vista = await obtenerCobroPublico(token);
            setCarga({ tipo: 'ok', vista });
            return vista;
        } catch (e) {
            const status = e instanceof BFFError ? e.status : 0;
            if (status === 404) {
                setCarga({ tipo: 'error', titulo: 'Enlace no válido', detalle: 'Revisa que el enlace esté completo o pídele uno nuevo a la escuela.' });
            } else if (status === 410) {
                setCarga({ tipo: 'error', titulo: 'Este enlace ya no está disponible', detalle: (e as Error).message });
            } else if (!silencioso) {
                setCarga({ tipo: 'error', titulo: 'No pudimos cargar el cobro', detalle: 'Revisa tu conexión e intenta de nuevo.' });
            }
            return null;
        }
    }, [token]);

    // Tras pagar, el estado lo pone el webhook de la pasarela (segundos). Se
    // consulta unas veces y se para apenas figure pagado.
    const sondear = useCallback(() => {
        let intentos = 0;
        if (sondeo.current) window.clearInterval(sondeo.current);
        sondeo.current = window.setInterval(async () => {
            intentos += 1;
            const v = await cargar(true);
            if ((v && v.estado === 'pagado') || intentos >= 10) {
                if (sondeo.current) window.clearInterval(sondeo.current);
                sondeo.current = null;
            }
        }, 3000);
    }, [cargar]);

    useEffect(() => {
        void cargar();
        // Regreso desde el redirect de Wompi (pagos que salen del Widget, p.ej. PSE).
        if (params.get('id')) sondear();
        return () => { if (sondeo.current) window.clearInterval(sondeo.current); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    async function pagarEnLinea() {
        setPagando(true);
        setAviso(null);
        let resultado: ReturnType<typeof abrirWidgetWompi> = null;
        try {
            const checkout = await iniciarPagoCobroPublico(token);
            resultado = abrirWidgetWompi(checkout, `${window.location.origin}/p/${encodeURIComponent(token)}`);
            if (!resultado) {
                setAviso('No pudimos abrir la pasarela de pago. Intenta de nuevo o paga por transferencia.');
            }
        } catch (e) {
            setAviso((e as Error).message || 'No pudimos iniciar el pago.');
            void cargar(true);
        } finally {
            // El Widget ya está en pantalla: no se espera su resultado para soltar
            // el botón (si lo cierran sin pagar, Wompi nunca llama al callback).
            setPagando(false);
        }
        const tx = resultado ? await resultado : null;
        if (tx?.status === 'APPROVED' || tx?.status === 'PENDING') {
            setAviso(tx.status === 'APPROVED'
                ? 'Pago aprobado. Estamos confirmándolo con la escuela…'
                : 'Tu pago está en proceso. Te mostramos el resultado apenas llegue.');
            sondear();
        } else if (tx?.status === 'DECLINED' || tx?.status === 'ERROR') {
            setAviso('El pago no se completó. Puedes intentarlo de nuevo o pagar por transferencia.');
        }
    }

    async function copiar(numero: string) {
        try {
            await navigator.clipboard.writeText(numero);
            setCopiado(numero);
            window.setTimeout(() => setCopiado(null), 2000);
        } catch {
            /* sin permiso de portapapeles: el número igual está a la vista */
        }
    }

    if (carga.tipo === 'cargando') {
        return (
            <main className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" aria-label="Cargando" />
            </main>
        );
    }

    if (carga.tipo === 'error') {
        return (
            <main className="min-h-screen bg-gray-50 px-4 py-10">
                <div className="mx-auto max-w-md rounded-2xl bg-white p-6 text-center shadow-sm">
                    <AlertCircle className="mx-auto h-10 w-10 text-gray-400" />
                    <h1 className="mt-3 text-lg font-semibold text-gray-900">{carga.titulo}</h1>
                    <p className="mt-2 text-sm text-gray-600">{carga.detalle}</p>
                    <Button asChild variant="outline" className="mt-5 w-full">
                        <a href="/login">Entrar a SportMaps</a>
                    </Button>
                </div>
                <PieSportMaps />
            </main>
        );
    }

    const v = carga.vista;
    const etiqueta = ETIQUETA[v.estado];
    const pagable = ['pendiente', 'vencido', 'abono', 'rechazado'].includes(v.estado);

    return (
        <main className="min-h-screen bg-gray-50 px-4 py-6">
            <div className="mx-auto max-w-md space-y-4">
                <header className="flex items-center gap-3">
                    {v.escuela.logoUrl ? (
                        <img src={v.escuela.logoUrl} alt="" className="h-12 w-12 rounded-full object-cover bg-white" />
                    ) : (
                        <div className="h-12 w-12 rounded-full bg-gray-200" aria-hidden />
                    )}
                    <div className="min-w-0">
                        <p className="text-xs text-gray-500">Cobro de</p>
                        <h1 className="truncate text-base font-semibold text-gray-900">{v.escuela.nombre}</h1>
                    </div>
                </header>

                <section className="rounded-2xl bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900">
                                {v.concepto}{v.periodo ? ` · ${v.periodo}` : ''}
                            </p>
                            {v.deportista && <p className="text-sm text-gray-600">{v.deportista}</p>}
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${etiqueta.clase}`}>
                            {etiqueta.texto}
                        </span>
                    </div>
                    <p className="mt-4 text-3xl font-bold text-gray-900">{cop(v.monto)}</p>
                    {v.fechaVencimiento && v.estado !== 'pagado' && (
                        <p className="mt-1 flex items-center gap-1 text-sm text-gray-600">
                            <Clock className="h-4 w-4" /> Vence el {fecha(v.fechaVencimiento)}
                        </p>
                    )}
                    {v.estado === 'pagado' && (
                        <p className="mt-3 flex items-center gap-2 text-sm text-green-700">
                            <CheckCircle2 className="h-5 w-5" />
                            Pago registrado{v.fechaPago ? ` el ${fecha(v.fechaPago)}` : ''}. ¡Gracias!
                        </p>
                    )}
                    {v.estado === 'en_revision' && (
                        <p className="mt-3 text-sm text-blue-700">
                            La escuela está revisando tu comprobante. No tienes que hacer nada más.
                        </p>
                    )}
                    {v.estado === 'anulado' && (
                        <p className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                            <XCircle className="h-5 w-5" /> Este cobro fue anulado por la escuela.
                        </p>
                    )}
                </section>

                {aviso && (
                    <p role="status" className="rounded-xl bg-white p-3 text-sm text-gray-700 shadow-sm">{aviso}</p>
                )}

                {pagable && v.enLinea && (
                    <section className="rounded-2xl bg-white p-5 shadow-sm">
                        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                            <CreditCard className="h-4 w-4" /> Pagar en línea
                        </h2>
                        <p className="mt-1 text-xs text-gray-600">
                            Tarjeta, PSE, Nequi o Bancolombia.
                            {v.enLinea.recargo > 0 && ` Incluye ${cop(v.enLinea.recargo)} de recargo por pago en línea (${v.enLinea.recargoPct}%).`}
                        </p>
                        <Button className="mt-4 h-12 w-full text-base" onClick={pagarEnLinea} disabled={pagando}>
                            {pagando ? <Loader2 className="h-5 w-5 animate-spin" /> : `Pagar ${cop(v.enLinea.total)}`}
                        </Button>
                    </section>
                )}

                {pagable && (v.transferencia.cuentas.length > 0 || v.transferencia.whatsappComprobante) && (
                    <section className="rounded-2xl bg-white p-5 shadow-sm">
                        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                            <Landmark className="h-4 w-4" /> {v.enLinea ? 'O transfiere' : 'Paga por transferencia'}
                        </h2>
                        {v.transferencia.cuentas.length > 0 ? (
                            <ul className="mt-3 space-y-2">
                                {v.transferencia.cuentas.map((c) => (
                                    <li key={c.numero} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 p-3">
                                        <div className="min-w-0">
                                            <p className="text-xs text-gray-500">{c.tipo}{c.titular ? ` · ${c.titular}` : ''}</p>
                                            <p className="break-all font-mono text-sm text-gray-900">{c.numero}</p>
                                        </div>
                                        <Button
                                            size="sm" variant="ghost" className="shrink-0"
                                            onClick={() => copiar(c.numero)}
                                            aria-label={`Copiar ${c.numero}`}
                                        >
                                            {copiado === c.numero ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="mt-2 text-sm text-gray-600">Pídele a la escuela los datos para transferir.</p>
                        )}
                        <p className="mt-3 text-xs text-gray-600">Valor a transferir: <strong>{cop(v.monto)}</strong></p>
                        {v.transferencia.whatsappComprobante && (
                            <Button asChild variant="outline" className="mt-4 h-12 w-full">
                                <a href={v.transferencia.whatsappComprobante} target="_blank" rel="noopener noreferrer">
                                    <MessageCircle className="mr-2 h-5 w-5" /> Enviar comprobante por WhatsApp
                                </a>
                            </Button>
                        )}
                    </section>
                )}

                <p className="text-center text-xs text-gray-500">
                    ¿Tienes cuenta? <a href="/my-payments" className="underline">Ver todos tus pagos</a>
                </p>
                <PieSportMaps />
            </div>
        </main>
    );
}

/** "Con SportMaps" siempre visible: logo de la escuela ≠ marca blanca. */
function PieSportMaps() {
    return <p className="pt-2 text-center text-[11px] text-gray-400">Cobro gestionado con SportMaps</p>;
}
