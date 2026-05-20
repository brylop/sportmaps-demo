import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ClipboardList, CheckCircle2, Pencil, Trash2, Clock } from 'lucide-react';

interface SessionPlanCardProps {
  plan: {
    id: string;
    name: string;
    session_date: string;
    status: 'draft' | 'assigned' | 'completed' | 'cancelled';
    blocks: any[];
    results?: any;
    custom_notes?: string;
  };
  onComplete: (plan: any) => void;
  onEdit: (plan: any) => void;
  onDelete: (id: string) => void;
}

const STATUS_CONFIG = {
  draft: { label: 'Borrador', color: 'bg-muted text-muted-foreground border-border/50' },
  assigned: { label: 'Asignado', color: 'bg-primary/10 text-primary border-primary/20' },
  completed: { label: 'Completado', color: 'bg-secondary text-secondary-foreground border-secondary-foreground/10' },
  cancelled: { label: 'Cancelado', color: 'bg-destructive/10 text-destructive border-destructive/20' },
};

export function SessionPlanCard({ plan, onComplete, onEdit, onDelete }: SessionPlanCardProps) {
  const status = STATUS_CONFIG[plan.status];
  const dateObj = new Date(plan.session_date + 'T12:00:00');
  const isCompleted = plan.status === 'completed';

  return (
    <Card className={`overflow-hidden border-l-4 transition-all hover:shadow-lg hover:shadow-primary/5 ${isCompleted ? 'border-l-muted bg-muted/5 opacity-80' : 'border-l-primary bg-primary/5'}`}>
      <CardContent className="p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`flex flex-col items-center justify-center h-14 w-14 rounded-xl border shadow-sm shrink-0 ${isCompleted ? 'bg-muted/20' : 'bg-primary/10 border-primary/20'}`}>
              <span className={`text-[10px] uppercase font-bold ${isCompleted ? 'text-muted-foreground' : 'text-primary'}`}>
                {dateObj.toLocaleDateString('es-CO', { month: 'short' })}
              </span>
              <span className={`text-xl font-black leading-none ${isCompleted ? '' : 'text-primary'}`}>
                {dateObj.getDate()}
              </span>
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-lg leading-tight">{plan.name}</h4>
                <Badge variant="outline" className={`text-[9px] uppercase font-extrabold ${status.color}`}>
                  {status.label}
                </Badge>
              </div>
              
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground font-medium">
                <span className="flex items-center gap-1">
                  <ClipboardList className="h-3 w-3" />
                  {plan.blocks?.length || 0} Ejercicios
                </span>
                {plan.custom_notes && (
                  <span className="flex items-center gap-1 italic">
                    <CheckCircle2 className="h-3 w-3 text-primary" />
                    Con notas personalizadas
                  </span>
                )}
                {isCompleted && plan.results?.actual_duration_minutes && (
                  <span className="flex items-center gap-1 text-green-600">
                    <Clock className="h-3 w-3" />
                    {plan.results.actual_duration_minutes} min reales
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-center">
            {plan.status !== 'completed' && (
              <>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="gap-2 h-9 border-primary/20 hover:bg-primary/5"
                  onClick={() => onEdit(plan)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Editar
                </Button>
                <Button 
                  size="sm" 
                  className="gap-2 h-9 bg-primary shadow-lg shadow-primary/20"
                  onClick={() => onComplete(plan)}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Completar
                </Button>
              </>
            )}
            
            <Button 
              size="icon" 
              variant="ghost" 
              className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={() => onDelete(plan.id)}
              disabled={plan.status === 'completed'}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {isCompleted && plan.results?.performance_note && (
          <div className="mt-4 p-3 bg-white/50 rounded-lg border border-green-500/10 text-xs text-muted-foreground italic leading-relaxed">
            " {plan.results.performance_note} "
          </div>
        )}
      </CardContent>
    </Card>
  );
}
