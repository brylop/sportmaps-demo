/**
 * «¿Quieres factura electrónica?» — Sí / No y, si sí, el formulario corto.
 *
 * UN solo componente para los dos lugares donde la familia lo responde:
 *   · /p/:token (sin login): guarda por el token (PUT /public/cobro/:token/factura).
 *   · Mis pagos (con sesión): guarda con la RPC factura_pagador_guardar_mio.
 * Quién guarda lo decide `onGuardar`; este componente solo pregunta y valida.
 *
 * En la página pública NO se precarga nada guardado (el enlace se puede
 * reenviar): se muestra solo el resumen enmascarado y, para cambiar, se
 * escribe de nuevo. En la app sí se precarga: son los datos de quien inició
 * sesión. Spec: docs/specs/factura-electronica-preferencia-y-datos-del-pagador.md
 */

import { useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MunicipalitySelect, type MunicipalityValue } from '@/components/billing/MunicipalitySelect';
import {
    ETIQUETA_TIPO, TIPOS_DOCUMENTO, erroresDeDatos, normalizarDocumento, esTipoDocumento,
    type DatosFactura, type PreferenciaFactura, type TipoDocumento,
} from '@/lib/facturaElectronica';

export interface FacturaElectronicaPreferenciaProps {
    preferencia: PreferenciaFactura;
    /** Línea con lo que ya hay guardado (enmascarado en la página pública). */
    resumenGuardado?: string | null;
    /** Precarga del formulario (solo en la app, con sesión). */
    iniciales?: Partial<DatosFactura> & { municipio?: MunicipalityValue | null };
    /** Guarda; devuelve el mensaje de error para mostrar, o null si salió bien. */
    onGuardar: (datos: DatosFactura) => Promise<string | null>;
    /** Abre directo el formulario (llegó desde el correo con #factura). */
    abrirFormulario?: boolean;
}

type Campo = 'tipoDocumento' | 'numeroDocumento' | 'nombre' | 'correo';

export function FacturaElectronicaPreferencia({
    preferencia, resumenGuardado, iniciales, onGuardar, abrirFormulario,
}: FacturaElectronicaPreferenciaProps) {
    const [editando, setEditando] = useState(!!abrirFormulario && preferencia !== 'quiere');
    const [guardando, setGuardando] = useState(false);
    const [mensaje, setMensaje] = useState<{ tono: 'ok' | 'error'; texto: string } | null>(null);
    const [errores, setErrores] = useState<Partial<Record<Campo, string>>>({});

    const [tipo, setTipo] = useState<TipoDocumento>(esTipoDocumento(iniciales?.tipoDocumento) ? iniciales!.tipoDocumento as TipoDocumento : 'CC');
    const [numero, setNumero] = useState(iniciales?.numeroDocumento ?? '');
    const [nombre, setNombre] = useState(iniciales?.nombre ?? '');
    const [correo, setCorreo] = useState(iniciales?.correo ?? '');
    const [direccion, setDireccion] = useState(iniciales?.direccion ?? '');
    const [municipio, setMunicipio] = useState<MunicipalityValue | null>(iniciales?.municipio ?? null);

    const guardar = async (datos: DatosFactura) => {
        setMensaje(null);
        const e = erroresDeDatos(datos);
        setErrores(e);
        if (Object.keys(e).length > 0) return;
        setGuardando(true);
        try {
            const err = await onGuardar(datos);
            if (err) {
                setMensaje({ tono: 'error', texto: err });
            } else {
                setEditando(false);
                setMensaje({
                    tono: 'ok',
                    texto: datos.preferencia === 'quiere'
                        ? 'Listo: tus próximos pagos se facturan con estos datos.'
                        : 'Listo: no te pediremos datos de factura.',
                });
            }
        } finally {
            setGuardando(false);
        }
    };

    const enviarFormulario = (ev: React.FormEvent) => {
        ev.preventDefault();
        void guardar({
            preferencia: 'quiere',
            tipoDocumento: tipo,
            numeroDocumento: normalizarDocumento(tipo, numero),
            nombre: nombre.trim(),
            correo: correo.trim() || null,
            direccion: direccion.trim() || null,
            ciudadDane: municipio?.code ?? null,
            departamento: municipio?.department ?? null,
        });
    };

    const numeroLimpio = normalizarDocumento(tipo, numero);

    return (
        <div className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                <FileText className="h-4 w-4" /> Factura electrónica
            </h2>

            {!editando && (
                <>
                    {preferencia === 'quiere' && (
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                            Tus pagos se facturan a tu nombre{resumenGuardado ? ` (${resumenGuardado})` : ''}.
                        </p>
                    )}
                    {preferencia === 'no_quiere' && (
                        <p className="text-sm text-gray-700 dark:text-gray-300">Elegiste no recibir factura electrónica a tu nombre.</p>
                    )}
                    {preferencia === 'sin_respuesta' && (
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                            ¿Quieres factura electrónica a tu nombre por tus pagos?
                            {resumenGuardado ? <span className="block text-xs text-gray-500">Tenemos {resumenGuardado}.</span> : null}
                        </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                        {preferencia !== 'quiere' ? (
                            <Button size="sm" onClick={() => { setMensaje(null); setEditando(true); }}>Sí, quiero factura</Button>
                        ) : (
                            <Button size="sm" variant="outline" onClick={() => { setMensaje(null); setEditando(true); }}>Actualizar datos</Button>
                        )}
                        {preferencia !== 'no_quiere' && (
                            <Button size="sm" variant="ghost" disabled={guardando}
                                onClick={() => void guardar({ preferencia: 'no_quiere' })}>
                                {preferencia === 'quiere' ? 'Ya no la necesito' : 'No, gracias'}
                            </Button>
                        )}
                    </div>
                </>
            )}

            {editando && (
                <form onSubmit={enviarFormulario} className="space-y-3" noValidate>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                            <Label htmlFor="fe-tipo">Tipo de documento</Label>
                            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoDocumento)}>
                                <SelectTrigger id="fe-tipo"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {TIPOS_DOCUMENTO.map((t) => <SelectItem key={t} value={t}>{ETIQUETA_TIPO[t]}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="fe-numero">Número</Label>
                            <Input id="fe-numero" value={numero} onChange={(e) => setNumero(e.target.value)}
                                inputMode={tipo === 'CE' || tipo === 'PASAPORTE' ? 'text' : 'numeric'}
                                placeholder={tipo === 'NIT' ? 'Sin dígito de verificación' : 'Sin puntos'} autoComplete="off" />
                            {errores.numeroDocumento
                                ? <p className="text-xs text-red-600">{errores.numeroDocumento}</p>
                                : numero && numeroLimpio !== numero.trim()
                                    ? <p className="text-xs text-gray-500">Se guardará {numeroLimpio}</p>
                                    : null}
                        </div>
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="fe-nombre">{tipo === 'NIT' ? 'Razón social' : 'Nombre completo'}</Label>
                        <Input id="fe-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name" />
                        {errores.nombre && <p className="text-xs text-red-600">{errores.nombre}</p>}
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="fe-correo">Correo para la factura</Label>
                        <Input id="fe-correo" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} autoComplete="email" />
                        {errores.correo && <p className="text-xs text-red-600">{errores.correo}</p>}
                    </div>
                    <div className="space-y-1">
                        <Label>Municipio <span className="font-normal text-gray-500">(opcional)</span></Label>
                        <MunicipalitySelect value={municipio} onChange={setMunicipio} />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="fe-dir">Dirección <span className="font-normal text-gray-500">(opcional)</span></Label>
                        <Input id="fe-dir" value={direccion} onChange={(e) => setDireccion(e.target.value)} autoComplete="street-address" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button type="submit" size="sm" disabled={guardando}>
                            {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar datos
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setEditando(false)} disabled={guardando}>Cancelar</Button>
                    </div>
                </form>
            )}

            {mensaje && (
                <p className={mensaje.tono === 'ok' ? 'text-sm text-green-700' : 'text-sm text-red-600'} role="status">{mensaje.texto}</p>
            )}
        </div>
    );
}
