import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { QuickAction } from '@/types/dashboard';
import { Link } from 'react-router-dom';
import { Zap, Settings } from 'lucide-react';

interface QuickActionsProps {
  title?: string;
  actions: QuickAction[];
  /** Si viene, aparece un botón para personalizar qué acciones se muestran. */
  onEdit?: () => void;
}

export function QuickActions({ title = 'Acciones Rápidas', actions, onEdit }: QuickActionsProps) {
  return (
    <Card className="hover:shadow-card transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
        {onEdit && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={onEdit}
            aria-label="Personalizar accesos rápidos"
          >
            <Settings className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {actions.map((action, index) => {
          const Icon = action.icon;
          return (
            <Button
              key={index}
              asChild
              variant={action.variant || 'outline'}
              className="w-full justify-start"
            >
              <Link to={action.href}>
                <Icon className="mr-2 h-4 w-4" />
                {action.label}
              </Link>
            </Button>
          );
        })}
      </CardContent>
    </Card>
  );
}
