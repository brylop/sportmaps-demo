import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Smartphone, Store, MapPin, CreditCard } from 'lucide-react';
import { MobileAppPreviewModal } from '@/components/modals/MobileAppPreviewModal';
import { useNavigate } from 'react-router-dom';
import { SHOW_EXPLORE } from '@/lib/feature-flags';

export function DemoQuickLinks() {
  const [showMobileModal, setShowMobileModal] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">⚡ Acceso Rápido</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="h-auto flex-col gap-2 p-4"
            onClick={() => navigate('/payments-automation')}
          >
            <CreditCard className="h-6 w-6 text-primary" />
            <span className="text-xs text-center">Cobros Automáticos</span>
          </Button>
          
          <Button
            variant="outline"
            className="h-auto flex-col gap-2 p-4"
            onClick={() => setShowMobileModal(true)}
          >
            <Smartphone className="h-6 w-6 text-primary" />
            <span className="text-xs text-center">App para Padres</span>
          </Button>
          
          {SHOW_EXPLORE && (
            <Button
              variant="outline"
              className="h-auto flex-col gap-2 p-4"
              onClick={() => navigate('/explorar')}
            >
              <MapPin className="h-6 w-6 text-primary" />
              <span className="text-xs text-center">Tu Perfil Público</span>
            </Button>
          )}

          <Button
            variant="outline"
            className="h-auto flex-col gap-2 p-4"
            onClick={() => navigate('/shop')}
          >
            <Store className="h-6 w-6 text-primary" />
            <span className="text-xs text-center">Tienda Uniformes</span>
          </Button>
        </CardContent>
      </Card>

      <MobileAppPreviewModal 
        open={showMobileModal} 
        onOpenChange={setShowMobileModal}
      />
    </>
  );
}
