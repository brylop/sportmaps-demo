import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface DashboardEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}

/**
 * Empty state component for dashboard sections
 * Shows when user has no data yet
 */
export function DashboardEmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: DashboardEmptyStateProps) {
  return (
    <Card className="border-2 border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Icon className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-sm">
          {description}
        </p>
        <Button onClick={onAction} size="lg">
          {actionLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
