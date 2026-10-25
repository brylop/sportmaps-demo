/**
 * Buzón de WhatsApp, Fase 1 (2026-10-13): búsqueda en servidor, adjuntos,
 * «Enviar plantilla» con la ventana cerrada y cierre en lote de la Bandeja.
 * El BFF está moqueado: ningún mensaje sale de acá.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

const bff = vi.hoisted(() => ({
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    getBlob: vi.fn(),
}));
vi.mock('@/lib/api/bffClient', () => ({ bffClient: bff }));
// Estable entre renders, como el real: si cambiara, los useCallback que lo
// usan se recrearían y la pantalla recargaría sola.
const toastEstable = vi.hoisted(() => ({ toast: () => {} }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => toastEstable }));

import { Conversaciones } from './Conversaciones';
import { EnviarPlantilla, vistaPrevia, nombreLegible } from './EnviarPlantilla';
import { AdjuntoDelMensaje } from './AdjuntoDelMensaje';
import { BandejaComprobantes } from './BandejaComprobantes';

const ahora = Date.now();
const iso = (msAtras: number) => new Date(ahora - msAtras).toISOString();

const conv = (id: string, extra: Record<string, unknown> = {}) => ({
    id, contact_wa_id: '573000000001', contact_name: `Contacto ${id}`, identified: true, status: 'open',
    unread_count: 0, last_message_at: iso(60_000), last_inbound_at: iso(60_000), ventana_abierta: true,
    ventana_vence: iso(-20 * 3_600_000), ultimo_mensaje: { direction: 'inbound', text_body: 'Hola', type: 'text', created_at: iso(60_000), ai_generated: false },
    borradores_pendientes: 0, contact_kind: 'familia', requiere_respuesta: true, ...extra,
});

function rutearGet(rutas: Record<string, unknown>) {
    bff.get.mockImplementation(async (path: string) => {
        for (const [prefijo, r] of Object.entries(rutas)) {
            if (path.includes(prefijo)) return typeof r === 'function' ? (r as any)(path) : r;
        }
        throw Object.assign(new Error('no encontrado'), { status: 404 });
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    (URL as any).createObjectURL = vi.fn(() => 'blob:prueba');
    (URL as any).revokeObjectURL = vi.fn();
});

describe('Conversaciones · búsqueda en servidor', () => {
    it('busca en el BFF (todas las conversaciones), muestra por qué apareció y ya no dice «usa la búsqueda para el resto»', async () => {
        rutearGet({
            '/buzon/buscar': {
                total: 1, hay_mas: false,
                conversaciones: [conv('vieja', { contact_name: 'María Pérez', coincidencia: { tipo: 'deportista', texto: 'Samuel Pérez' } })],
            },
            '/conversaciones?vista=todas': { conversaciones: [conv('a')], conteos: { todas: 305 }, clasificacion_disponible: true, toma_disponible: true },
        });
        render(<Conversaciones schoolId="s1" />);
        await screen.findByText('Contacto a');
        expect(screen.queryByText(/Usa la búsqueda para el resto/)).toBeNull();

        fireEvent.change(screen.getByLabelText('Buscar conversaciones'), { target: { value: 'samuel' } });
        await screen.findByText('María Pérez', undefined, { timeout: 2000 });
        expect(bff.get).toHaveBeenCalledWith('/api/v1/whatsapp/s1/buzon/buscar?q=samuel&offset=0&limite=25');
        expect(screen.getByTestId('coincidencia')).toHaveTextContent('Deportista: Samuel Pérez');
        expect(screen.getByTestId('resumen-busqueda')).toHaveTextContent('1 resultado en todas las conversaciones.');
    });

    it('la nota de abajo dice la verdad: las bandejas cuentan las recientes y la búsqueda revisa todas', async () => {
        rutearGet({
            '/conversaciones?vista=todas': { conversaciones: [conv('a')], conteos: { todas: 305 }, clasificacion_disponible: true, toma_disponible: true },
        });
        render(<Conversaciones schoolId="s1" />);
        expect(await screen.findByTestId('nota-recientes')).toHaveTextContent('Las bandejas cuentan las 1 conversaciones más recientes de 305. La búsqueda revisa todas.');
    });
});

describe('Conversaciones · hilo', () => {
    it('ventana cerrada: aviso con «Enviar mensaje aprobado» (antes no había cómo) y adjuntos en vez de «(image)»', async () => {
        const cerrada = conv('c', { ventana_abierta: false, last_inbound_at: iso(30 * 3_600_000) });
        rutearGet({
            '/conversaciones?vista=todas': { conversaciones: [cerrada], conteos: { todas: 1 }, clasificacion_disponible: true, toma_disponible: true },
            '/conversaciones/c/plantillas': { puede_enviar: true, motivo: null, motivo_texto: null, plantillas: [] },
            '/conversaciones/c': {
                conversacion: cerrada, toma_disponible: true, borradores: [],
                mensajes: [
                    { id: 'm1', direction: 'inbound', type: 'image', text_body: null, status: null, ai_generated: false, created_at: iso(30 * 3_600_000), error_detail: null,
                      media: { tipo: 'image', mime: 'image/jpeg', nombre: null, caption: null, voz: false, disponible: true } },
                    { id: 'm2', direction: 'inbound', type: 'audio', text_body: 'Ya pagué la mensualidad', status: null, ai_generated: false, created_at: iso(30 * 3_600_000), error_detail: null,
                      media: { tipo: 'audio', mime: 'audio/ogg', nombre: null, caption: null, voz: true, disponible: true } },
                ],
            },
        });
        render(<Conversaciones schoolId="s1" conversacionInicial="c" />);
        const hilo = await screen.findByTestId('hilo');
        await within(hilo).findByText('Ya pagué la mensualidad');
        expect(within(hilo).queryByText('(image)')).toBeNull();
        expect(within(hilo).getByText('Cargando foto…')).toBeInTheDocument();
        expect(within(hilo).getByText('Transcripción:')).toBeInTheDocument();
        expect(within(hilo).getByRole('button', { name: /Escuchar nota de voz/ })).toBeInTheDocument();
        const compositor = within(hilo).getByTestId('compositor');
        expect(within(compositor).getByText('Pasó más de un día sin que escriba')).toBeInTheDocument();
        fireEvent.click(within(compositor).getByRole('button', { name: /Enviar mensaje aprobado/ }));
        await waitFor(() => expect(bff.get).toHaveBeenCalledWith('/api/v1/whatsapp/s1/conversaciones/c/plantillas'));
    });

    it('ventana abierta: el compositor está y además deja enviar plantilla', async () => {
        const abierta = conv('o');
        rutearGet({
            '/conversaciones?vista=todas': { conversaciones: [abierta], conteos: { todas: 1 }, clasificacion_disponible: true, toma_disponible: true },
            '/conversaciones/o': { conversacion: abierta, toma_disponible: true, borradores: [], mensajes: [] },
        });
        render(<Conversaciones schoolId="s1" conversacionInicial="o" />);
        const compositor = await screen.findByTestId('compositor');
        expect(within(compositor).getByPlaceholderText('Escribe tu respuesta…')).toBeInTheDocument();
        expect(within(compositor).getByRole('button', { name: 'Enviar' })).toBeDisabled();
        expect(within(compositor).getByRole('button', { name: 'Enviar mensaje aprobado' })).toBeInTheDocument();
    });
});

describe('EnviarPlantilla', () => {
    const plantilla = (extra: Record<string, unknown> = {}) => ({
        nombre: 'clase_cancelada', idioma: 'es_CO', categoria: 'UTILITY', estado: 'APPROVED',
        cuerpo: 'Hola {{1}}, la clase de {{2}} fue cancelada.', variables: 2, ejemplos: ['Carolina', 'Samuel'],
        enviable: true, motivo: null, motivo_texto: null, ...extra,
    });

    it('utilidades: vista previa y nombre legible', () => {
        expect(vistaPrevia('Hola {{1}} y {{2}}', ['Ana', ''])).toBe('Hola Ana y {{2}}');
        expect(nombreLegible('pago_vence_hoy_v4')).toBe('Pago vence hoy');
    });

    it('sin consentimiento: dice por qué y no deja enviar', async () => {
        bff.get.mockResolvedValue({ puede_enviar: false, motivo: 'sin_consentimiento',
            motivo_texto: 'Esta persona no ha aceptado recibir avisos de la escuela por WhatsApp.', plantillas: [plantilla()] });
        render(<EnviarPlantilla schoolId="s1" conversacionId="c1" contacto="Ana Ruiz" abierto onAbiertoChange={() => {}} onEnviada={() => {}} />);
        expect(await screen.findByTestId('plantilla-bloqueada')).toHaveTextContent('no ha aceptado recibir avisos');
        expect(screen.getByRole('button', { name: /Clase cancelada/ })).toBeDisabled();
        expect(screen.getByRole('button', { name: /^Enviar plantilla$/ })).toBeDisabled();
        expect(bff.post).not.toHaveBeenCalled();
    });

    it('las que no se pueden mandar salen deshabilitadas con su motivo', async () => {
        bff.get.mockResolvedValue({ puede_enviar: true, motivo: null, motivo_texto: null, plantillas: [
            plantilla({ nombre: 'pago_confirmado', enviable: false, motivo: 'necesita_enlace', motivo_texto: 'Lleva un botón con enlace de pago: se envía desde Cobros, no desde el chat.' }),
        ] });
        render(<EnviarPlantilla schoolId="s1" conversacionId="c1" contacto="Ana" abierto onAbiertoChange={() => {}} onEnviada={() => {}} />);
        const b = await screen.findByRole('button', { name: /Pago confirmado/ });
        expect(b).toBeDisabled();
        expect(b).toHaveTextContent('se envía desde Cobros');
    });

    it('elige, llena los datos (el saludo con el nombre), ve la vista previa y envía', async () => {
        bff.get.mockResolvedValue({ puede_enviar: true, motivo: null, motivo_texto: null, plantillas: [plantilla()] });
        bff.post.mockResolvedValue({ ok: true });
        const enviada = vi.fn();
        render(<EnviarPlantilla schoolId="s1" conversacionId="c1" contacto="Ana Ruiz" abierto onAbiertoChange={() => {}} onEnviada={enviada} />);
        fireEvent.click(await screen.findByRole('button', { name: /Clase cancelada/ }));
        expect(screen.getByLabelText('Dato {{1}}')).toHaveValue('Ana');
        const enviar = screen.getByRole('button', { name: /^Enviar plantilla$/ });
        expect(enviar).toBeDisabled();
        fireEvent.change(screen.getByLabelText('Dato {{2}}'), { target: { value: 'Sami' } });
        expect(screen.getByTestId('plantilla-previa')).toHaveTextContent('Hola Ana, la clase de Sami fue cancelada.');
        fireEvent.click(enviar);
        await waitFor(() => expect(bff.post).toHaveBeenCalledWith('/api/v1/whatsapp/s1/conversaciones/c1/plantilla',
            { nombre: 'clase_cancelada', idioma: 'es_CO', variables: ['Ana', 'Sami'] }));
        expect(enviada).toHaveBeenCalled();
    });
});

describe('AdjuntoDelMensaje', () => {
    it('contenido personal o borrado: lo dice y no pide nada', () => {
        render(<AdjuntoDelMensaje schoolId="s" conversacionId="c" mensajeId="m"
            medio={{ tipo: 'image', mime: null, nombre: null, caption: null, voz: false, disponible: false }} />);
        expect(screen.getByTestId('adjunto-no-disponible')).toHaveTextContent('Foto · no disponible');
        expect(bff.getBlob).not.toHaveBeenCalled();
    });

    it('un PDF se baja a pedido por el BFF', async () => {
        bff.getBlob.mockResolvedValue(new Blob(['%PDF']));
        render(<AdjuntoDelMensaje schoolId="s" conversacionId="c" mensajeId="m"
            medio={{ tipo: 'document', mime: 'application/pdf', nombre: 'recibo.pdf', caption: null, voz: false, disponible: true }} />);
        fireEvent.click(screen.getByRole('button', { name: /Descargar/ }));
        await screen.findByRole('link', { name: /Abrir/ });
        expect(bff.getBlob).toHaveBeenCalledWith('/api/v1/whatsapp/s/conversaciones/c/mensajes/m/media');
    });

    it('si WhatsApp ya no lo tiene, lo explica', async () => {
        bff.getBlob.mockRejectedValue(Object.assign(new Error('no_disponible'), { status: 410 }));
        render(<AdjuntoDelMensaje schoolId="s" conversacionId="c" mensajeId="m"
            medio={{ tipo: 'audio', mime: 'audio/ogg', nombre: null, caption: null, voz: true, disponible: true }} />);
        fireEvent.click(screen.getByRole('button', { name: /Escuchar nota de voz/ }));
        expect(await screen.findByRole('status')).toHaveTextContent('WhatsApp ya no tiene este archivo.');
    });
});

describe('BandejaComprobantes · conteos y cierre en lote', () => {
    const fila = (id: string, grupo: string) => ({
        id, status: 'ignored', wa_phone_number: '573000000009', message_type: 'image', media_mime_type: 'image/jpeg',
        media_caption: null, error_message: 'contacto_no_atendido', created_at: iso(3_600_000), grupo, motivo: 'x',
        etiqueta: 'Número que no es de una familia', detalle: null, conversacion_id: null, contacto: null, archivo_url: null,
    });

    it('muestra los conteos y descarta toda una sección con un motivo', async () => {
        bff.get.mockResolvedValue({
            filas: [fila('r1', 'revisar'), fila('r2', 'revisar'), fila('a1', 'accion')],
            resumen: { accion: 1, revisar: 2, informativo: 0, total: 3 },
            cerradas_solas: 0,
            cierres_30d: { escuela: 0, automaticas: 15, total: 15 },
        });
        bff.post.mockResolvedValue({ ok: true, cerradas: ['r1', 'r2'], omitidas: 0 });
        const onCambio = vi.fn();
        render(<BandejaComprobantes schoolId="s1" onVerChat={() => {}} onCambio={onCambio} />);
        const conteos = await screen.findByTestId('conteos-bandeja');
        expect(conteos).toHaveTextContent('1 requieren tu acción');
        expect(conteos).toHaveTextContent('Cerradas en 30 días: 0 por la escuela · 15 solas');

        fireEvent.click(screen.getByRole('button', { name: 'Descartar las 2' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Contacto personal' }));
        fireEvent.click(screen.getByRole('button', { name: /Confirmar/ }));
        await waitFor(() => expect(bff.post).toHaveBeenCalledWith('/api/v1/whatsapp/s1/bandeja/cerrar-lote',
            { ids: ['r1', 'r2'], accion: 'descartado', motivo: 'Contacto personal' }));
        await waitFor(() => expect(onCambio).toHaveBeenLastCalledWith({ accion: 1, revisar: 0, informativo: 0, total: 1 }));
    });
});
