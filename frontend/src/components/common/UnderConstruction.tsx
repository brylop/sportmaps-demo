import { Construction, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';

interface UnderConstructionProps {
  title: string;
  description?: string;
  showBackButton?: boolean;
}

export function UnderConstruction({ 
  title, 
  description = "Esta funcionalidad está siendo desarrollada y estará disponible pronto.",
  showBackButton = true 
}: UnderConstructionProps) {
  const navigate = useNavigate();

  return (
    <div className="p-6 flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full text-center">
        <CardHeader className="pb-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Construction className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">{title}</CardTitle>
          <CardDescription className="text-base">
            {description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {showBackButton && (
            <Button 
              variant="outline" 
              onClick={() => navigate(-1)}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
