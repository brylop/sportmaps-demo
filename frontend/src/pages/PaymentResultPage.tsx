import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle2, XCircle, Clock, Download, ArrowLeft } from 'lucide-react';
import { checkTransactionStatus, WompiTransactionResult } from '@/lib/api/wompi';
import { downloadReceipt } from '@/lib/receipt-generator';
import { useAuth } from '@/contexts/AuthContext';

export default function PaymentResultPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user } = useAuth();
    const transactionId = searchParams.get('id');

    const [transaction, setTransaction] = useState<WompiTransactionResult | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (transactionId) {
            checkTransactionStatus(transactionId).then((result) => {
                setTransaction(result);
                setLoading(false);
            });
        } else {
            setLoading(false);
        }
    }, [transactionId]);

    const formatPrice = (cents: number) =>
        new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
        }).format(cents / 100);

    const handleDownloadReceipt = () => {
        if (!transaction) return;
        downloadReceipt({
            receiptNumber: transaction.reference,
            date: new Date(transaction.createdAt).toLocaleDateString('es-CO'),
            customerName: user?.user_metadata?.full_name || 'Cliente',
            customerEmail: user?.email,
            concept: 'Pago via Wompi',
            amount: transaction.amountInCents / 100,
            paymentMethod: transaction.paymentMethodType,
            paymentType: 'one_time',
        });
    };

    const statusConfig = {
        APPROVED: {
            icon: <CheckCircle2 className="h-12 w-12 text-green-500" />,
            title: '¡Pago Exitoso!',
            description: 'Tu transacción ha sido procesada correctamente.',
            bgClass: 'bg-green-100 dark:bg-green-900/30',
            badgeVariant: 'default' as const,
        },
        DECLINED: {
            icon: <XCircle className="h-12 w-12 text-red-500" />,
            title: 'Pago Rechazado',
            description: 'La transacción fue rechazada por la entidad financiera.',
            bgClass: 'bg-red-100 dark:bg-red-900/30',
            badgeVariant: 'destructive' as const,
        },
        ERROR: {
            icon: <XCircle className="h-12 w-12 text-red-500" />,
            title: 'Error en el Pago',
            description: 'Ocurrió un error procesando la transacción.',
            bgClass: 'bg-red-100 dark:bg-red-900/30',
            badgeVariant: 'destructive' as const,
        },
        PENDING: {
            icon: <Clock className="h-12 w-12 text-yellow-500" />,
            title: 'Pago Pendiente',
            description: 'Tu pago está siendo procesado. Te notificaremos cuando se confirme.',
            bgClass: 'bg-yellow-100 dark:bg-yellow-900/30',
            badgeVariant: 'secondary' as const,
        },
        VOIDED: {
            icon: <XCircle className="h-12 w-12 text-gray-500" />,
            title: 'Pago Anulado',
            description: 'Esta transacción fue anulada.',
            bgClass: 'bg-gray-100 dark:bg-gray-900/30',
            badgeVariant: 'secondary' as const,
        },
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-muted-foreground">Verificando transacción...</p>
                </div>
            </div>
        );
    }

    if (!transaction) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <Card className="max-w-md w-full">
                    <CardContent className="py-12 text-center">
                        <XCircle className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
                        <h2 className="text-xl font-bold mb-2">Transacción no encontrada</h2>
                        <p className="text-muted-foreground mb-6">
                            No se pudo encontrar información sobre esta transacción.
                        </p>
                        <Button onClick={() => navigate('/dashboard')}>Volver al inicio</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const config = statusConfig[transaction.status] || statusConfig.ERROR;

    return (
        <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
            <Card className="max-w-lg w-full">
                <CardContent className="py-10 text-center">
                    {/* Status Icon */}
                    <div className={`h-24 w-24 rounded-full ${config.bgClass} flex items-center justify-center mx-auto mb-6`}>
                        {config.icon}
                    </div>

                    <h2 className="text-2xl font-bold mb-2">{config.title}</h2>
                    <p className="text-muted-foreground mb-4">{config.description}</p>

                    <Badge variant={config.badgeVariant} className="mb-6">
                        {transaction.status}
                    </Badge>

                    {/* Transaction Details */}
                    <div className="bg-muted/50 rounded-xl p-4 mb-6 text-left">
                        <div className="flex justify-between mb-2">
                            <span className="text-muted-foreground text-sm">Referencia</span>
                            <span className="font-mono text-sm font-medium">{transaction.reference}</span>
                        </div>
                        <div className="flex justify-between mb-2">
                            <span className="text-muted-foreground text-sm">ID Transacción</span>
                            <span className="font-mono text-sm font-medium">{transaction.id}</span>
                        </div>
                        <div className="flex justify-between mb-2">
                            <span className="text-muted-foreground text-sm">Método</span>
                            <span className="font-medium text-sm">{transaction.paymentMethodType}</span>
                        </div>
                        <Separator className="my-3" />
                        <div className="flex justify-between font-bold text-lg">
                            <span>Total</span>
                            <span className="text-primary">{formatPrice(transaction.amountInCents)}</span>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                        {transaction.status === 'APPROVED' && (
                            <Button variant="outline" className="flex-1" onClick={handleDownloadReceipt}>
                                <Download className="h-4 w-4 mr-2" />
                                Descargar Recibo
                            </Button>
                        )}
                        <Button className="flex-1" onClick={() => navigate('/dashboard')}>
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Volver al inicio
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
