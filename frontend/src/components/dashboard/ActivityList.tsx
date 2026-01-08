import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ActivityItem } from '@/types/dashboard';
import { Clock } from 'lucide-react';

interface ActivityListProps {
  title: string;
  activities: ActivityItem[];
  showDetails?: boolean;
}

export function ActivityList({ title, activities, showDetails = true }: ActivityListProps) {
  const getVariantStyles = (variant?: string) => {
    switch (variant) {
      case 'primary':
        return 'bg-primary/10 text-primary';
      case 'secondary':
        return 'bg-secondary text-secondary-foreground';
      case 'accent':
        return 'bg-orange-100 text-orange-600';
      default:
        return 'bg-primary/10 text-primary';
    }
  };

  return (
    <Card className="hover:shadow-card transition-all duration-300">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="p-2 rounded-full bg-primary/10">
            <Clock className="h-4 w-4 text-primary" />
          </div>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {activities.map((activity, index) => {
            const Icon = activity.icon;
            return (
              <div
                key={activity.id}
                className="flex items-center space-x-4 p-3 rounded-lg border hover:border-primary/50 hover:shadow-sm transition-all duration-200 animate-in slide-in-from-left"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className={`p-2 rounded-full ${getVariantStyles(activity.variant)} transition-transform hover:scale-110`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{activity.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{activity.subtitle}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-medium">{activity.time}</p>
                  {activity.location && (
                    <p className="text-xs text-muted-foreground">{activity.location}</p>
                  )}
                </div>
                {showDetails && (
                  <Button variant="outline" size="sm" className="hover:bg-primary hover:text-primary-foreground transition-colors">
                    Ver
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
