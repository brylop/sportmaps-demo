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

const billingSchema = z.object({
    document_type: z.enum(['CC', 'CE', 'NIT', 'PASAPORTE', 'TI', 'RC'], {
        required_error: 'Selecciona un tipo de documento',
    }),
    document_number: z.string().min(5, 'Número de documento inválido').max(20),
    billing_address: z.string().min(5, 'Dirección inválida'),
    billing_state_dane: z.string().min(1, 'Agrega el departamento'),
    billing_city_dane: z.string().min(1, 'Agrega la ciudad/municipio'),
});

type BillingFormValues = z.infer<typeof billingSchema>;

export function BillingDetailsForm({ onComplete }: { onComplete: () => void }) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

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
        if (!user) return;
        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    document_type: data.document_type,
                    document_number: data.document_number,
                    billing_address: data.billing_address,
                    billing_state_dane: data.billing_state_dane,
                    billing_city_dane: data.billing_city_dane,
                })
                .eq('id', user.id);

            if (error) throw error;

            toast({
                title: 'Datos guardados',
                description: 'Tu información de facturación electrónica se actualizó exitosamente.',
            });
            onComplete();
        } catch (error: unknown) {
            const err = error as { message?: string };
            toast({
                title: 'Error al guardar',
                description: err.message || 'No se pudieron guardar tus datos. Inténtalo de nuevo.',
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
                    Por regulaciones de la DIAN, necesitamos tus datos de facturación electrónica para procesar este pago.
                    <br /><strong>Solo te pediremos esta información una vez.</strong>
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

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Departamento</Label>
                        <Input
                            {...form.register('billing_state_dane')}
                            placeholder="Ej: Bogotá D.C. / Antioquia"
                        />
                        {form.formState.errors.billing_state_dane && <p className="text-xs text-red-500">{form.formState.errors.billing_state_dane.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label>Municipio / Ciudad</Label>
                        <Input
                            {...form.register('billing_city_dane')}
                            placeholder="Ej: Bogotá / Medellín"
                        />
                        {form.formState.errors.billing_city_dane && <p className="text-xs text-red-500">{form.formState.errors.billing_city_dane.message}</p>}
                    </div>
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Guardar y Continuar al Pago
                </Button>
            </form>
        </div>
    );
}
