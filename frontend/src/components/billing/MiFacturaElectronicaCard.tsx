/**
 * Mis pagos → «Factura electrónica»: el acudiente (o el atleta adulto) dice si
 * quiere factura a su nombre y deja/actualiza los datos. Mismo componente que
 * /p/:token (FacturaElectronicaPreferencia); acá guarda con la RPC
 * factura_pagador_guardar_mio, que toma la identidad de auth.uid() (nunca de
 * un parámetro) y valida en SQL.
 *
 * Precarga: lo que ya dejó en payer_billing_profiles (RLS: solo su fila) y, si
 * no hay, el documento del checkout (profiles) — así no re-teclea nada.
 * Si la migración no está aplicada la consulta falla y la tarjeta no aparece.
 */

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FacturaElectronicaPreferencia } from '@/components/billing/FacturaElectronicaPreferencia';
import type { MunicipalityValue } from '@/components/billing/MunicipalitySelect';
import { ETIQUETA_TIPO, esTipoDocumento, type DatosFactura, type PreferenciaFactura } from '@/lib/facturaElectronica';

interface FilaPropia {
    preference: PreferenciaFactura;
    document_type: string | null;
    document_number: string | null;
    legal_name: string | null;
    invoice_email: string | null;
    address: string | null;
    city_dane: string | null;
    department: string | null;
}

const MENSAJES: Record<string, string> = {
    tipo_documento_invalido: 'Elige el tipo de documento.',
    documento_invalido: 'Revisa el número de documento.',
    nombre_invalido: 'Escribe el nombre completo o la razón social.',
    correo_invalido: 'Revisa el correo electrónico.',
    municipio_invalido: 'Elige el municipio de la lista.',
};

export function MiFacturaElectronicaCard() {
    const { user } = useAuth();
    const [estado, setEstado] = useState<'cargando' | 'oculto' | 'listo'>('cargando');
    const [fila, setFila] = useState<FilaPropia | null>(null);
    const [iniciales, setIniciales] = useState<Partial<DatosFactura> & { municipio?: MunicipalityValue | null }>({});

    const cargar = useCallback(async () => {
        if (!user?.id) { setEstado('oculto'); return; }
        // La tabla todavía no está en los tipos generados de Supabase.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
            .from('payer_billing_profiles')
            .select('preference, document_type, document_number, legal_name, invoice_email, address, city_dane, department')
            .eq('profile_id', user.id)
            .maybeSingle();
        if (error) { setEstado('oculto'); return; }
        const propia = (data ?? null) as FilaPropia | null;
        setFila(propia);

        const { data: perfil } = await supabase
            .from('profiles')
            .select('full_name, email, document_type, document_number, billing_address, billing_city_dane, billing_state_dane')
            .eq('id', user.id)
            .maybeSingle();
        const tipo = propia?.document_type ?? perfil?.document_type ?? null;
        const ciudad = propia?.city_dane ?? (/^\d{5}$/.test(String(perfil?.billing_city_dane ?? '')) ? String(perfil?.billing_city_dane) : null);
        let municipio: MunicipalityValue | null = null;
        if (ciudad) {
            // El selector muestra nombre y departamento: se resuelve el código
            // contra el mismo catálogo diferido que usa MunicipalitySelect.
            try {
                const mod = await import('@/data/dane-municipios.json');
                const lista = (mod.default ?? mod) as Array<{ c: string; n: string; d: string }>;
                const m = lista.find((x) => x.c === ciudad);
                if (m) municipio = { code: m.c, name: m.n, department: m.d };
            } catch { /* sin catálogo: se pide de nuevo, no se pierde nada guardado */ }
        }
        setIniciales({
            tipoDocumento: esTipoDocumento(tipo) ? tipo : null,
            numeroDocumento: propia?.document_number ?? perfil?.document_number ?? '',
            nombre: propia?.legal_name ?? perfil?.full_name ?? '',
            correo: propia?.invoice_email ?? perfil?.email ?? '',
            direccion: propia?.address ?? perfil?.billing_address ?? '',
            municipio,
        });
        setEstado('listo');
    }, [user?.id]);

    useEffect(() => { void cargar(); }, [cargar]);

    if (estado !== 'listo') return null;

    const resumen = fila?.preference === 'quiere' && fila.document_number
        ? `${esTipoDocumento(fila.document_type) ? ETIQUETA_TIPO[fila.document_type] : 'Documento'} ${fila.document_number}, ${fila.legal_name ?? ''}${fila.invoice_email ? ` · ${fila.invoice_email}` : ''}`
        : null;

    return (
        <Card id="factura">
            <CardContent className="pt-6">
                <FacturaElectronicaPreferencia
                    preferencia={fila?.preference ?? 'sin_respuesta'}
                    resumenGuardado={resumen}
                    iniciales={iniciales}
                    abrirFormulario={typeof window !== 'undefined' && window.location.hash === '#factura'}
                    onGuardar={async (d) => {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const { data, error } = await (supabase.rpc as any)('factura_pagador_guardar_mio', {
                            p_preferencia: d.preferencia,
                            p_tipo: d.tipoDocumento ?? null,
                            p_numero: d.numeroDocumento ?? null,
                            p_nombre: d.nombre ?? null,
                            p_correo: d.correo ?? null,
                            p_direccion: d.direccion ?? null,
                            p_ciudad: d.ciudadDane ?? null,
                            p_depto: d.departamento ?? null,
                        });
                        if (error) return 'No pudimos guardar tus datos. Intenta de nuevo.';
                        const r = data as { ok?: boolean; error?: string } | null;
                        if (!r?.ok) return MENSAJES[r?.error ?? ''] ?? 'No pudimos guardar tus datos. Intenta de nuevo.';
                        await cargar();
                        return null;
                    }}
                />
            </CardContent>
        </Card>
    );
}
