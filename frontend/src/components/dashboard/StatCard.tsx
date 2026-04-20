import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCardProps } from '@/types/dashboard';
import { TrendingUp, TrendingDown } from 'lucide-react';

export function StatCard({ title, value, description, icon: Icon, trend, splitValue, splitTitle, splitIcon: SplitIcon }: StatCardProps) {
  // ── Split mode: two equal metrics side by side ──────────────────────────────
  if (splitValue !== undefined && splitTitle && SplitIcon) {
    return (
      <Card className="hover:shadow-performance hover:scale-105 transition-all duration-300 group h-full flex flex-col">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-medium text-muted-foreground line-clamp-1">{title}</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 flex-1">
          <div className="grid grid-cols-2 gap-0 h-full">
            {/* Left metric */}
            <div className="flex flex-col items-center justify-center gap-1.5 pr-3 border-r border-border">
              <div className="p-2 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div className="text-2xl font-bold">{value}</div>
              <p className="text-xs text-muted-foreground text-center leading-tight">{title}</p>
            </div>
            {/* Right metric */}
            <div className="flex flex-col items-center justify-center gap-1.5 pl-3">
              <div className="p-2 rounded-full bg-violet-500/10 group-hover:bg-violet-500/20 transition-colors">
                <SplitIcon className="h-4 w-4 text-violet-500" />
              </div>
              <div className="text-2xl font-bold">{splitValue}</div>
              <p className="text-xs text-muted-foreground text-center leading-tight">{splitTitle}</p>
            </div>
          </div>
          {description && (
            <p className="text-xs text-muted-foreground text-center mt-2 line-clamp-1">{description}</p>
          )}
        </CardContent>
      </Card>
    );
  }

  // ── Standard mode ──────────────────────────────────────────────────────────
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
