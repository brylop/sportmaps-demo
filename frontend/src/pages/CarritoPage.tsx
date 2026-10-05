/**
 * CarritoPage — carrito en página completa (/carrito), tienda v2 §2.4.
 * Mismo contenido que el carrito lateral: agrupado por tienda y revalidado
 * contra `quote_cart`. Reemplaza al checkout viejo (/checkout).
 */

import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CartContents } from '@/components/store/CartContents';

export default function CarritoPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-muted/20 pb-12">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="py-3">
          <Button variant="ghost" size="sm" className="gap-1 -ml-2" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" /> Volver
          </Button>
          <h1 className="text-2xl font-bold tracking-tight mt-1">Mi carrito</h1>
          <p className="text-sm text-muted-foreground">Se paga una tienda a la vez. Precios con IVA incluido.</p>
        </div>
        <CartContents />
      </div>
    </div>
  );
}
