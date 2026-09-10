import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, FileText, Loader2, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { MunicipalitySelect, type MunicipalityValue } from '@/components/billing/MunicipalitySelect';

const DOCUMENT_TYPES = ['CC', 'CE', 'NIT', 'PASAPORTE', 'TI', 'RC'] as const;
type DocumentType = (typeof DOCUMENT_TYPES)[number];

/**
 * Reglas por tipo de documento.
 *
 * Los rangos están del lado permisivo a propósito: un documento válido que se
 * rechaza acá deja a una familia real sin poder pagar, mientras que uno raro
 * que pasa lo ataja después el propio rechazo de la DIAN. De donde salen los
 * topes: la cédula vieja llega hasta 8 dígitos y la nueva es el NUIP de 10
 * (mismo número para registro civil, tarjeta de identidad y cédula), y el NIT
 * de persona jurídica es de 9 dígitos — rangos 800000000-899999999 y desde
 * 900000000 en adelante — y se guarda SIN el dígito de verificación.
 */
const DOCUMENT_RULES: Record<DocumentType, {
    soloDigitos: boolean;
    min: number;
    max: number;
    /** Cómo se nombra en los mensajes de error, ya con su artículo. */
    nombre: string;
    placeholder: string;
}> = {
    CC:        { soloDigitos: true,  min: 5, max: 10, nombre: 'La cédula',                placeholder: 'Ej: 1020304050' },
    TI:        { soloDigitos: true,  min: 6, max: 11, nombre: 'La tarjeta de identidad',  placeholder: 'Ej: 1012345678' },
    RC:        { soloDigitos: true,  min: 6, max: 11, nombre: 'El registro civil',        placeholder: 'Ej: 1012345678' },
    NIT:       { soloDigitos: true,  min: 6, max: 10, nombre: 'El NIT',                   placeholder: 'Ej: 901929705 (sin el -1)' },
    CE:        { soloDigitos: false, min: 4, max: 15, nombre: 'La cédula de extranjería', placeholder: 'Ej: E1234567' },
    PASAPORTE: { soloDigitos: false, min: 5, max: 20, nombre: 'El pasaporte',             placeholder: 'Ej: AV123456' },
};

/** Pesos del DV del NIT que asigna la DIAN, aplicados de derecha a izquierda. */
const PESOS_DV_NIT = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];

/**
 * Dígito de verificación del NIT: suma ponderada módulo 11; el DV es el
 * residuo cuando da 0 o 1, y si no `11 - residuo`.
 *
 * Se usa SOLO para mostrarlo como ayuda y para avisar cuando el DV que
 * alguien pegó no cuadra con el número. El DV que termina en la factura lo
 * calcula la DIAN a partir del número, así que este cálculo nunca se guarda
 * ni se manda: aunque estuviera mal, no puede quemar un número de la
 * resolución.
 */
function digitoVerificacionNit(digitos: string): number | null {
    if (!/^\d+$/.test(digitos) || digitos.length > PESOS_DV_NIT.length) return null;
    const suma = digitos
        .split('')
        .reverse()
        .reduce((acc, digito, i) => acc + Number(digito) * PESOS_DV_NIT[i], 0);
    const residuo = suma % 11;
    return residuo <= 1 ? residuo : 11 - residuo;
}

type AvisoDocumento = { tono: 'info' | 'alerta'; texto: string };

/**
 * Deja el número como se va a guardar, y devuelve qué se cambió para poder
 * decirlo en pantalla.
 *
 * La gente escribe la cédula con puntos ("1.020.304.050") y pega el NIT con
 * su dígito de verificación ("901929705-1"). Rechazar eso sería
 * técnicamente correcto y humanamente inútil: se limpia, y lo que quedó se
 * pinta debajo del campo para que quien llena el formulario vea el número
 * exacto que se guarda. La validación de abajo también corre sobre ESTE
 * valor, no sobre el tecleado, para que nunca se guarde algo distinto de lo
 * que se validó.
 */
function normalizarDocumento(tipo: DocumentType, escrito: string): { valor: string; avisos: AvisoDocumento[] } {
    const avisos: AvisoDocumento[] = [];
    const crudo = (escrito ?? '').trim();
    if (!crudo) return { valor: '', avisos };

    // Separadores de miles, apóstrofos y espacios internos: nunca son parte
    // del documento, son la forma en que se escribe a mano.
    let valor = crudo.replace(/[\s.,'’]/g, '');

    if (!DOCUMENT_RULES[tipo].soloDigitos) {
        // La cédula de extranjería y el pasaporte sí traen letras; van en
        // mayúscula porque así están impresas y así se comparan después.
        valor = valor.toUpperCase();
        if (valor !== crudo) avisos.push({ tono: 'info', texto: `Se guardará ${valor}` });
        return { valor, avisos };
    }

    if (tipo === 'NIT') {
        const conSeparador = valor.match(/^(\d+)[-–—/](\d)$/);
        let dvPegado: string | null = null;
        if (conSeparador) {
            dvPegado = conSeparador[2];
            valor = conSeparador[1];
        } else if (/^[89]\d{9}$/.test(valor)) {
            // Diez dígitos que arrancan en 8 o 9 no pueden ser una cédula (las
            // de 10 dígitos son NUIP y empiezan en 1) y el NIT de empresa es de
            // 9: ese dígito de más es el de verificación, escrito sin guion. Un
            // NIT de 10 dígitos que empieza en 1 (persona natural facturando
            // con su cédula) se deja intacto justamente por eso.
            dvPegado = valor.slice(-1);
            valor = valor.slice(0, -1);
        }

        if (dvPegado !== null) {
            avisos.push({ tono: 'info', texto: `Quitamos el dígito de verificación (${dvPegado}): se guardará ${valor}.` });
            const dv = digitoVerificacionNit(valor);
            // Un DV que no cuadra casi siempre significa que el número base
            // está mal tecleado. No se bloquea (el DV que vale lo calcula la
            // DIAN), pero se dice, porque es la última oportunidad de atajarlo
            // antes de quemar una factura.
            if (dv !== null && String(dv) !== dvPegado) {
                avisos.push({
                    tono: 'alerta',
                    texto: `El dígito de verificación de ${valor} es ${dv}, no ${dvPegado}. Revisa el número antes de guardar.`,
                });
            }
        } else if (valor !== crudo) {
            avisos.push({ tono: 'info', texto: `Se guardará ${valor}` });
        }
        return { valor, avisos };
    }

    if (valor !== crudo) avisos.push({ tono: 'info', texto: `Se guardará ${valor}` });
    return { valor, avisos };
}

const billingSchema = z.object({
    // Zod 4 quito `required_error` en favor de `error`. Era el unico uso que
    // quedaba de la API vieja en todo el frontend.
    document_type: z.enum(DOCUMENT_TYPES, {
        error: 'Selecciona un tipo de documento',
    }),
    // La forma y el largo del número se validan en el `superRefine` de abajo,
    // porque la regla depende de `document_type` y un check por campo no ve
    // los otros campos. Acá queda solo que venga algo y un techo de cordura
    // para un pegado accidental.
    document_number: z.string()
        .min(1, 'Escribe el número de documento')
        .max(40, 'Eso es demasiado largo para ser un número de documento'),
    billing_address: z.string().min(5, 'Dirección inválida'),
    // `billing_city_dane` guarda el CÓDIGO DANE (5 dígitos), no el nombre: es
    // lo que la factura electrónica manda como municipality_code. Antes acá
    // entraba texto libre y el dato quedaba inservible para facturar.
    billing_state_dane: z.string().min(1, 'Selecciona el municipio'),
    billing_city_dane: z.string().regex(/^\d{4,5}$/, 'Selecciona el municipio de la lista'),
}).superRefine((data, ctx) => {
    // Un documento mal escrito no se descubre hasta que la DIAN rechaza la
    // factura, y una factura rechazada no se reemite: quema un número de la
    // resolución. Por eso la regla vive acá y no en un `min(5)` genérico.
    // Todos los issues apuntan a `document_number` para que el mensaje salga
    // donde ya está su <p> de error.
    const regla = DOCUMENT_RULES[data.document_type];
    const { valor } = normalizarDocumento(data.document_type, data.document_number);
    const problema = (message: string) => ctx.addIssue({ code: 'custom', path: ['document_number'], message });

    if (!valor) {
        problema('Escribe el número de documento');
        return;
    }

    if (regla.soloDigitos) {
        if (!/^\d+$/.test(valor)) {
            problema(
                tipoConLetras(data.document_type)
                    ? `${regla.nombre} debe tener solo números, sin puntos, guiones ni espacios. Si el documento trae letras, es cédula de extranjería o pasaporte.`
                    : `${regla.nombre} debe tener solo números, sin puntos, guiones ni espacios.`,
            );
            return;
        }
    } else if (!/^[0-9A-Z]+$/.test(valor)) {
        problema(`${regla.nombre} solo admite letras y números, sin guiones ni otros símbolos.`);
        return;
    }

    const unidad = regla.soloDigitos ? 'dígitos' : 'caracteres';
    if (valor.length < regla.min) {
        problema(`${regla.nombre} debe tener al menos ${regla.min} ${unidad} y escribiste ${valor.length}. Revisa que no falte ningún número.`);
        return;
    }
    if (valor.length > regla.max) {
        problema(`${regla.nombre} tiene máximo ${regla.max} ${unidad} y escribiste ${valor.length}. Revisa que no sobre ningún número.`);
    }
});

/** Los tipos donde una letra es señal de que se eligió el tipo equivocado. */
function tipoConLetras(tipo: DocumentType) {
    return tipo === 'CC' || tipo === 'TI' || tipo === 'RC';
}

type BillingFormValues = z.infer<typeof billingSchema>;

export function BillingDetailsForm({
    onComplete,
    userId,
    schoolId,
    payerName,
    payerKind,
}: {
    onComplete: () => void;
    /** Perfil a actualizar. Por defecto el usuario logueado (caso del checkout del propio padre). Un admin registrando un pago manual pasa el id del pagador (padre o atleta adulto). */
    userId?: string;
    /** Requerido junto a `userId`: la policy UPDATE de profiles es self-only, así que este caso pasa por la RPC admin_set_payer_billing_details (verifica que el pagador pertenezca a esta escuela). */
    schoolId?: string;
    /** Nombre del dueño del perfil que se va a actualizar. Solo se pinta en el modo admin: en el checkout propio ya se sabe de quién son los datos. */
    payerName?: string;
    /** Por qué esa persona es la que paga. Explica por qué la factura sale a su nombre y no al del deportista. */
    payerKind?: 'adult_athlete' | 'guardian';
}) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [municipio, setMunicipio] = useState<MunicipalityValue | null>(null);
    const targetUserId = userId || user?.id;
    const isAdminOnBehalf = !!userId;

    const [isLoading, setIsLoading] = useState(true);

    const form = useForm<BillingFormValues>({
        resolver: zodResolver(billingSchema),
        defaultValues: {
            document_type: 'CC',
            document_number: '',
            billing_address: '',
            billing_state_dane: '',
            billing_city_dane: '',
        },
    });

    // Precarga lo que el perfil YA tenga.
    //
    // Este formulario no siempre se abre por un perfil vacío: a un pagador le
    // puede faltar solo la dirección, o solo el municipio (en Dynasty nadie
    // tenía código DANE, porque hasta hace poco el campo era texto libre).
    // Arrancando en blanco, completar lo que falta obligaba a re-teclear el
    // documento — y un dígito distinto al re-teclearlo SOBREESCRIBE con un
    // dato malo uno que estaba bien. Es peor que el hueco que venía a tapar:
    // un documento correcto se vuelve incorrecto sin que nadie se entere hasta
    // que la DIAN rechaza la factura.
    useEffect(() => {
        if (!targetUserId) { setIsLoading(false); return; }
        let cancelled = false;

        (async () => {
            const { data } = await supabase
                .from('profiles')
                .select('document_type, document_number, billing_address, billing_state_dane, billing_city_dane')
                .eq('id', targetUserId)
                .maybeSingle();
            if (cancelled) return;

            if (data) {
                const tipo = DOCUMENT_TYPES.includes(data.document_type as DocumentType)
                    ? (data.document_type as DocumentType)
                    : 'CC';
                form.reset({
                    document_type: tipo,
                    document_number: data.document_number ?? '',
                    billing_address: data.billing_address ?? '',
                    billing_state_dane: data.billing_state_dane ?? '',
                    // Solo se precarga si ya es un código DANE. El texto libre
                    // que quedó de antes ("Medellín", "Antioquia") no sirve
                    // para facturar y dejarlo pasar como válido reviviría el
                    // bug que el selector vino a cerrar.
                    billing_city_dane: /^\d{4,5}$/.test(String(data.billing_city_dane ?? ''))
                        ? String(data.billing_city_dane)
                        : '',
                });

                // El selector muestra nombre y departamento, así que hay que
                // resolver el código contra el catálogo (el mismo import
                // diferido que usa MunicipalitySelect: si ya se cargó, sale
                // de la caché del bundler y no cuesta otra descarga).
                const codigo = String(data.billing_city_dane ?? '');
                if (/^\d{4,5}$/.test(codigo)) {
                    try {
                        const mod = await import('@/data/dane-municipios.json');
                        const lista = (mod.default ?? mod) as Array<{ c: string; n: string; d: string }>;
                        const encontrado = lista.find((m) => m.c === codigo);
                        if (!cancelled && encontrado) {
                            setMunicipio({ code: encontrado.c, name: encontrado.n, department: encontrado.d });
                        }
                    } catch {
                        // Sin catálogo el código sigue guardado en el form: se
                        // pierde el nombre en pantalla, no el dato.
                    }
                }
            }
            setIsLoading(false);
        })();

        return () => { cancelled = true; };
        // `form` es estable en react-hook-form; incluirlo re-dispararía la
        // precarga en cada render y pisaría lo que se esté escribiendo.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targetUserId]);

    // Vista previa viva de lo que se va a guardar. El campo se deja tal como
    // se teclea (reescribirlo mientras alguien escribe le mueve el cursor);
    // lo que se muestra acá abajo es el número ya limpio.
    const documentType = form.watch('document_type');
    const documentNumber = form.watch('document_number');
    const { valor: documentoNormalizado, avisos: avisosDocumento } = normalizarDocumento(documentType, documentNumber);
    // El DV se muestra solo cuando el número ya tiene largo de NIT de verdad:
    // calcularlo sobre uno a medio teclear da un dígito que cambia en cada
    // tecla y no significa nada.
    const dvNit = documentType === 'NIT' && documentoNormalizado.length >= 8
        ? digitoVerificacionNit(documentoNormalizado)
        : null;

    const onSubmit = async (data: BillingFormValues) => {
        if (!targetUserId) return;
        if (isAdminOnBehalf && !schoolId) return;
        setIsSubmitting(true);
        try {
            // Se guarda el número normalizado, nunca el tecleado: es el mismo
            // que se validó y el mismo que quedó anunciado debajo del campo.
            const documentoLimpio = normalizarDocumento(data.document_type, data.document_number).valor;

            // Self (padre en su propio checkout): UPDATE directo, cubierto por la
            // policy "auth.uid() = id". Admin llenando por otro (pago manual): esa
            // policy no aplica (self-only), va por la RPC con su propio guard de
            // alcance (el pagador debe ser padre/atleta adulto de esa escuela).
            const { error } = isAdminOnBehalf
                ? (await supabase.rpc('admin_set_payer_billing_details', {
                    p_school_id: schoolId,
                    p_user_id: targetUserId,
                    p_document_type: data.document_type,
                    p_document_number: documentoLimpio,
                    p_billing_address: data.billing_address,
                    p_billing_state_dane: data.billing_state_dane,
                    p_billing_city_dane: data.billing_city_dane,
                }))
                : (await supabase
                    .from('profiles')
                    .update({
                        document_type: data.document_type,
                        document_number: documentoLimpio,
                        billing_address: data.billing_address,
                        billing_state_dane: data.billing_state_dane,
                        billing_city_dane: data.billing_city_dane,
                    })
                    .eq('id', targetUserId));

            if (error) throw error;

            toast({
                title: 'Datos guardados',
                description: isAdminOnBehalf
                    // Con el nombre a la vista queda constancia de en qué perfil
                    // cayó el documento: registrando pagos en fila es lo único
                    // que permite darse cuenta de un cruce.
                    ? `${payerName ? `${payerName}: sus datos` : 'Los datos'} de facturación quedaron guardados con el documento ${data.document_type} ${documentoLimpio}.`
                    : 'Tu información de facturación electrónica se actualizó exitosamente.',
            });
            onComplete();
        } catch (error: unknown) {
            const err = error as { message?: string };
            toast({
                title: 'Error al guardar',
                description: err.message || 'No se pudieron guardar los datos. Inténtalo de nuevo.',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Se espera la precarga antes de pintar los campos: mostrarlos vacíos y
    // rellenarlos un instante después invita a empezar a escribir encima de un
    // dato que todavía no llegó.
    if (isLoading) {
        return (
            <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando datos de facturación…
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Alert className="bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300">
                <FileText className="h-4 w-4" />
                <AlertDescription>
                    {isAdminOnBehalf ? (
                        <>Por regulaciones de la DIAN, se necesitan los datos de facturación electrónica del pagador.</>
                    ) : (
                        <>Por regulaciones de la DIAN, necesitamos tus datos de facturación electrónica para procesar este pago.</>
                    )}
                    <br /><strong>Solo se pedirá esta información una vez — queda guardada para los próximos pagos, sin importar el medio.</strong>

                    {/* Registrando varios pagos seguidos, "los datos del pagador"
                        no alcanza: hace falta confirmar de un vistazo A QUIÉN se
                        le está guardando el documento. Un cruce acá deja la
                        cédula de una familia en el perfil de otra, y no se nota
                        hasta que la factura sale a nombre equivocado. */}
                    {isAdminOnBehalf && payerName && (
                        <div className="mt-3 rounded-lg border border-blue-300/80 bg-white/60 px-3 py-2 dark:border-blue-700/70 dark:bg-blue-950/40">
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Se guardarán en el perfil de</p>
                            <p className="flex items-center gap-1.5 text-base font-black leading-tight">
                                <User className="h-4 w-4 shrink-0" />{payerName}
                            </p>
                            {payerKind && (
                                <p className="text-[11px] opacity-80">
                                    {payerKind === 'adult_athlete'
                                        ? 'Deportista adulto: paga por sí mismo, la factura sale a su nombre.'
                                        : 'Acudiente del deportista: la factura sale a su nombre, no al del deportista.'}
                                </p>
                            )}
                        </div>
                    )}
                </AlertDescription>
            </Alert>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Tipo de Documento</Label>
                        <Select
                            // `shouldValidate` atado a isSubmitted: la regla del
                            // número depende del tipo, así que al cambiarlo hay
                            // que revalidar — pero solo si ya se intentó guardar,
                            // para no pintar errores antes de tiempo.
                            onValueChange={(val) => form.setValue('document_type', val as DocumentType, { shouldValidate: form.formState.isSubmitted })}
                            defaultValue={form.getValues('document_type')}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Tipo" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="CC">Cédula de Ciudadanía</SelectItem>
                                <SelectItem value="CE">Cédula de Extranjería</SelectItem>
                                <SelectItem value="NIT">NIT (Empresas)</SelectItem>
                                <SelectItem value="PASAPORTE">Pasaporte</SelectItem>
                                <SelectItem value="TI">Tarjeta de Identidad</SelectItem>
                                <SelectItem value="RC">Registro Civil</SelectItem>
                            </SelectContent>
                        </Select>
                        {form.formState.errors.document_type && <p className="text-xs text-red-500">{form.formState.errors.document_type.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label>Número de Documento</Label>
                        <Input
                            {...form.register('document_number')}
                            inputMode={DOCUMENT_RULES[documentType].soloDigitos ? 'numeric' : 'text'}
                            placeholder={DOCUMENT_RULES[documentType].placeholder}
                        />
                        {form.formState.errors.document_number ? (
                            <p className="text-xs text-red-500">{form.formState.errors.document_number.message}</p>
                        ) : (
                            <>
                                {avisosDocumento.map((aviso) => (
                                    aviso.tono === 'alerta' ? (
                                        <p key={aviso.texto} className="flex items-start gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{aviso.texto}
                                        </p>
                                    ) : (
                                        <p key={aviso.texto} className="text-xs text-muted-foreground">{aviso.texto}</p>
                                    )
                                ))}
                                {dvNit !== null && (
                                    <p className="text-xs text-muted-foreground">
                                        Dígito de verificación: <strong>{dvNit}</strong>. No lo escribas acá — la DIAN lo calcula.
                                    </p>
                                )}
                            </>
                        )}
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>Dirección Física</Label>
                    <Input
                        {...form.register('billing_address')}
                        placeholder="Ej: Calle 123 # 45 - 67, Apto 801"
                    />
                    {form.formState.errors.billing_address && <p className="text-xs text-red-500">{form.formState.errors.billing_address.message}</p>}
                </div>

                {/* Un solo selector en vez de dos campos de texto: el
                    departamento se deduce del municipio elegido, y lo que se
                    guarda es el código DANE que la factura necesita. */}
                <div className="space-y-2">
                    <Label>Municipio</Label>
                    <MunicipalitySelect
                        value={municipio}
                        invalid={!!form.formState.errors.billing_city_dane}
                        onChange={(m) => {
                            setMunicipio(m);
                            form.setValue('billing_city_dane', m.code, { shouldValidate: true });
                            form.setValue('billing_state_dane', m.department, { shouldValidate: true });
                        }}
                    />
                    {form.formState.errors.billing_city_dane && <p className="text-xs text-red-500">{form.formState.errors.billing_city_dane.message}</p>}
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    {isAdminOnBehalf ? 'Guardar datos de facturación' : 'Guardar y Continuar al Pago'}
                </Button>
            </form>
        </div>
    );
}
