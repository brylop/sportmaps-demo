/**
 * Tipo de contacto (2026-10-13): marcar números que no son familias desde el
 * buzón y la bandeja, sugerencias y ráfagas. Datos inventados; el BFF está
 * moqueado (no sale ningún mensaje ni se escribe en ninguna base).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

const bff = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), getBlob: vi.fn() }));
vi.mock('@/lib/api/bffClient', () => ({ bffClient: bff }));
const toastEstable = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => toastEstable }));

import { BandejaComprobantes } from './BandejaComprobantes';
import { Conversaciones } from './Conversaciones';
import { TipoDeContactoDialog } from './TipoDeContactoDialog';
import { agruparRafagas, diaBogota, textoDeRafaga } from './bandejaRafagas';
import { esSoloNoFamilia, pedidoDeTipo, textoDelResultado } from './tipoDeContacto';

const ahora = Date.now();
const iso = (msAtras: number) => new Date(ahora - msAtras).toISOString();

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
});

describe('bandejaRafagas', () => {
    const f = (id: string, tel: string, creada: string, motivo = 'contacto_no_atendido') =>
        ({ id, wa_phone_number: tel, created_at: creada, motivo, message_type: 'image', media_mime_type: 'image/jpeg' });

    it('mismo número, día y motivo desde 3 filas = una ráfaga en el lugar de la primera', () => {
        const filas = [
            f('a1', '573000000001', '2026-10-09T20:00:00Z'),
            f('b1', '573000000002', '2026-10-09T20:05:00Z'),
            f('a2', '573000000001', '2026-10-09T21:00:00Z'),
            f('a3', '573000000001', '2026-10-09T22:00:00Z'),
            f('a4', '573000000001', '2026-10-09T22:30:00Z', 'no_es_comprobante'),
        ];
        const bloques = agruparRafagas(filas);
        expect(bloques.map((b) => (b.tipo === 'rafaga' ? b.filas.map((x) => x.id).join('+') : b.fila.id)))
            .toEqual(['a1+a2+a3', 'b1', 'a4']);
    });

    it('dos filas no son ráfaga; otro día (hora de Bogotá) tampoco junta', () => {
        // 04:30 UTC del 10 = 23:30 del 9 en Bogotá.
        expect(diaBogota('2026-10-10T04:30:00Z')).toBe('2026-10-09');
        const filas = [f('x0', '573000000003', '2026-10-09T14:00:00Z'), f('x1', '573000000003', '2026-10-09T15:00:00Z'),
            f('x2', '573000000003', '2026-10-10T04:30:00Z'), f('x3', '573000000003', '2026-10-10T15:00:00Z')];
        const bloques = agruparRafagas(filas);
        expect(bloques.map((b) => (b.tipo === 'rafaga' ? b.filas.map((x) => x.id).join('+') : b.fila.id)))
            .toEqual(['x0+x1+x2', 'x3']);
        expect(agruparRafagas(filas.slice(1)).every((b) => b.tipo === 'fila')).toBe(true);
    });

    it('el contador dice fotos o archivos', () => {
        expect(textoDeRafaga([f('a', '1', iso(0)), f('b', '1', iso(0))])).toBe('2 fotos de este número');
        expect(textoDeRafaga([{ ...f('a', '1', iso(0)), message_type: 'document', media_mime_type: 'application/pdf' }]))
            .toBe('1 archivos de este número');
    });
});

describe('tipoDeContacto', () => {
    it('familia nunca lleva «también es familia»', () => {
        expect(pedidoDeTipo('s1', 'c1', 'familia', true)).toEqual({
            ruta: '/api/v1/whatsapp/s1/conversaciones/c1/tipo', cuerpo: { tipo: 'familia', tambien_familia: false } });
        expect(pedidoDeTipo('s1', 'c1', 'personal', true).cuerpo).toEqual({ tipo: 'personal', tambien_familia: true });
    });
    it('sin contenido = marca sin bandera', () => {
        expect(esSoloNoFamilia('negocio', false)).toBe(true);
        expect(esSoloNoFamilia('personal', true)).toBe(false);
        expect(esSoloNoFamilia('familia', false)).toBe(false);
    });
    it('el aviso cuenta las filas cerradas', () => {
        expect(textoDelResultado('otro_club', 3).description).toMatch(/Se cerraron 3 filas/);
        expect(textoDelResultado('familia', 0).title).toBe('Se quitó la marca');
    });
});

describe('TipoDeContactoDialog', () => {
    it('elige negocio, marca «también es familia» y guarda', async () => {
        bff.patch.mockResolvedValue({ ok: true, contact_kind: 'negocio', tambien_familia: true, filas_cerradas: 2 });
        const hecho = vi.fn();
        render(<TipoDeContactoDialog schoolId="s1" conversacionId="c1" nombre="Pedro" tipoInicial="personal"
            abierto onAbiertoChange={() => {}} onHecho={hecho} />);
        const grupo = screen.getByRole('radiogroup', { name: 'Tipo de contacto' });
        expect(within(grupo).getByRole('radio', { name: /Personal/ })).toHaveAttribute('aria-checked', 'true');
        fireEvent.click(within(grupo).getByRole('radio', { name: /Negocio/ }));
        fireEvent.click(screen.getByRole('checkbox', { name: /También es familia/ }));
        fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
        await waitFor(() => expect(bff.patch).toHaveBeenCalledWith('/api/v1/whatsapp/s1/conversaciones/c1/tipo',
            { tipo: 'negocio', tambien_familia: true }));
        expect(hecho).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'negocio', tambienFamilia: true, filas_cerradas: 2 }));
    });

    it('con «Familia» la casilla queda deshabilitada', () => {
        render(<TipoDeContactoDialog schoolId="s1" conversacionId="c1" nombre="Ana" tipoInicial="familia"
            abierto onAbiertoChange={() => {}} onHecho={() => {}} />);
        expect(screen.getByRole('checkbox', { name: /También es familia/ })).toBeDisabled();
    });
});

describe('BandejaComprobantes · marcar, sugerencias y ráfagas', () => {
    const fila = (id: string, extra: Record<string, unknown> = {}) => ({
        id, status: 'ignored', wa_phone_number: '573000000050', message_type: 'image', media_mime_type: 'image/jpeg',
        media_caption: null, error_message: 'contacto_no_atendido', created_at: iso(3_600_000), grupo: 'revisar',
        motivo: 'contacto_no_atendido', etiqueta: 'Número que no es de una familia', detalle: null,
        conversacion_id: 'conv-prov', contacto: 'Proveedor Prueba', archivo_url: null, tipo_contacto: 'desconocido', ...extra,
    });
    const respuesta = (extra: Record<string, unknown> = {}) => ({
        filas: [fila('p1'), fila('p2'), fila('p3'), fila('p4'),
            fila('m1', { wa_phone_number: '573000000060', conversacion_id: 'conv-mama', contacto: 'Mamá Prueba',
                grupo: 'accion', motivo: 'varios_cobros', etiqueta: 'Hay varios cobros posibles', tipo_contacto: 'familia' })],
        resumen: { accion: 1, revisar: 4, informativo: 0, total: 5 },
        cerradas_solas: 0,
        cierres_30d: null,
        sugerencias_marca: [{ wa_phone_number: '573000000050', conversacion_id: 'conv-prov', contacto: 'Proveedor Prueba',
            motivo: 'rafaga', adjuntos_24h: 4, filas: 4, tipo_sugerido: 'negocio' }],
        ...extra,
    });

    it('la ráfaga sale como una tarjeta con contador y se descarta en lote', async () => {
        bff.get.mockResolvedValue(respuesta({ sugerencias_marca: [] }));
        bff.post.mockResolvedValue({ ok: true, cerradas: ['p1', 'p2', 'p3', 'p4'], omitidas: 0 });
        render(<BandejaComprobantes schoolId="s1" onVerChat={() => {}} />);
        const tarjeta = await screen.findByTestId('rafaga');
        expect(tarjeta).toHaveTextContent('4 fotos de este número');
        // Una sola tarjeta, no cuatro.
        expect(screen.getAllByText('Proveedor Prueba')).toHaveLength(1);
        fireEvent.click(within(tarjeta).getByRole('button', { name: 'Descartar estas 4' }));
        fireEvent.click(await screen.findByRole('button', { name: 'No es un pago de la escuela' }));
        fireEvent.click(screen.getByRole('button', { name: /Confirmar/ }));
        await waitFor(() => expect(bff.post).toHaveBeenCalledWith('/api/v1/whatsapp/s1/bandeja/cerrar-lote',
            { ids: ['p1', 'p2', 'p3', 'p4'], accion: 'descartado', motivo: 'No es un pago de la escuela' }));
    });

    it('«Ver una por una» abre las filas de la ráfaga', async () => {
        bff.get.mockResolvedValue(respuesta({ sugerencias_marca: [] }));
        render(<BandejaComprobantes schoolId="s1" onVerChat={() => {}} />);
        const tarjeta = await screen.findByTestId('rafaga');
        fireEvent.click(within(tarjeta).getByRole('button', { name: /Ver una por una/ }));
        expect(within(tarjeta).getAllByRole('button', { name: /Marcar resuelto/ })).toHaveLength(4);
    });

    it('la sugerencia NO marca sola: abre el diálogo con negocio y marca al guardar', async () => {
        bff.get.mockResolvedValue(respuesta());
        bff.patch.mockResolvedValue({ ok: true, contact_kind: 'negocio', tambien_familia: false, filas_cerradas: 4 });
        render(<BandejaComprobantes schoolId="s1" onVerChat={() => {}} />);
        const sug = await screen.findByTestId('sugerencias-marca');
        expect(sug).toHaveTextContent('4 archivos en 24 horas');
        expect(bff.patch).not.toHaveBeenCalled();
        fireEvent.click(within(sug).getByRole('button', { name: /Marcar como negocio/ }));
        const grupo = await screen.findByRole('radiogroup', { name: 'Tipo de contacto' });
        expect(within(grupo).getByRole('radio', { name: /Negocio/ })).toHaveAttribute('aria-checked', 'true');
        bff.get.mockResolvedValue(respuesta({ filas: [], resumen: { accion: 0, revisar: 0, informativo: 0, total: 0 }, sugerencias_marca: [] }));
        fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
        await waitFor(() => expect(bff.patch).toHaveBeenCalledWith('/api/v1/whatsapp/s1/conversaciones/conv-prov/tipo',
            { tipo: 'negocio', tambien_familia: false }));
        // Recarga: las filas de ese número ya no están.
        await waitFor(() => expect(screen.queryByTestId('rafaga')).toBeNull());
    });

    it('«Ahora no» oculta la sugerencia sin llamar al BFF', async () => {
        bff.get.mockResolvedValue(respuesta());
        render(<BandejaComprobantes schoolId="s1" onVerChat={() => {}} />);
        const sug = await screen.findByTestId('sugerencias-marca');
        fireEvent.click(within(sug).getByRole('button', { name: /Ahora no/ }));
        expect(screen.queryByTestId('sugerencias-marca')).toBeNull();
        expect(bff.patch).not.toHaveBeenCalled();
    });

    it('desde la tarjeta de una familia: «Tipo de contacto» abre el selector', async () => {
        bff.get.mockResolvedValue(respuesta({ sugerencias_marca: [] }));
        render(<BandejaComprobantes schoolId="s1" onVerChat={() => {}} />);
        await screen.findByText('Mamá Prueba');
        const botones = screen.getAllByRole('button', { name: /Tipo de contacto/ });
        fireEvent.click(botones[0]);
        expect(await screen.findByRole('radiogroup', { name: 'Tipo de contacto' })).toBeInTheDocument();
    });
});

describe('Conversaciones · tipo de contacto en el hilo', () => {
    const conv = (id: string, extra: Record<string, unknown> = {}) => ({
        id, contact_wa_id: '573000000060', contact_name: `Contacto ${id}`, identified: true, status: 'open',
        unread_count: 0, last_message_at: iso(60_000), last_inbound_at: iso(60_000), ventana_abierta: true,
        ventana_vence: iso(-20 * 3_600_000), ultimo_mensaje: { direction: 'inbound', text_body: 'Hola', type: 'text', created_at: iso(60_000), ai_generated: false },
        borradores_pendientes: 0, contact_kind: 'familia', requiere_respuesta: true, ...extra,
    });
    function rutear(c: Record<string, unknown>) {
        bff.get.mockImplementation(async (path: string) => {
            if (path.includes('/conversaciones?vista=')) return { conversaciones: [c], conteos: { todas: 1, familias: 1, otros: 0 }, clasificacion_disponible: true, toma_disponible: true };
            if (path.includes(`/conversaciones/${c.id}`)) return { conversacion: c, toma_disponible: true, borradores: [], mensajes: [] };
            throw Object.assign(new Error('no encontrado'), { status: 404 });
        });
    }

    it('«Tipo de contacto» reemplaza a «Es personal» y guarda personal + también es familia', async () => {
        const c = conv('g');
        rutear(c);
        bff.patch.mockResolvedValue({ ok: true, contact_kind: 'personal', tambien_familia: true, filas_cerradas: 0 });
        render(<Conversaciones schoolId="s1" conversacionInicial="g" />);
        const hilo = await screen.findByTestId('hilo');
        expect(within(hilo).queryByRole('button', { name: /Es personal/ })).toBeNull();
        fireEvent.click(within(hilo).getByRole('button', { name: /Tipo de contacto/ }));
        const grupo = await screen.findByRole('radiogroup', { name: 'Tipo de contacto' });
        fireEvent.click(within(grupo).getByRole('radio', { name: /Personal/ }));
        fireEvent.click(screen.getByRole('checkbox', { name: /También es familia/ }));
        fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
        await waitFor(() => expect(bff.patch).toHaveBeenCalledWith('/api/v1/whatsapp/s1/conversaciones/g/tipo',
            { tipo: 'personal', tambien_familia: true }));
    });

    it('un contacto marcado negocio dice que el asistente no le responde', async () => {
        rutear(conv('n', { contact_kind: 'negocio' }));
        render(<Conversaciones schoolId="s1" conversacionInicial="n" />);
        const hilo = await screen.findByTestId('hilo');
        expect(await within(hilo).findByText(/Contacto marcado como negocio/)).toBeInTheDocument();
    });
});
