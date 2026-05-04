/**
 * CartCheckoutModal — Modal de checkout del shop con Wompi.
 *
 * Recoge datos de envio y contacto, llama al BFF para crear la orden,
 * y abre el Widget de Wompi via useWompiCheckout. El descuento de stock,
 * la actualizacion de la orden y la notificacion al merchant se hacen
 * en el webhook del BFF.
 */

import { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Loader2, MapPin, Phone, Mail, User, ShoppingBag, CheckCircle2 } from 'lucide-react';
import { useWompiCheckout } from '@/hooks/useWompiCheckout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const DEPARTAMENTOS_COLOMBIA = [
    'Amazonas', 'Antioquia', 'Arauca', 'Atlantico', 'Bogota DC', 'Bolivar',
    'Boyaca', 'Caldas', 'Caqueta', 'Casanare', 'Cauca', 'Cesar', 'Choco',
    'Cordoba', 'Cundinamarca', 'Guainia', 'Guaviare', 'Huila', 'La Guajira',
    'Magdalena', 'Meta', 'Narino', 'Norte de Santander', 'Putumayo', 'Quindio',
    'Risaralda', 'San Andres', 'Santander', 'Sucre', 'Tolima', 'Valle del Cauca',
    'Vaupes', 'Vichada',
];

interface CartLine {
    productId: string;
    variantId?: string;
    name: string;
    quantity: number;
    unitPrice: number;
}

interface CartCheckoutModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    items: CartLine[];
    onSuccess?: (orderId?: string) => void;
}

const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0,
    }).format(amount);

export function CartCheckoutModal({ open, onOpenChange, items, onSuccess }: CartCheckoutModalProps) {
    const { user, profile } = useAuth();
    const { toast } = useToast();

    const [customerName, setCustomerName] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    const [customerDocument, setCustomerDocument] = useState('');
    const [line1, setLine1] = useState('');
    const [line2, setLine2] = useState('');
    const [city, setCity] = useState('');
    const [department, setDepartment] = useState('Bogota DC');
    const [postalCode, setPostalCode] = useState('');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (open && user) {
            setCustomerName(profile?.full_name || '');
            setContactEmail(user.email || '');
        }
    }, [open, user, profile]);

    const { startCartCheckout, loading } = useWompiCheckout({
        onSuccess: () => {
            toast({
                title: '¡Pago exitoso!',
                description: 'Tu orden ha sido procesada. Recibiras el envio pronto.',
            });
            onSuccess?.();
            onOpenChange(false);
        },
        onError: (err) => {
            toast({
                title: 'Pago no completado',
                description: err.message,
                variant: 'destructive',
            });
        },
    });

    const subtotal = items.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
    const taxEstimate = Math.round(subtotal * 0.19);
    const shippingEstimate = department === 'Bogota DC' ? 12000 : department === 'Antioquia' || department === 'Valle del Cauca' || department === 'Cundinamarca' ? 18000 : 25000;
    const grossEstimate = subtotal + taxEstimate + shippingEstimate;

    const isValid =
        items.length > 0 &&
        customerName.length >= 2 &&
        contactEmail.includes('@') &&
        contactPhone.length >= 7 &&
        line1.length >= 3 &&
        city.length >= 2 &&
        department.length >= 2;

    const handlePay = async () => {
        if (!isValid) return;
        await startCartCheckout({
            items: items.map(i => ({
                productId: i.productId,
                variantId: i.variantId,
                quantity: i.quantity,
            })),
            shippingAddress: {
                line1,
                line2: line2 || undefined,
                city,
                department,
                postalCode: postalCode || undefined,
            },
            contactEmail,
            contactPhone,
            customerName,
            customerDocument: customerDocument || undefined,
            notes: notes || undefined,
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[95vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ShoppingBag className="h-5 w-5 text-primary" />
                        Finalizar compra
                    </DialogTitle>
                    <DialogDescription>
                        Pago seguro procesado por Wompi (Bancolombia). Aceptamos tarjeta, PSE, Nequi y Bancolombia.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5">
                    {/* ── Resumen de carrito ──────────────────────────────────── */}
                    <div className="bg-muted/30 rounded-lg p-4 space-y-2 text-sm">
                        <h3 className="font-semibold mb-2">Tu pedido ({items.length} productos)</h3>
                        {items.map((item) => (
                            <div key={`${item.productId}-${item.variantId || 'base'}`} className="flex justify-between">
                                <span className="text-muted-foreground line-clamp-1">
                                    {item.quantity} × {item.name}
                                </span>
                                <span className="font-medium">{formatCurrency(item.unitPrice * item.quantity)}</span>
                            </div>
                        ))}
                        <Separator className="my-2" />
                        <div className="flex justify-between">
                            <span>Subtotal</span>
                            <span>{formatCurrency(subtotal)}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                            <span>IVA (19%)</span>
                            <span>{formatCurrency(taxEstimate)}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                            <span>Envio (estimado)</span>
                            <span>{formatCurrency(shippingEstimate)}</span>
                        </div>
                        <Separator className="my-2" />
                        <div className="flex justify-between font-bold text-base">
                            <span>Total a pagar</span>
                            <span className="text-primary">{formatCurrency(grossEstimate)}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground italic">
                            * El envio final se calcula al confirmar el departamento de entrega.
                        </p>
                    </div>

                    {/* ── Datos de contacto ────────────────────────────────────── */}
                    <div className="space-y-3">
                        <h3 className="font-semibold flex items-center gap-2">
                            <User className="h-4 w-4" /> Datos de contacto
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label htmlFor="customer-name">Nombre completo *</Label>
                                <Input
                                    id="customer-name"
                                    value={customerName}
                                    onChange={(e) => setCustomerName(e.target.value)}
                                    placeholder="Juan Perez"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="customer-document">Cédula / NIT</Label>
                                <Input
                                    id="customer-document"
                                    value={customerDocument}
                                    onChange={(e) => setCustomerDocument(e.target.value)}
                                    placeholder="1020304050"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="contact-email" className="flex items-center gap-1">
                                    <Mail className="h-3 w-3" /> Email *
                                </Label>
                                <Input
                                    id="contact-email"
                                    type="email"
                                    value={contactEmail}
                                    onChange={(e) => setContactEmail(e.target.value)}
                                    placeholder="cliente@email.com"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="contact-phone" className="flex items-center gap-1">
                                    <Phone className="h-3 w-3" /> Teléfono *
                                </Label>
                                <Input
                                    id="contact-phone"
                                    value={contactPhone}
                                    onChange={(e) => setContactPhone(e.target.value)}
                                    placeholder="+57 300 1234567"
                                />
                            </div>
                        </div>
                    </div>

                    {/* ── Direccion de envio ───────────────────────────────────── */}
                    <div className="space-y-3">
                        <h3 className="font-semibold flex items-center gap-2">
                            <MapPin className="h-4 w-4" /> Dirección de envío
                        </h3>
                        <div className="space-y-3">
                            <div className="space-y-1">
                                <Label htmlFor="line1">Dirección *</Label>
                                <Input
                                    id="line1"
                                    value={line1}
                                    onChange={(e) => setLine1(e.target.value)}
                                    placeholder="Calle 100 # 15-40"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="line2">Apartamento, torre, referencia (opcional)</Label>
                                <Input
                                    id="line2"
                                    value={line2}
                                    onChange={(e) => setLine2(e.target.value)}
                                    placeholder="Apto 502, Torre B"
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="space-y-1 sm:col-span-1">
                                    <Label htmlFor="city">Ciudad *</Label>
                                    <Input
                                        id="city"
                                        value={city}
                                        onChange={(e) => setCity(e.target.value)}
                                        placeholder="Bogotá"
                                    />
                                </div>
                                <div className="space-y-1 sm:col-span-1">
                                    <Label htmlFor="department">Departamento *</Label>
                                    <Select value={department} onValueChange={setDepartment}>
                                        <SelectTrigger id="department">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {DEPARTAMENTOS_COLOMBIA.map((d) => (
                                                <SelectItem key={d} value={d}>{d}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1 sm:col-span-1">
                                    <Label htmlFor="postal">Código postal</Label>
                                    <Input
                                        id="postal"
                                        value={postalCode}
                                        onChange={(e) => setPostalCode(e.target.value)}
                                        placeholder="110111"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="notes">Notas para el envío (opcional)</Label>
                                <Input
                                    id="notes"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Dejar en portería, llamar antes, etc"
                                />
                            </div>
                        </div>
                    </div>

                    {/* ── Boton de pago ────────────────────────────────────────── */}
                    <div className="space-y-2 pt-2">
                        <Button
                            className="w-full"
                            size="lg"
                            disabled={!isValid || loading}
                            onClick={handlePay}
                        >
                            {loading ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Conectando con Wompi...</>
                            ) : (
                                <><CheckCircle2 className="mr-2 h-4 w-4" />Pagar {formatCurrency(grossEstimate)}</>
                            )}
                        </Button>
                        <p className="text-[11px] text-center text-muted-foreground">
                            🔒 Pago seguro procesado por Wompi (Bancolombia). Tus datos de tarjeta nunca pasan por SportMaps.
                        </p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
