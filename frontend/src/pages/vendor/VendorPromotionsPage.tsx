/**
 * Promociones del vendedor (/vendor/promotions) — tienda v2 F3b.
 *
 * Hoy: cupones de descuento de SU tienda (StoreCouponsManager, el mismo de la
 * escuela). Combos, ofertas flash y envío gratis siguen fuera de alcance.
 */
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useVendorProfile } from '@/hooks/useVendorProfile';
import { StoreCouponsManager } from '@/components/store/StoreCouponsManager';

export default function VendorPromotionsPage() {
    const navigate = useNavigate();
    const { data: vp, isLoading, canSellProducts } = useVendorProfile();

    return (
        <div className="min-h-screen bg-muted/30 p-4 md:p-8">
            <div className="max-w-3xl mx-auto space-y-6">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/vendor/dashboard')} aria-label="Volver">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Tag className="h-6 w-6 text-primary" />
                            Cupones de descuento
                        </h1>
                        <p className="text-sm text-muted-foreground">Códigos que tus compradores escriben al pagar.</p>
                    </div>
                </div>

                {isLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                ) : !vp || !canSellProducts ? (
                    <Card><CardContent className="p-6 text-sm text-muted-foreground">
                        Los cupones son para tiendas que venden productos. Activa la venta de productos en tu perfil de vendedor.
                    </CardContent></Card>
                ) : (
                    <StoreCouponsManager vendorProfileId={vp.id} />
                )}
            </div>
        </div>
    );
}
