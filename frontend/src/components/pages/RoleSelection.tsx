import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Users, GraduationCap, School, Check } from "lucide-react";

interface RoleSelectionProps {
  onNavigate: (page: string) => void;
  onRoleSelect: (role: string) => void;
}

const RoleSelection = ({ onNavigate, onRoleSelect }: RoleSelectionProps) => {
  const [selectedRole, setSelectedRole] = useState<string>("athlete");

  const roles = [
    {
      id: "athlete",
      title: "Deportista / Padre",
      description: "Reservas y tienda",
      icon: Users,
      bgColor: "bg-primary/10",
      iconColor: "text-primary"
    },
    {
      id: "coach",
      title: "Entrenador",
      description: "Clases, agenda y pagos",
      icon: GraduationCap,
      bgColor: "bg-secondary/10",
      iconColor: "text-secondary"
    },
    {
      id: "school",
      title: "Escuela / Centro",
      description: "Entrenadores, agenda y cobros",
      icon: School,
      bgColor: "bg-orange-50",
      iconColor: "text-orange-500"
    }
  ];

  const handleRoleSelect = (roleId: string) => {
    setSelectedRole(roleId);
  };

  const handleContinue = () => {
    onRoleSelect(selectedRole);
    if (selectedRole === "school") {
      onNavigate("school-register");
    } else if (selectedRole === "coach") {
      onNavigate("coach-register");
    } else {
      onNavigate("athlete-register");
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 py-8" style={{ fontFamily: 'Inter, sans-serif' }}>
      <div className="container mx-auto px-4 max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">Selecciona tu Rol</h1>
          <p className="text-muted-foreground">
            Elige cómo quieres usar SportMaps para personalizar tu experiencia
          </p>
        </div>

        <div className="space-y-4 mb-8">
          {roles.map((role) => {
            const Icon = role.icon;
            const isSelected = selectedRole === role.id;
            
            return (
              <Card 
                key={role.id}
                className={`cursor-pointer transition-all duration-300 hover:shadow-card ${
                  isSelected ? 'border-primary ring-2 ring-primary bg-primary/5' : 'hover:border-primary/50'
                }`}
                onClick={() => handleRoleSelect(role.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-lg ${role.bgColor} ${role.iconColor} flex items-center justify-center`}>
                      <Icon className="w-7 h-7" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">{role.title}</h3>
                      <p className="text-sm text-muted-foreground">{role.description}</p>
                    </div>
                    {isSelected && (
                      <Check className="w-6 h-6 text-primary" />
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Button 
          variant="hero" 
          size="lg" 
          className="w-full"
          onClick={handleContinue}
        >
          Continuar
        </Button>

        <div className="text-center mt-6">
          <p className="text-sm text-muted-foreground">
            ¿Ya tienes cuenta?{" "}
            <button 
              className="text-primary font-medium hover:underline"
              onClick={() => onNavigate("login")}
            >
              Iniciar sesión
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RoleSelection;