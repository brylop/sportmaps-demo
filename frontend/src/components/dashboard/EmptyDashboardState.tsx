
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Building2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface EmptyDashboardStateProps {
    userName: string;
}

export function EmptyDashboardState({ userName }: EmptyDashboardStateProps) {
    const navigate = useNavigate();

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 animate-in fade-in duration-500">
            <div className="text-center space-y-4 max-w-lg">
                <h1 className="text-3xl font-bold tracking-tight">¡Hola, {userName}!</h1>
                <p className="text-muted-foreground text-lg">
                    Bienvenido a SportMaps. Para comenzar a ver estadísticas y gestionar tus alumnos,
                    primero necesitas configurar tu primera sede o escuela.
                </p>
            </div>

            <Card className="w-full max-w-md border-dashed border-2 bg-muted/30">
                <CardHeader className="text-center">
                    <div className="mx-auto bg-primary/10 p-4 rounded-full w-16 h-16 flex items-center justify-center mb-4">
                        <Building2 className="h-8 w-8 text-primary" />
                    </div>
                    <CardTitle>Crea tu primera Sede</CardTitle>
                    <CardDescription>
                        Configura la ubicación, horarios y detalles básicos.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center pb-8">
                    <Button
                        size="lg"
                        onClick={() => navigate('/school-config')}
                        className="gap-2"
                    >
                        <PlusCircle className="h-5 w-5" />
                        Configurar Sede Ahora
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
