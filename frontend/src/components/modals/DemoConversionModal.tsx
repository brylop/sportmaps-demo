import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Phone, Calendar, ArrowRight, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DemoConversionModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  role?: string;
}

export function DemoConversionModal({ open: controlledOpen, onOpenChange, role = 'school' }: DemoConversionModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const { toast } = useToast();

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (onOpenChange || (() => {})) : setInternalOpen;

  useEffect(() => {
    if (!isControlled) {
      // Auto-show after tour completion
      const showModal = sessionStorage.getItem('show_conversion_modal');
      if (showModal === 'true') {
        setTimeout(() => {
          setInternalOpen(true);
          sessionStorage.removeItem('show_conversion_modal');
        }, 500);
      }
    }
  }, [isControlled]);

  const handleWhatsApp = () => {
    const message = encodeURIComponent(
      `¡Hola! Acabo de completar el demo de SportMaps y me interesa saber más sobre el Plan Pro para mi academia.`
    );
    window.open(`https://wa.me/573128463555?text=${message}`, '_blank');
    setOpen(false);
  };

  const handleScheduleDemo = () => {
    if (!name || !phone || !email) {
      toast({
        title: "Campos requeridos",
        description: "Por favor completa todos los campos",
        variant: "destructive",
      });
      return;
    }

    // TODO: Send to your CRM or Calendly
    toast({
      title: "¡Solicitud enviada!",
      description: "Te contactaremos en las próximas 24 horas",
    });
    setOpen(false);
  };

  const handleKeepExploring = () => {
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-2xl">¿{role === 'school' ? 'Listo para transformar tu academia' : 'Te gustó lo que viste'}?</DialogTitle>
              <DialogDescription className="text-base">
                {role === 'school' 
                  ? 'Más de 150 academias ya están creciendo con SportMaps'
                  : 'Encuentra la escuela perfecta para tus hijos'
                }
              </DialogDescription>
            </div>
          </div>
          <Badge variant="secondary" className="w-fit">
            🎉 Oferta de lanzamiento: Primer mes GRATIS
          </Badge>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Benefits Recap */}
          <div className="bg-primary/5 rounded-lg p-4 space-y-2">
            <h4 className="font-semibold">Lo que acabas de ver:</h4>
            <ul className="space-y-1 text-sm">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                <span>Dashboard con ingresos y estudiantes en tiempo real</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                <span>Cobros automáticos sin perseguir pagos</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                <span>Tu academia en marketplace con 15K+ padres activos</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                <span>App móvil incluida para padres y alumnos</span>
              </li>
            </ul>
          </div>

          {/* Pricing Reminder */}
          <div className="border-l-4 border-primary pl-4">
            <p className="text-sm text-muted-foreground">Plan Pro</p>
            <p className="text-3xl font-bold">$79.000/mes</p>
            <p className="text-sm text-muted-foreground">10x más barato que Mindbody. Sin comisiones por estudiante.</p>
          </div>

          {/* CTAs */}
          <div className="space-y-3">
            <Button 
              className="w-full" 
              size="lg"
              onClick={handleWhatsApp}
            >
              <Phone className="mr-2 h-5 w-5" />
              Hablar con Ventas por WhatsApp
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">O</span>
              </div>
            </div>

            {/* Quick Contact Form */}
            <div className="space-y-3 p-4 border rounded-lg">
              <h4 className="font-medium text-sm">Solicita una demo personalizada</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="name" className="text-xs">Nombre</Label>
                  <Input 
                    id="name" 
                    placeholder="Tu nombre" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="phone" className="text-xs">Teléfono</Label>
                  <Input 
                    id="phone" 
                    placeholder="300 123 4567" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="email" className="text-xs">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="tu@academia.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button 
                variant="secondary" 
                className="w-full"
                onClick={handleScheduleDemo}
              >
                <Calendar className="mr-2 h-4 w-4" />
                Solicitar Demo Personalizada
              </Button>
            </div>

            <Button 
              variant="ghost" 
              className="w-full"
              onClick={handleKeepExploring}
            >
              Seguir explorando el demo
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}