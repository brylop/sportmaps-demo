import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Smartphone, Bell, MessageSquare, CreditCard, BarChart, X } from 'lucide-react';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';

interface MobileAppPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileAppPreviewModal({ open, onOpenChange }: MobileAppPreviewModalProps) {
  const appScreens = [
    {
      title: 'Login Intuitivo',
      description: 'Acceso rápido para padres con email o biometría',
      image: '/api/placeholder/300/600',
      features: ['Touch ID / Face ID', 'Login social', 'Recordar sesión'],
    },
    {
      title: 'Dashboard Familiar',
      description: 'Todos tus hijos en un solo lugar con su progreso actualizado',
      image: '/api/placeholder/300/600',
      features: ['Múltiples perfiles', 'Asistencia en tiempo real', 'Próximas clases'],
    },
    {
      title: 'Notificaciones Push',
      description: 'Recibe alertas instantáneas de clases, pagos y mensajes',
      image: '/api/placeholder/300/600',
      features: ['Clase cancelada', 'Pago exitoso', 'Mensaje del coach'],
    },
    {
      title: 'Pagos desde el Móvil',
      description: 'Paga mensualidades con un solo tap. Todo seguro y encriptado',
      image: '/api/placeholder/300/600',
      features: ['PSE, Tarjetas, Nequi', 'Historial completo', 'Recibos digitales'],
    },
    {
      title: 'Chat con Coaches',
      description: 'Comunicación directa con entrenadores sin usar WhatsApp personal',
      image: '/api/placeholder/300/600',
      features: ['Mensajería segura', 'Envío de archivos', 'Grupos por equipo'],
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Smartphone className="h-6 w-6 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-2xl">📱 App Móvil para Padres</DialogTitle>
                <DialogDescription className="text-base">
                  Incluida en todos los planes. Disponible en iOS y Android
                </DialogDescription>
              </div>
            </div>
            <Badge variant="default">Incluida en Plan Pro</Badge>
          </div>
        </DialogHeader>

        {/* Carousel */}
        <div className="py-6">
          <Carousel className="w-full max-w-2xl mx-auto">
            <CarouselContent>
              {appScreens.map((screen, index) => (
                <CarouselItem key={index}>
                  <div className="flex flex-col md:flex-row gap-6 items-center">
                    {/* Phone Mockup */}
                    <div className="w-[250px] h-[500px] border-8 border-gray-800 rounded-[3rem] bg-white shadow-2xl overflow-hidden relative">
                      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-32 h-6 bg-gray-800 rounded-b-2xl z-10" />
                      <div className="h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center p-6">
                        <div className="text-center space-y-3">
                          <div className="text-4xl mb-2">
                            {index === 0 && '🔐'}
                            {index === 1 && '📈'}
                            {index === 2 && '🔔'}
                            {index === 3 && '💳'}
                            {index === 4 && '💬'}
                          </div>
                          <h4 className="font-bold text-lg">{screen.title}</h4>
                          <p className="text-sm text-muted-foreground">{screen.description}</p>
                        </div>
                      </div>
                    </div>

                    {/* Features */}
                    <div className="flex-1 space-y-4">
                      <h3 className="text-xl font-semibold">{screen.title}</h3>
                      <p className="text-muted-foreground">{screen.description}</p>
                      <ul className="space-y-2">
                        {screen.features.map((feature, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
          </Carousel>
        </div>

        {/* Key Features Grid */}
        <div className="grid md:grid-cols-4 gap-4 py-4 border-t">
          <div className="text-center space-y-2">
            <Bell className="h-8 w-8 mx-auto text-primary" />
            <h4 className="font-medium text-sm">Notificaciones Push</h4>
          </div>
          <div className="text-center space-y-2">
            <MessageSquare className="h-8 w-8 mx-auto text-primary" />
            <h4 className="font-medium text-sm">Chat Integrado</h4>
          </div>
          <div className="text-center space-y-2">
            <CreditCard className="h-8 w-8 mx-auto text-primary" />
            <h4 className="font-medium text-sm">Pagos Móviles</h4>
          </div>
          <div className="text-center space-y-2">
            <BarChart className="h-8 w-8 mx-auto text-primary" />
            <h4 className="font-medium text-sm">Seguimiento</h4>
          </div>
        </div>

        {/* CTA */}
        <div className="bg-primary/5 rounded-lg p-6 text-center space-y-3">
          <h3 className="text-lg font-semibold">App Incluida en Todos los Planes</h3>
          <p className="text-sm text-muted-foreground">
            Tus padres descargan la app, inician sesión y automáticamente ven a sus hijos inscritos
          </p>
          <div className="flex gap-2 justify-center">
            <Button variant="default">
              <span className="mr-2"></span> App Store
            </Button>
            <Button variant="default">
              <span className="mr-2"></span> Google Play
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}