import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { QuickAction } from '@/types/dashboard';
import { Link } from 'react-router-dom';
import { Zap } from 'lucide-react';

interface QuickActionsProps {
  title?: string;
  actions: (QuickAction & { onClick?: () => void })[];
}

export function QuickActions({ title = 'Acciones Rápidas', actions }: QuickActionsProps) {
  return (
    <Card className="hover:shadow-card transition-shadow">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {actions.map((action, index) => {
          const Icon = action.icon;
          
          // If action has onClick, render as button without Link
          if (action.onClick) {
            return (
              <Button
                key={index}
                variant={action.variant || 'outline'}
                className="w-full justify-start"
                onClick={action.onClick}
              >
                <Icon className="mr-2 h-4 w-4" />
                {action.label}
              </Button>
            );
          }
          
          // Otherwise render with Link as before
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
