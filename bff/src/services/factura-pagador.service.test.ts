/**
 * factura-pagador — validación de los datos de factura y decisión de A NOMBRE
 * DE QUIÉN sale la factura. Puro: cero base, cero red.
 *
 * Lo que se blinda:
 *   · un documento mal escrito no se descubre hasta que la DIAN rechaza, y eso
 *     quema un número de la resolución → las reglas son las de
 *     BillingDetailsForm y las de la función SQL, ni más laxas ni más duras;
 *   · el NIT se guarda SIN dígito de verificación (lo calcula la DIAN);
 *   · un fijo no cruza como celular (podría ser el de otra familia);
 *   · sin respuesta, la emisión sigue EXACTAMENTE como antes;
 *   · consumidor final solo con el flag del facturador.
 */

import { describe, expect, it } from 'vitest';
import {
    normalizarDocumento, errorDeDocumento, correoValido, celular10, errorDeDatos,
    decidirClienteDeFactura, enmascararCorreo, CONSUMIDOR_FINAL, nombreValido,
    consumidorFinalHabilitado, envioPorCorreoHabilitado, type FilaFactura,
} from './factura-pagador.service';
import type { InvoiceCustomer } from './invoicing/types';

describe('normalizar el documento', () => {
    it('quita puntos, espacios y comas de la cédula escrita a mano', () => {
        expect(normalizarDocumento('CC', ' 1.020.304.050 ')).toBe('1020304050');
        expect(normalizarDocumento('CC', '1 020 304')).toBe('1020304');
    });
    it('el NIT pegado con su DV (con o sin guion) se guarda sin el DV', () => {
        expect(normalizarDocumento('NIT', '901.929.705-1')).toBe('901929705');
        expect(normalizarDocumento('NIT', '9019297051')).toBe('901929705');
    });
    it('un NIT de 10 dígitos que empieza en 1 (persona natural) se deja intacto', () => {
        expect(normalizarDocumento('NIT', '1020304050')).toBe('1020304050');
    });
    it('pasaporte y CE van en mayúscula', () => {
        expect(normalizarDocumento('PASAPORTE', 'av123456')).toBe('AV123456');
    });
});

describe('validar el documento', () => {
    it('acepta los rangos permisivos de cada tipo', () => {
        expect(errorDeDocumento('CC', '12345')).toBeNull();
        expect(errorDeDocumento('CC', '1020304050')).toBeNull();
        expect(errorDeDocumento('NIT', '901929705')).toBeNull();
        expect(errorDeDocumento('CE', 'E1234')).toBeNull();
    });
    it('rechaza letras en una cédula y largos imposibles', () => {
        expect(errorDeDocumento('CC', '12A45')).toMatch(/solo números/);
        expect(errorDeDocumento('CC', '1234')).toMatch(/entre 5 y 10/);
        expect(errorDeDocumento('CC', '12345678901')).toMatch(/escribiste 11/);
        expect(errorDeDocumento('CC', '')).toMatch(/Escribe/);
    });
    it('rechaza símbolos en un pasaporte', () => {
        expect(errorDeDocumento('PASAPORTE', 'AV-1234')).toMatch(/letras y números/);
    });
});

describe('correo y nombre', () => {
    it('correo válido / inválido', () => {
        expect(correoValido('papa@gmail.com')).toBe(true);
        expect(correoValido('papa@gmail')).toBe(false);
        expect(correoValido('papa gmail.com')).toBe(false);
        expect(correoValido('')).toBe(false);
    });
    it('nombre de al menos 3 caracteres', () => {
        expect(nombreValido('Al')).toBe(false);
        expect(nombreValido('  Ana  ')).toBe(true);
    });
    it('enmascara el correo sin revelar el usuario completo', () => {
        expect(enmascararCorreo('juan.perez@gmail.com')).toBe('ju•••@gmail.com');
        expect(enmascararCorreo('sin-arroba')).toBeNull();
    });
});

describe('celular de 10 dígitos', () => {
    it('cruza los tres formatos que conviven en la base', () => {
        expect(celular10('3001234567')).toBe('3001234567');
        expect(celular10('+57 300 123 4567')).toBe('3001234567');
        expect(celular10('573001234567')).toBe('3001234567');
    });
    it('un fijo NO cruza', () => {
        expect(celular10('+571024534030')).toBeNull();
        expect(celular10('6011234567')).toBeNull();
    });
});

describe('errorDeDatos (antes de ir a la base)', () => {
    it("'no_quiere' y 'sin_respuesta' no exigen datos", () => {
        expect(errorDeDatos({ preferencia: 'no_quiere' })).toBeNull();
        expect(errorDeDatos({ preferencia: 'sin_respuesta' })).toBeNull();
    });
    it("'quiere' exige tipo, documento y nombre; el correo es opcional pero si viene se valida", () => {
        const ok = { preferencia: 'quiere' as const, tipoDocumento: 'CC', numeroDocumento: '1.020.304.050', nombre: 'Ana Gómez' };
        expect(errorDeDatos(ok)).toBeNull();
        expect(errorDeDatos({ ...ok, tipoDocumento: 'XX' })).toBe('tipo_documento_invalido');
        expect(errorDeDatos({ ...ok, numeroDocumento: '12' })).toBe('documento_invalido');
        expect(errorDeDatos({ ...ok, nombre: 'A' })).toBe('nombre_invalido');
        expect(errorDeDatos({ ...ok, correo: 'malo' })).toBe('correo_invalido');
        expect(errorDeDatos({ ...ok, ciudadDane: 'Bogota' })).toBe('municipio_invalido');
    });
    it('una preferencia inventada se rechaza', () => {
        expect(errorDeDatos({ preferencia: 'tal_vez' as any })).toBe('preferencia_invalida');
    });
});

// ─── Decisión de la emisión ─────────────────────────────────────────────────

const PERFIL: InvoiceCustomer = {
    documentType: 'CC', identification: '1015418301', name: 'Juan Pérez', email: 'juan@ejemplo.co',
    phone: '3000000000', address: 'Calle 1 # 2-3', department: '11', city: '11001', municipalityCode: '11001',
};

function fila(extra: Partial<FilaFactura> = {}): FilaFactura {
    return {
        preference: 'quiere', document_type: 'NIT', document_number: '901929705',
        legal_name: 'Inversiones Pérez SAS', invoice_email: 'contabilidad@perez.co',
        address: null, city_dane: null, department: null, ...extra,
    };
}

describe('a nombre de quién sale la factura', () => {
    it("sin fila: exactamente como hoy (el perfil)", () => {
        const r = decidirClienteDeFactura({ fila: null, clientePerfil: PERFIL, consumidorFinal: false });
        expect(r).toEqual({ customer: PERFIL, origen: 'perfil' });
    });

    it("'quiere': con los datos que dejó; dirección y municipio caen a los del perfil", () => {
        const r = decidirClienteDeFactura({ fila: fila(), clientePerfil: PERFIL, consumidorFinal: false });
        expect(r.origen).toBe('preferencia');
        expect(r.customer).toMatchObject({
            documentType: 'NIT', identification: '901929705', name: 'Inversiones Pérez SAS',
            email: 'contabilidad@perez.co', address: 'Calle 1 # 2-3', municipalityCode: '11001',
        });
    });

    it("'quiere' de un acudiente SIN cuenta (sin perfil) igual factura", () => {
        const r = decidirClienteDeFactura({
            fila: fila({ document_type: 'CC', document_number: '52825050', legal_name: 'Adriana M', city_dane: '25430' }),
            clientePerfil: null, consumidorFinal: false,
        });
        expect(r.customer).toMatchObject({ identification: '52825050', municipalityCode: '25430', email: 'contabilidad@perez.co' });
    });

    it("'quiere' incompleto (sin documento) no se usa: sigue el perfil", () => {
        const r = decidirClienteDeFactura({ fila: fila({ document_number: null }), clientePerfil: PERFIL, consumidorFinal: false });
        expect(r.origen).toBe('perfil');
    });

    it("'no_quiere' sin el flag: como hoy (el perfil). Con el flag: consumidor final", () => {
        expect(decidirClienteDeFactura({ fila: fila({ preference: 'no_quiere' }), clientePerfil: PERFIL, consumidorFinal: false }).origen)
            .toBe('perfil');
        const cf = decidirClienteDeFactura({ fila: fila({ preference: 'no_quiere' }), clientePerfil: PERFIL, consumidorFinal: true });
        expect(cf.origen).toBe('consumidor_final');
        expect(cf.customer?.identification).toBe('222222222222');
        expect(cf.customer?.name).toBe('Consumidor final');
    });

    it('sin datos en ningún lado: nada, salvo el flag de consumidor final', () => {
        expect(decidirClienteDeFactura({ fila: null, clientePerfil: null, consumidorFinal: false }))
            .toEqual({ customer: null, origen: null });
        expect(decidirClienteDeFactura({ fila: null, clientePerfil: null, consumidorFinal: true }).origen)
            .toBe('consumidor_final');
    });

    it('el consumidor final que se entrega es una copia (la constante no se muta)', () => {
        const r = decidirClienteDeFactura({ fila: null, clientePerfil: null, consumidorFinal: true });
        (r.customer as any).name = 'otro';
        expect(CONSUMIDOR_FINAL.name).toBe('Consumidor final');
    });

    it('los flags del facturador solo se prenden con true explícito', () => {
        const cfg = (config: any) => ({ provider: 'factus_v2', sandbox: false, credentials: {}, config });
        expect(consumidorFinalHabilitado(cfg({}))).toBe(false);
        expect(consumidorFinalHabilitado(cfg({ consumidor_final: 'true' }))).toBe(false);
        expect(consumidorFinalHabilitado(cfg({ consumidor_final: true }))).toBe(true);
        expect(envioPorCorreoHabilitado(null)).toBe(false);
        expect(envioPorCorreoHabilitado(cfg({ enviar_factura_por_correo: true }))).toBe(true);
    });
});
