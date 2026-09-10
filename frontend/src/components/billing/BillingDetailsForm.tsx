import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileText, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { MunicipalitySelect, type MunicipalityValue } from '@/components/billing/MunicipalitySelect';

const billingSchema = z.object({
    // Zod 4 quito `required_error` en favor de `error`. Era el unico uso que
    // quedaba de la API vieja en todo el frontend.
    document_type: z.enum(['CC', 'CE', 'NIT', 'PASAPORTE', 'TI', 'RC'], {
        error: 'Selecciona un tipo de documento',
    }),
    document_number: z.string().min(5, 'Número de documento inválido').max(20),
    billing_address: z.string().min(5, 'Dirección inválida'),
    // `billing_city_dane` guarda el CÓDIGO DANE (5 dígitos), no el nombre: es
    // lo que la factura electrónica manda como municipality_code. Antes acá
    // entraba texto libre y el dato quedaba inservible para facturar.
    billing_state_dane: z.string().min(1, 'Selecciona el municipio'),
    billing_city_dane: z.string().regex(/^\d{4,5}$/, 'Selecciona el municipio de la lista'),
});

type BillingFormValues = z.infer<typeof billingSchema>;

export function BillingDetailsForm({
    onComplete,
    userId,
    schoolId,
}: {
    onComplete: () => void;
    /** Perfil a actualizar. Por defecto el usuario logueado (caso del checkout del propio padre). Un admin registrando un pago manual pasa el id del pagador (padre o atleta adulto). */
    userId?: string;
    /** Requerido junto a `userId`: la policy UPDATE de profiles es self-only, así que este caso pasa por la RPC admin_set_payer_billing_details (verifica que el pagador pertenezca a esta escuela). */
    schoolId?: string;
}) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [municipio, setMunicipio] = useState<MunicipalityValue | null>(null);
    const targetUserId = userId || user?.id;
    const isAdminOnBehalf = !!userId;

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

    const onSubmit = async (data: BillingFormValues) => {
        if (!targetUserId) return;
        if (isAdminOnBehalf && !schoolId) return;
        setIsSubmitting(true);
        try {
            // Self (padre en su propio checkout): UPDATE directo, cubierto por la
            // policy "auth.uid() = id". Admin llenando por otro (pago manual): esa
            // policy no aplica (self-only), va por la RPC con su propio guard de
            // alcance (el pagador debe ser padre/atleta adulto de esa escuela).
            const { error } = isAdminOnBehalf
                ? (await supabase.rpc('admin_set_payer_billing_details', {
                    p_school_id: schoolId,
                    p_user_id: targetUserId,
                    p_document_type: data.document_type,
                    p_document_number: data.document_number,
                    p_billing_address: data.billing_address,
                    p_billing_state_dane: data.billing_state_dane,
                    p_billing_city_dane: data.billing_city_dane,
                }))
                : (await supabase
                    .from('profiles')
                    .update({
                        document_type: data.document_type,
                        document_number: data.document_number,
                        billing_address: data.billing_address,
                        billing_state_dane: data.billing_state_dane,
                        billing_city_dane: data.billing_city_dane,
                    })
                    .eq('id', targetUserId));

            if (error) throw error;

            toast({
                title: 'Datos guardados',
                description: isAdminOnBehalf
                    ? 'Los datos de facturación del pagador quedaron guardados.'
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
                </AlertDescription>
            </Alert>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Tipo de Documento</Label>
                        <Select
                            onValueChange={(val) => form.setValue('document_type', val as BillingFormValues['document_type'])}
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
                            placeholder="Sin puntos ni espacios"
                        />
                        {form.formState.errors.document_number && <p className="text-xs text-red-500">{form.formState.errors.document_number.message}</p>}
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
