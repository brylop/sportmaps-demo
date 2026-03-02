import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Eye, EyeOff, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function ResetPasswordPage() {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [isValidSession, setIsValidSession] = useState(false);
    const [checkingSession, setCheckingSession] = useState(true);
    const { toast } = useToast();
    const navigate = useNavigate();

    // Verificar que el usuario llegó desde un enlace válido de recuperación
    useEffect(() => {
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                setIsValidSession(true);
            }
            setCheckingSession(false);
        };

        // Escuchar el evento PASSWORD_RECOVERY de Supabase
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY') {
                setIsValidSession(true);
                setCheckingSession(false);
            }
        });

        checkSession();
        return () => subscription.unsubscribe();
    }, []);

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password.length < 6) {
            toast({
                title: 'Contraseña muy corta',
                description: 'La contraseña debe tener al menos 6 caracteres.',
                variant: 'destructive',
            });
            return;
        }

        if (password !== confirmPassword) {
            toast({
                title: 'Las contraseñas no coinciden',
                description: 'Por favor verifica que ambas contraseñas sean iguales.',
                variant: 'destructive',
            });
            return;
        }

        setIsLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({ password });

            if (error) throw error;

            setIsSuccess(true);
            toast({
                title: '¡Contraseña actualizada!',
                description: 'Tu contraseña ha sido cambiada exitosamente.',
            });

            // Redirigir al dashboard después de 3 segundos
            setTimeout(() => navigate('/dashboard'), 3000);
        } catch (error: any) {
            console.error('Error updating password:', error);
            toast({
                title: 'Error al actualizar',
                description: error.message || 'No se pudo actualizar la contraseña. Intenta de nuevo.',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    if (checkingSession) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 via-background to-secondary/20 p-4">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-muted-foreground">Verificando enlace de recuperación...</p>
                </div>
            </div>
        );
    }

    if (!isValidSession) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 via-background to-secondary/20 p-4">
                <Card className="w-full max-w-md border-2 shadow-lg">
                    <CardHeader className="space-y-1 text-center">
                        <CardTitle className="text-2xl font-bold">Enlace Inválido</CardTitle>
                        <CardDescription>
                            Este enlace de recuperación ha expirado o no es válido. Por favor solicita uno nuevo desde la página de inicio de sesión.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button className="w-full" onClick={() => navigate('/login')}>
                            Ir al inicio de sesión
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 via-background to-secondary/20 p-4">
            <Card className="w-full max-w-md border-2 shadow-lg">
                <CardHeader className="space-y-1">
                    <div className="flex justify-center mb-4">
                        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                            {isSuccess ? (
                                <CheckCircle2 className="w-6 h-6 text-green-500" />
                            ) : (
                                <ShieldCheck className="w-6 h-6 text-primary" />
                            )}
                        </div>
                    </div>
                    <CardTitle className="text-2xl font-bold text-center">
                        {isSuccess ? '¡Listo!' : 'Nueva Contraseña'}
                    </CardTitle>
                    <CardDescription className="text-center">
                        {isSuccess
                            ? 'Tu contraseña ha sido actualizada exitosamente. Serás redirigido...'
                            : 'Ingresa tu nueva contraseña para restablecer el acceso a tu cuenta.'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isSuccess ? (
                        <div className="space-y-4">
                            <div className="rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-4 text-center">
                                <p className="text-sm text-green-700 dark:text-green-300">
                                    Redirigiendo al panel de control en unos segundos...
                                </p>
                            </div>
                            <Button className="w-full" onClick={() => navigate('/dashboard')}>
                                Ir al Dashboard
                            </Button>
                        </div>
                    ) : (
                        <form onSubmit={handleResetPassword} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="new-password">Nueva Contraseña</Label>
                                <div className="relative">
                                    <Input
                                        id="new-password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Mínimo 6 caracteres"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        disabled={isLoading}
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="confirm-password">Confirmar Contraseña</Label>
                                <Input
                                    id="confirm-password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Repite la nueva contraseña"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    disabled={isLoading}
                                />
                            </div>

                            <Button type="submit" className="w-full" disabled={isLoading}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Restablecer Contraseña
                            </Button>
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
