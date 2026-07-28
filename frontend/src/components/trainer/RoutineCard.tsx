import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, Dumbbell, Play, Trash2, Tag, Flame } from 'lucide-react';

interface RoutineCardProps {
  routine: {
    id: string;
    name: string;
    category: string;
    difficulty: string;
    estimated_minutes: number;
    estimated_calories: number;
    blocks: any[];
    tags: string[];
    times_used: number;
    is_template: boolean;
  };
  onUse: (id: string) => void;
  onClick: (id: string) => void;
  onDelete?: (id: string) => void;
  onTagClick?: (tag: string, e: React.MouseEvent) => void;
}

const CATEGORY_STYLES: Record<string, string> = {
  fuerza: 'from-primary/10 via-primary/5 to-background border-primary/20',
  cardio: 'from-muted via-muted/50 to-background border-border/40',
  funcional: 'from-secondary/10 via-secondary/5 to-background border-secondary/20',
  hiit: 'from-primary/20 via-primary/10 to-background border-primary/30',
  flexibilidad: 'from-muted/40 via-muted/20 to-background border-border/40',
};

const DIFFICULTY_COLORS: Record<string, string> = {
  principiante: 'text-primary bg-primary/10',
  intermedio: 'text-muted-foreground bg-muted',
  avanzado: 'text-destructive bg-destructive/10',
};

export function RoutineCard({ routine, onUse, onClick, onDelete, onTagClick }: RoutineCardProps) {
  const categoryKey = (routine.category || '').toLowerCase();
  const bgStyle = CATEGORY_STYLES[categoryKey] || 'from-slate-500/20 via-slate-500/10 to-background border-slate-500/20';

  return (
    <Card 
      className={`group relative overflow-hidden transition-all hover:shadow-xl hover:-translate-y-1 cursor-pointer border bg-gradient-to-br ${bgStyle}`}
      onClick={() => onClick(routine.id)}
    >
      <CardContent className="p-5 pt-6">
        <div className="flex justify-between items-start mb-4">
          <div className="space-y-1">
            <h3 className="text-xl font-bold tracking-tight leading-none group-hover:text-primary transition-colors">
              {routine.name}
            </h3>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wider">
                {routine.category}
              </Badge>
              <Badge variant="outline" className={`text-[10px] uppercase font-bold tracking-wider ${DIFFICULTY_COLORS[routine.difficulty.toLowerCase()] || ''}`}>
                {routine.difficulty}
              </Badge>
            </div>
          </div>
          {onDelete && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 -mt-1 -mr-1"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(routine.id);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 py-3 border-y border-border/10 bg-background/20 rounded-lg px-2 my-4">
          <div className="flex flex-col items-center text-center">
            <Clock className="h-3.5 w-3.5 text-muted-foreground mb-1" />
            <span className="text-sm font-bold">{routine.estimated_minutes}'</span>
            <span className="text-[9px] text-muted-foreground uppercase font-medium">Min</span>
          </div>
          <div className="flex flex-col items-center text-center border-x border-border/10">
            <Dumbbell className="h-3.5 w-3.5 text-muted-foreground mb-1" />
            <span className="text-sm font-bold">{routine.blocks?.length || 0}</span>
            <span className="text-[9px] text-muted-foreground uppercase font-medium">Ejers</span>
          </div>
          <div className="flex flex-col items-center text-center">
            <Flame className="h-3.5 w-3.5 text-orange-500 mb-1" />
            <span className="text-sm font-bold">{routine.estimated_calories || 0}</span>
            <span className="text-[9px] text-muted-foreground uppercase font-medium">Kcal</span>
          </div>
        </div>

        {routine.tags && routine.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
            <Tag className="h-3 w-3 text-muted-foreground mt-0.5" />
            {routine.tags.slice(0, 3).map(tag => (
              <span 
                key={tag} 
                className="text-[10px] text-muted-foreground bg-slate-500/5 px-1.5 py-0.5 rounded hover:bg-primary/10 hover:text-primary transition-colors"
                onClick={(e) => {
                  if (onTagClick) {
                    e.stopPropagation();
                    onTagClick(tag, e);
                  }
                }}
              >
                #{tag}
              </span>
            ))}
            {routine.tags.length > 3 && (
              <span className="text-[10px] text-muted-foreground">+{routine.tags.length - 3}</span>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="p-4 pt-0">
        <Button 
          className="w-full gap-2 font-bold shadow-lg shadow-primary/10 group/btn"
          onClick={(e) => {
            e.stopPropagation();
            onUse(routine.id);
          }}
        >
          <Play className="h-4 w-4 fill-current group-hover/btn:scale-110 transition-transform" />
          USAR RUTINA
        </Button>
      </CardFooter>
    </Card>
  );
}
