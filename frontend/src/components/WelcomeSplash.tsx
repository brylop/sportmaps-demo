import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { UserRole, USER_ROLES } from '@/constants/roles';

interface WelcomeSplashProps {
    userRole: string;
    userName: string;
    onComplete: () => void;
}

const WelcomeSplash: React.FC<WelcomeSplashProps> = ({ userRole, userName, onComplete }) => {
    const welcomeTitle = userName;

    const getRoleContent = (role: string) => {
        switch (role) {
            case USER_ROLES.ATHLETE:
                return "¡Tu camino al éxito deportivo comienza aquí! Prepárate para entrenar como un verdadero profesional.";
            case USER_ROLES.PARENT:
                return "Acompaña el crecimiento de tus hijos. Gestiona su formación deportiva de forma segura y sencilla.";
            case USER_ROLES.COACH:
                return "Inspira a la próxima generación de atletas. Tu conocimiento y pasión transforman vidas cada día.";
            case USER_ROLES.SCHOOL:
            case USER_ROLES.SCHOOL_ADMIN:
            case USER_ROLES.ADMIN:
                return "Potencia el crecimiento de tu academia. Gestiona tus sedes, atletas y staff con la mejor tecnología.";
            case USER_ROLES.WELLNESS:
                return "Tu expertise es clave para el alto rendimiento. Acompaña la salud y bienestar de nuestra comunidad deportiva.";
            case USER_ROLES.STORE:
                return "Haz crecer tu negocio deportivo. Conecta tus productos con los atletas que los están buscando.";
            case USER_ROLES.ORGANIZER:
                return "Crea experiencias deportivas inolvidables. Organiza eventos épicos que unan a toda la comunidad.";
            case USER_ROLES.SUPER_ADMIN:
                return "Bienvenido al centro de control. Mantén el ecosistema SportMaps funcionando a la perfección.";
            default:
                return "Bienvenido a la plataforma deportiva más completa. ¡Empecemos a transformar el deporte!";
        }
    };

    const welcomeMessage = getRoleContent(userRole);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-700 pointer-events-none">
            <div className="pointer-events-auto w-full max-w-5xl">
                <Card className="shadow-2xl dark:shadow-[0_0_80px_rgba(0,0,0,0.4)] transform transition-all border-none bg-gradient-to-br from-white to-zinc-100 dark:from-zinc-950 dark:to-black overflow-hidden rounded-[2.5rem] relative group border border-black/5 dark:border-white/5">
                    {/* Fondo decorativo sutil con brillos de marca */}
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent-orange/5 dark:from-primary/10 dark:to-accent-orange/5 pointer-events-none" />

                    <div className="flex flex-col md:flex-row min-h-[350px] relative z-10 transition-all duration-500">
                        {/* Sección Logo/Imagen - Restauración de Degradado Verde */}
                        <div className="w-full md:w-5/12 flex items-center justify-center p-8 md:p-12 relative bg-gradient-to-br from-primary/20 via-primary/5 to-transparent dark:from-primary/30 dark:via-zinc-900 dark:to-black">
                            {/* Brillo ambiental dinámico */}
                            <div className="absolute inset-0 bg-primary/10 dark:bg-primary/5 blur-3xl opacity-30" />

                            <div className="relative transition-all duration-700 group-hover:scale-105 z-10">
                                {/* Contenedor nítido para el logo (Brand Plate) */}
                                <div className="bg-white p-6 md:p-8 rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] border border-black/[0.03] dark:border-white/10">
                                    <img
                                        src="/logo-bienvenida.png"
                                        alt="SportMaps Logo"
                                        className="w-full h-auto max-h-48 md:max-h-56 object-contain"
                                        onError={(e) => {
                                            e.currentTarget.src = "/logo-bienvenida.png";
                                            e.currentTarget.className = "h-32 w-32 object-contain p-4 opacity-90";
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Línea divisoria elegante con acento verde */}
                            <div className="absolute top-1/4 right-0 h-1/2 w-px bg-gradient-to-b from-transparent via-primary/40 to-transparent hidden md:block" />
                        </div>

                        {/* Sección Información - Fondo con degradado suave */}
                        <div className="w-full md:w-7/12 p-10 md:p-14 flex flex-col justify-center bg-transparent backdrop-blur-sm">
                            <div className="space-y-8">
                                <div className="space-y-4">
                                    <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-primary/10 dark:bg-white/5 border border-primary/20 dark:border-white/10">
                                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(36,130,35,0.4)]" />
                                        <span className="text-primary font-bold tracking-[0.2em] uppercase text-[10px]">
                                            Acceso Concedido
                                        </span>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-muted-foreground dark:text-zinc-500 text-2xl font-light tracking-tight block italic">¡Hola,</span>
                                        <h1 className="text-5xl md:text-6xl font-poppins font-black tracking-tighter text-foreground dark:text-white leading-none">
                                            {welcomeTitle}!
                                        </h1>
                                    </div>
                                </div>

                                <div className="h-1.5 w-20 bg-gradient-to-r from-primary via-primary to-accent-orange rounded-full shadow-[0_0_15px_rgba(36,130,35,0.2)]" />

                                <p className="text-muted-foreground dark:text-zinc-400 font-medium leading-relaxed text-lg max-w-sm">
                                    {welcomeMessage}
                                </p>

                                <div className="pt-6">
                                    <Button
                                        className="px-12 py-8 bg-primary hover:bg-accent-orange text-white font-poppins font-black rounded-2xl shadow-performance hover:shadow-glow-orange transition-all duration-500 hover:scale-[1.05] active:scale-[0.98] text-xl uppercase tracking-widest w-full md:w-auto border-none overflow-hidden relative group/btn"
                                        onClick={onComplete}
                                    >
                                        <span className="relative z-10">¡VAMOS A EMPEZAR!</span>
                                        <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-1000" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default WelcomeSplash;
