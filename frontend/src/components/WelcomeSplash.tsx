import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface WelcomeSplashProps {
    userRole: string;
    userName: string;
    onComplete: () => void;
}

const WelcomeSplash: React.FC<WelcomeSplashProps> = ({ userRole, userName, onComplete }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <Card className="max-w-md w-full shadow-2xl transform transition-all border-b-8 border-[#FB9F1E] overflow-hidden">
                <CardContent className="p-8">
                    <div className="flex justify-center mb-6">
                        <div className="bg-[#248223] p-4 rounded-full shadow-glow-green">
                            <img
                                src="https://luebjarufsiadojhvxgi.supabase.co/storage/v1/object/public/avatars/LOGO.jpg"
                                alt="Logo"
                                className="w-16 h-16 object-contain invert"
                            />
                        </div>
                    </div>

                    <h1 className="text-3xl font-poppins font-bold text-center text-foreground mb-2">
                        ¡Hola, {userName}!
                    </h1>
                    <p className="text-center text-[#248223] font-semibold mb-6">
                        Bienvenido a SportMaps como <span className="uppercase text-[#FB9F1E]">{userRole}</span>
                    </p>

                    <div className="bg-muted rounded-lg p-4 mb-8 italic text-muted-foreground text-center">
                        {userRole === 'school' || userRole === 'school_admin'
                            ? "Comencemos configurando tus instalaciones para recibir atletas."
                            : "Busca tu academia ideal y empieza a entrenar hoy mismo."}
                    </div>

                    <Button
                        className="w-full py-6 bg-[#FB9F1E] hover:bg-[#e88f1a] text-white font-poppins font-bold rounded-xl shadow-lg transition-transform hover:scale-[1.02] text-lg"
                        onClick={onComplete}
                    >
                        ¡VAMOS A EMPEZAR!
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
};

export default WelcomeSplash;
