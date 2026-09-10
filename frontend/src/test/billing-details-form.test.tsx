/**
 * Validación y normalización del documento fiscal en BillingDetailsForm.
 *
 * Por qué estas pruebas: el documento que se guarda acá es el que viaja a la
 * DIAN. Un documento mal normalizado no se descubre hasta que la factura se
 * rechaza, y una factura rechazada quema un número de la resolución. Las
 * funciones de validación son internas al componente, así que todo se afirma
 * a través del render: se escribe en el campo y se mira el mensaje, el aviso
 * de "se guardará" o el payload exacto que sale hacia Supabase.
 *
 * Cero red y cero base: `@/integrations/supabase/client`, `@/contexts/AuthContext`
 * y `@/hooks/use-toast` están moqueados.
 *
 * Truco de arranque: el tipo de documento y el municipio se inyectan por la
 * PRECARGA del perfil (el `form.reset` del useEffect), no tocando los selects
 * de Radix. Así cada prueba entra con todos los demás campos ya válidos y el
 * único error posible es el del documento — que es justo lo que se mide.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Estado compartido con los mocks. Va en vi.hoisted porque las factories de
// vi.mock se izan por encima de las declaraciones del módulo.
const h = vi.hoisted(() => ({
    /** Lo que devuelve el select de precarga del perfil. */
    perfil: null as Record<string, unknown> | null,
    /** Payloads de cada .update() sobre profiles, en orden. */
    updates: [] as Record<string, unknown>[],
    /** Argumentos de cada .rpc(), para confirmar que el camino self NO la usa. */
    rpcs: [] as unknown[][],
}));

vi.mock('@/integrations/supabase/client', () => {
    // Imita al PostgrestBuilder: encadenable y, además, "thenable", que es lo
    // que permite `await supabase.from(x).update(y).eq(...)`.
    const builder: Record<string, unknown> = {};
    Object.assign(builder, {
        select: () => builder,
        eq: () => builder,
        update: (payload: Record<string, unknown>) => { h.updates.push(payload); return builder; },
        maybeSingle: () => Promise.resolve({ data: h.perfil, error: null }),
        then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) =>
            Promise.resolve({ data: null, error: null }).then(ok, ko),
    });
    return {
        supabase: {
            from: () => builder,
            rpc: (...args: unknown[]) => { h.rpcs.push(args); return Promise.resolve({ data: null, error: null }); },
        },
    };
});

vi.mock('@/contexts/AuthContext', () => ({
    useAuth: () => ({ user: { id: 'padre-1' } }),
}));

vi.mock('@/hooks/use-toast', () => ({
    useToast: () => ({ toast: vi.fn() }),
}));

import { BillingDetailsForm } from '@/components/billing/BillingDetailsForm';

// (El stub local de ResizeObserver que vivía acá se movió a `setup.ts`, donde
// estaba el defecto: el mock compartido era una arrow function y `new` sobre
// una arrow lanza «is not a constructor». Reventaba cualquier prueba que
// abriera un Popover o un Select de Radix, no solo esta.)

/** Placeholder del campo de documento según el tipo (así se localiza el input). */
const PLACEHOLDER: Record<string, RegExp> = {
    CC: /Ej: 1020304050/,
    NIT: /Ej: 901929705/,
    CE: /Ej: E1234567/,
};

/**
 * Renderiza el formulario con el perfil ya precargado y espera a que salga
 * del estado "Cargando" (si no, no hay campos que tocar).
 */
async function renderFormulario(perfil: Record<string, unknown> = {}) {
    h.perfil = {
        document_type: 'CC',
        document_number: '',
        // Dirección y municipio ya válidos: el submit solo puede fallar por el
        // documento, que es lo que se está midiendo.
        billing_address: 'Calle 123 # 45 - 67',
        billing_state_dane: 'Antioquia',
        billing_city_dane: '05001',
        ...perfil,
    };
    const onComplete = vi.fn();
    const usuario = userEvent.setup();
    render(<BillingDetailsForm onComplete={onComplete} />);

    await waitFor(() => {
        expect(screen.queryByText(/Cargando datos de facturación/)).not.toBeInTheDocument();
    });
    return { onComplete, usuario };
}

function campoDocumento(tipo: keyof typeof PLACEHOLDER) {
    return screen.getByPlaceholderText(PLACEHOLDER[tipo]);
}

function botonGuardar() {
    return screen.getByRole('button', { name: /Guardar y Continuar al Pago/i });
}

describe('BillingDetailsForm — documento fiscal', () => {
    beforeEach(() => {
        h.perfil = null;
        h.updates = [];
        h.rpcs = [];
    });

    it('la cédula de 10 dígitos limpia se guarda tal cual y sin avisos de cambio', async () => {
        const { usuario, onComplete } = await renderFormulario();

        await usuario.type(campoDocumento('CC'), '1020304050');
        // Nada que normalizar: no debe anunciar ningún cambio.
        expect(screen.queryByText(/Se guardará/)).not.toBeInTheDocument();

        await usuario.click(botonGuardar());

        await waitFor(() => expect(onComplete).toHaveBeenCalled());
        expect(h.updates).toHaveLength(1);
        expect(h.updates[0].document_number).toBe('1020304050');
        expect(h.updates[0].document_type).toBe('CC');
    });

    it('la cédula escrita con puntos se anuncia y se guarda sin los puntos', async () => {
        const { usuario, onComplete } = await renderFormulario();

        await usuario.type(campoDocumento('CC'), '1.020.304.050');

        // El campo conserva lo tecleado (reescribirlo movería el cursor), pero
        // debajo se anuncia el número exacto que se va a guardar.
        expect(campoDocumento('CC')).toHaveValue('1.020.304.050');
        expect(screen.getByText(/Se guardará 1020304050/)).toBeInTheDocument();

        await usuario.click(botonGuardar());

        await waitFor(() => expect(onComplete).toHaveBeenCalled());
        // Lo que se guarda es el normalizado, no lo tecleado. Guardar
        // "1.020.304.050" es el bug que esta prueba blinda.
        expect(h.updates[0].document_number).toBe('1020304050');
    });

    it('una cédula con letras se rechaza diciendo que debe tener solo números', async () => {
        const { usuario, onComplete } = await renderFormulario();

        await usuario.type(campoDocumento('CC'), 'abc123');
        await usuario.click(botonGuardar());

        // 'abc123' pasa cualquier min(5) genérico: el mensaje tiene que hablar
        // de números, y nada puede haber salido hacia la base.
        const error = await screen.findByText(/debe tener solo números/i);
        expect(error).toBeInTheDocument();
        expect(h.updates).toHaveLength(0);
        expect(onComplete).not.toHaveBeenCalled();
    });

    it('el NIT de 9 dígitos es válido y muestra 0 como dígito de verificación', async () => {
        const { usuario, onComplete } = await renderFormulario({ document_type: 'NIT' });

        await usuario.type(campoDocumento('NIT'), '901929705');

        // DV de 901929705 = 0 (suma ponderada mod 11 = 0).
        expect(screen.getByText(/Dígito de verificación:/)).toHaveTextContent(/Dígito de verificación:\s*0\./);
        expect(screen.queryByText(/Se guardará/)).not.toBeInTheDocument();

        await usuario.click(botonGuardar());

        await waitFor(() => expect(onComplete).toHaveBeenCalled());
        expect(h.updates[0].document_number).toBe('901929705');
        expect(h.updates[0].document_type).toBe('NIT');
    });

    it('el NIT pegado con su dígito de verificación lo pierde y avisa cuál es el correcto', async () => {
        const { usuario, onComplete } = await renderFormulario({ document_type: 'NIT' });

        await usuario.type(campoDocumento('NIT'), '901929705-1');

        expect(screen.getByText(/Quitamos el dígito de verificación \(1\).*se guardará 901929705/)).toBeInTheDocument();
        // El DV real es 0: se avisa que el pegado no cuadra…
        expect(screen.getByText(/El dígito de verificación de 901929705 es 0, no 1/)).toBeInTheDocument();

        // …pero NO bloquea: el DV que vale lo calcula la DIAN.
        await usuario.click(botonGuardar());

        await waitFor(() => expect(onComplete).toHaveBeenCalled());
        expect(h.updates[0].document_number).toBe('901929705');
    });

    it('el NIT de 10 dígitos que empieza en 8 pierde el último como DV y no genera alerta si cuadra', async () => {
        const { usuario, onComplete } = await renderFormulario({ document_type: 'NIT' });

        // Bancolombia: 890903938 con DV 8, pegado sin guion.
        await usuario.type(campoDocumento('NIT'), '8909039388');

        expect(screen.getByText(/Quitamos el dígito de verificación \(8\).*se guardará 890903938/)).toBeInTheDocument();
        // El DV pegado coincide con el calculado: nada que advertir.
        expect(screen.queryByText(/Revisa el número antes de guardar/)).not.toBeInTheDocument();

        await usuario.click(botonGuardar());

        await waitFor(() => expect(onComplete).toHaveBeenCalled());
        expect(h.updates[0].document_number).toBe('890903938');
    });

    it('la cédula de extranjería admite letras y se guarda en mayúscula', async () => {
        const { usuario, onComplete } = await renderFormulario({ document_type: 'CE' });

        await usuario.type(campoDocumento('CE'), 'E1234567');
        expect(screen.queryByText(/debe tener solo números/i)).not.toBeInTheDocument();

        await usuario.click(botonGuardar());

        await waitFor(() => expect(onComplete).toHaveBeenCalled());
        expect(h.updates[0].document_number).toBe('E1234567');
        expect(h.updates[0].document_type).toBe('CE');
    });

    it('el documento vacío se rechaza y no llega nada a la base', async () => {
        const { usuario, onComplete } = await renderFormulario();

        await usuario.click(botonGuardar());

        expect(await screen.findByText(/Escribe el número de documento/)).toBeInTheDocument();
        expect(h.updates).toHaveLength(0);
        expect(onComplete).not.toHaveBeenCalled();
    });

    it('un documento de puros espacios se rechaza como vacío', async () => {
        const { usuario, onComplete } = await renderFormulario();

        // Cinco espacios pasan un min(5) sobre el texto tecleado; sobre el
        // normalizado son un documento vacío.
        await usuario.type(campoDocumento('CC'), '     ');
        await usuario.click(botonGuardar());

        expect(await screen.findByText(/Escribe el número de documento/)).toBeInTheDocument();
        expect(h.updates).toHaveLength(0);
        expect(onComplete).not.toHaveBeenCalled();
    });

    it('la cédula con un espacio en la mitad se guarda sin el espacio', async () => {
        const { usuario, onComplete } = await renderFormulario();

        await usuario.type(campoDocumento('CC'), '1020 304050');
        expect(screen.getByText(/Se guardará 1020304050/)).toBeInTheDocument();

        await usuario.click(botonGuardar());

        await waitFor(() => expect(onComplete).toHaveBeenCalled());
        expect(h.updates[0].document_number).toBe('1020304050');
    });

    it('el municipio elegido se guarda como código DANE, no como nombre', async () => {
        // Se entra sin municipio para tener que elegirlo en el selector.
        const { usuario, onComplete } = await renderFormulario({
            document_number: '1020304050',
            billing_state_dane: '',
            billing_city_dane: '',
        });

        // Se busca por el texto visible del trigger: hay dos elementos con rol
        // combobox (el del tipo de documento también) y ninguno tiene nombre
        // accesible, así que getByRole no los distingue.
        await usuario.click(screen.getByText('Busca tu municipio'));
        const opcion = await screen.findByRole('button', { name: /Medellin/i });
        await usuario.click(opcion);

        await usuario.click(botonGuardar());

        await waitFor(() => expect(onComplete).toHaveBeenCalled());
        // El código con su cero inicial, como STRING: 5001 es un municipio
        // inexistente y "Medellin" no sirve para facturar.
        expect(h.updates[0].billing_city_dane).toBe('05001');
        expect(h.updates[0].billing_state_dane).toBe('Antioquia');
    });

    it('el texto libre que quedó de antes en el municipio no se precarga como válido', async () => {
        // Perfiles viejos guardaban "Medellín" en billing_city_dane. Aceptarlo
        // como precargado reviviría el bug que el selector vino a cerrar.
        const { usuario, onComplete } = await renderFormulario({
            document_number: '1020304050',
            billing_city_dane: 'Medellín',
        });

        await usuario.click(botonGuardar());

        expect(await screen.findByText(/Selecciona el municipio de la lista/)).toBeInTheDocument();
        expect(h.updates).toHaveLength(0);
        expect(onComplete).not.toHaveBeenCalled();
    });
});
