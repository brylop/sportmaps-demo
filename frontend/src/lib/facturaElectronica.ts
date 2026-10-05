/**
 * Preferencia y datos de factura electrónica del pagador — reglas compartidas
 * por el formulario de /p/:token y el de la app (Mis pagos).
 *
 * ESPEJO de bff/src/services/factura-pagador.service.ts y de la función SQL
 * factura_pagador_error_de_datos (migración 20261005133534). La validación que
 * manda es la de la base; esta es para avisar antes de enviar. Los rangos son
 * los de BillingDetailsForm (permisivos a propósito).
 */

export type PreferenciaFactura = 'quiere' | 'no_quiere' | 'sin_respuesta';

export const TIPOS_DOCUMENTO = ['CC', 'CE', 'NIT', 'PASAPORTE', 'TI', 'RC'] as const;
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

export const ETIQUETA_TIPO: Record<TipoDocumento, string> = {
    CC: 'Cédula de ciudadanía',
    CE: 'Cédula de extranjería',
    NIT: 'NIT (empresa)',
    PASAPORTE: 'Pasaporte',
    TI: 'Tarjeta de identidad',
    RC: 'Registro civil',
};

const REGLAS: Record<TipoDocumento, { soloDigitos: boolean; min: number; max: number; nombre: string }> = {
    CC: { soloDigitos: true, min: 5, max: 10, nombre: 'La cédula' },
    TI: { soloDigitos: true, min: 6, max: 11, nombre: 'La tarjeta de identidad' },
    RC: { soloDigitos: true, min: 6, max: 11, nombre: 'El registro civil' },
    NIT: { soloDigitos: true, min: 6, max: 10, nombre: 'El NIT' },
    CE: { soloDigitos: false, min: 4, max: 15, nombre: 'La cédula de extranjería' },
    PASAPORTE: { soloDigitos: false, min: 5, max: 20, nombre: 'El pasaporte' },
};

export function esTipoDocumento(t: unknown): t is TipoDocumento {
    return typeof t === 'string' && (TIPOS_DOCUMENTO as readonly string[]).includes(t);
}

/** Sin puntos/espacios, en mayúscula, NIT sin dígito de verificación. */
export function normalizarDocumento(tipo: TipoDocumento, escrito: string): string {
    let v = String(escrito ?? '').trim().replace(/[\s.,'’]/g, '').toUpperCase();
    if (tipo === 'NIT') {
        const conDv = v.match(/^(\d+)[-–—/](\d)$/);
        if (conDv) v = conDv[1];
        else if (/^[89]\d{9}$/.test(v)) v = v.slice(0, 9);
    }
    return v.replace(/[-–—]/g, '');
}

export function errorDeDocumento(tipo: TipoDocumento, numero: string): string | null {
    const r = REGLAS[tipo];
    if (!numero) return 'Escribe el número de documento.';
    if (r.soloDigitos && !/^\d+$/.test(numero)) return `${r.nombre} debe tener solo números.`;
    if (!r.soloDigitos && !/^[0-9A-Z]+$/.test(numero)) return `${r.nombre} solo admite letras y números.`;
    if (numero.length < r.min || numero.length > r.max) {
        return `${r.nombre} debe tener entre ${r.min} y ${r.max} ${r.soloDigitos ? 'dígitos' : 'caracteres'}.`;
    }
    return null;
}

export function correoValido(c: string): boolean {
    const v = c.trim();
    return v.length > 0 && v.length <= 254 && /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v);
}

export interface DatosFactura {
    preferencia: PreferenciaFactura;
    tipoDocumento?: TipoDocumento | null;
    numeroDocumento?: string | null;
    nombre?: string | null;
    correo?: string | null;
    direccion?: string | null;
    ciudadDane?: string | null;
    departamento?: string | null;
}

/** Errores por campo; vacío = se puede enviar. */
export function erroresDeDatos(d: DatosFactura): Partial<Record<'tipoDocumento' | 'numeroDocumento' | 'nombre' | 'correo', string>> {
    if (d.preferencia !== 'quiere') return {};
    const e: Partial<Record<'tipoDocumento' | 'numeroDocumento' | 'nombre' | 'correo', string>> = {};
    if (!esTipoDocumento(d.tipoDocumento)) {
        e.tipoDocumento = 'Elige el tipo de documento.';
    } else {
        const err = errorDeDocumento(d.tipoDocumento, normalizarDocumento(d.tipoDocumento, d.numeroDocumento ?? ''));
        if (err) e.numeroDocumento = err;
    }
    const nombre = (d.nombre ?? '').trim();
    if (nombre.length < 3 || nombre.length > 200) e.nombre = 'Escribe el nombre completo o la razón social.';
    if (d.correo && !correoValido(d.correo)) e.correo = 'Revisa el correo (nombre@dominio.com).';
    return e;
}

/** Resumen que devuelve el enlace público: siempre enmascarado. */
export interface ResumenFacturaPublica {
    disponible: boolean;
    pagador: boolean;
    preferencia: PreferenciaFactura;
    tieneDatos: boolean;
    tipoDocumento: string | null;
    documentoTermina: string | null;
    correoEnmascarado: string | null;
}
