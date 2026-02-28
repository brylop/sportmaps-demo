import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCardProps } from '@/types/dashboard';
import { TrendingUp, TrendingDown } from 'lucide-react';

export function StatCard({ title, value, description, icon: Icon, trend }: StatCardProps) {
  return (
    // h-full + flex flex-col justify-between garantiza altura uniforme en el grid
    <Card className="hover:shadow-performance hover:scale-105 transition-all duration-300 group h-full flex flex-col justify-between">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium line-clamp-1">{title}</CardTitle>
        <div className="p-2 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors shrink-0">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        {/* text-xl en móvil, text-2xl en sm+ para que no desborde */}
        <div className="text-xl sm:text-2xl font-bold animate-in fade-in duration-500 truncate">
          {value}
        </div>
        {(description || trend) && (
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {trend && (
              <span className={`flex items-center text-xs font-medium shrink-0 ${trend.positive ? 'text-green-600' : 'text-red-600'
                }`}>
                {trend.positive ? (
                  <TrendingUp className="h-3 w-3 mr-1" />
                ) : (
                  <TrendingDown className="h-3 w-3 mr-1" />
                )}
                {trend.value}
              </span>
            )}
            {description && (
              // line-clamp-1 evita que descripciones largas rompan la altura del grid
              <p className="text-xs text-muted-foreground line-clamp-1">{description}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
