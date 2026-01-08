import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { 
  Mail, 
  X, 
  User, 
  Users, 
  School, 
  Heart, 
  ShoppingBag,
  Dumbbell,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import logoImage from '@/assets/sportmaps-logo.png';

interface WelcomeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const roles = [
  { id: 'athlete', label: 'Atleta', icon: Dumbbell, color: 'text-primary' },
  { id: 'parent', label: 'Padre', icon: Users, color: 'text-orange' },
  { id: 'school', label: 'Escuela', icon: School, color: 'text-blue-500' },
  { id: 'wellness_professional', label: 'Profesional', icon: Heart, color: 'text-pink-500' },
  { id: 'store_owner', label: 'Vendedor', icon: ShoppingBag, color: 'text-purple-500' },
];

export function WelcomeModal({ open, onOpenChange }: WelcomeModalProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleEmailLogin = () => {
    onOpenChange(false);
    navigate('/login');
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        }
      });

      if (error) throw error;
    } catch (error: any) {
      console.error('Google login error:', error);
      toast({
        title: 'Error',
        description: 'No se pudo iniciar sesión con Google. Intenta de nuevo.',
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };

  const handleGuestAccess = () => {
    onOpenChange(false);
    // Just close modal and let user browse
  };

  const handleRoleSelect = (roleId: string) => {
    onOpenChange(false);
    navigate(`/register?role=${roleId}`);
  };

  const handleClose = () => {
    // Mark as dismissed in sessionStorage
    sessionStorage.setItem('sportmaps_welcome_dismissed', 'true');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden border-0 bg-background/95 backdrop-blur-xl shadow-2xl">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 z-50 rounded-full p-2 bg-muted/80 hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Cerrar</span>
        </button>

        {/* Header */}
        <div className="p-8 pb-6 text-center bg-gradient-to-br from-primary/5 via-background to-orange/5">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <img 
                src={logoImage} 
                alt="SportMaps" 
                className="w-20 h-20 rounded-2xl shadow-lg"
              />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                <Sparkles className="w-3 h-3 text-white" />
              </div>
            </div>
          </div>
          <h2 className="text-2xl font-bold font-poppins text-foreground mb-2">
            Bienvenido a SportMaps
          </h2>
          <p className="text-muted-foreground font-poppins text-sm">
            Revolucionando el sistema deportivo
          </p>
        </div>

        {/* Login Options */}
        <div className="p-6 space-y-4">
          {/* Email Login - Primary */}
          <Button
            onClick={handleEmailLogin}
            className="w-full h-12 gap-3 font-poppins text-base bg-[#248223] hover:bg-[#1d6a1c] text-white"
            size="lg"
          >
            <Mail className="h-5 w-5" />
            Continuar con Email
          </Button>

          {/* Google Login */}
          <Button
            onClick={handleGoogleLogin}
            variant="outline"
            className="w-full h-12 gap-3 font-poppins text-base border-muted-foreground/30 hover:bg-muted/50"
            size="lg"
            disabled={isLoading}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continuar con Google
          </Button>

          {/* Divider */}
          <div className="relative my-6">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-3 text-xs text-muted-foreground font-poppins">
              o
            </span>
          </div>

          {/* Guest Access */}
          <button
            onClick={handleGuestAccess}
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors font-poppins underline-offset-4 hover:underline"
          >
            Continuar como Invitado
          </button>
        </div>

        {/* Role Selection */}
        <div className="px-6 pb-8">
          <div className="bg-muted/50 rounded-xl p-4">
            <p className="text-center text-sm font-medium font-poppins text-muted-foreground mb-4">
              ¿Eres nuevo? Elige tu rol para explorar
            </p>
            <div className="grid grid-cols-5 gap-2">
              {roles.map((role) => {
                const Icon = role.icon;
                return (
                  <button
                    key={role.id}
                    onClick={() => handleRoleSelect(role.id)}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-lg hover:bg-background transition-all group"
                  >
                    <div className={`w-10 h-10 rounded-full bg-background shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform ${role.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-[10px] font-medium font-poppins text-muted-foreground group-hover:text-foreground transition-colors text-center leading-tight">
                      {role.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 text-center">
          <p className="text-[10px] text-muted-foreground font-poppins">
            Al continuar, aceptas nuestros{' '}
            <a href="#" className="text-primary hover:underline">Términos de Servicio</a>
            {' '}y{' '}
            <a href="#" className="text-primary hover:underline">Política de Privacidad</a>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}