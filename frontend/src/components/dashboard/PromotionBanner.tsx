import React from 'react';
import { Card } from '@/components/ui/card';

interface PromotionBannerProps {
    className?: string;
}

const PromotionBanner: React.FC<PromotionBannerProps> = ({
    className = ""
}) => {
    return (
        <Card className={`relative overflow-hidden border-none bg-gradient-to-r from-white to-zinc-50 dark:from-zinc-950 dark:to-black h-24 flex items-center rounded-3xl mb-10 shadow-md dark:shadow-elevation group border border-black/5 dark:border-white/5 ${className}`}>
            {/* Fondo decorativo dinámico */}
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-accent-orange/5 dark:from-primary/10 dark:to-accent-orange/5 pointer-events-none" />

            <div className="flex w-full h-full items-center relative z-10">
                {/* Sección Logo - Restauración de Degradado Verde */}
                <div className="w-1/3 md:w-1/4 h-full flex items-center justify-center p-4 relative bg-gradient-to-br from-primary/20 via-primary/5 to-transparent dark:from-primary/30 dark:via-zinc-900 dark:to-black">
                    {/* Brillo suave de marca */}
                    <div className="absolute inset-0 bg-primary/10 dark:bg-primary/5 blur-2xl opacity-20" />

                    <img
                        src="/logo-bienvenida.png"
                        alt="SportMaps Logo"
                        className="h-16 md:h-20 w-auto object-contain relative z-20 transition-transform duration-700 group-hover:scale-110 drop-shadow-sm dark:drop-shadow-none"
                        onError={(e) => {
                            e.currentTarget.src = "/logo-bienvenida.png";
                            e.currentTarget.className = "h-12 w-12 object-contain dark:invert opacity-80";
                        }}
                    />

                    {/* Línea divisoria elegante */}
                    <div className="absolute top-1/4 right-0 h-1/2 w-px bg-primary/30 hidden md:block" />
                </div>

                {/* Sección de "Información" */}
                <div className="flex-1 h-full flex items-center px-8 bg-transparent backdrop-blur-[2px]">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(36,130,35,0.4)]" />
                            <span className="text-primary font-black uppercase tracking-[0.3em] text-[10px]">Premium Experience</span>
                        </div>
                        <h3 className="text-foreground dark:text-white text-xl md:text-2xl font-poppins font-bold tracking-tight line-clamp-1">Bienvenido a la Nueva Red SportMaps</h3>
                    </div>
                </div>

                {/* Acento naranja al final */}
                <div className="absolute right-0 top-0 h-full w-1.5 bg-gradient-to-b from-primary via-accent-orange to-primary opacity-60" />
            </div>
        </Card>
    );
};

export default PromotionBanner;
