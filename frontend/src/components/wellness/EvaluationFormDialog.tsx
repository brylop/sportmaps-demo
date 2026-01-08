import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

interface EvaluationFormData {
  athlete_name: string;
  athlete_id?: string;
  evaluation_type: string;
  score: number;
  recommendations: string;
  follow_up_date?: string;
  metrics: Record<string, number>;
}

interface EvaluationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: EvaluationFormData) => void;
  isLoading?: boolean;
}

const evaluationTypes = [
  'Evaluación Física General',
  'Evaluación Nutricional',
  'Fisioterapia',
  'Rehabilitación',
  'Control de Peso',
  'Análisis de Rendimiento',
  'Evaluación Postural',
  'Test de Fuerza'
];

export function EvaluationFormDialog({ 
  open, 
  onOpenChange, 
  onSubmit, 
  isLoading 
}: EvaluationFormDialogProps) {
  const [formData, setFormData] = useState<EvaluationFormData>({
    athlete_name: '',
    evaluation_type: '',
    score: 0,
    recommendations: '',
    follow_up_date: '',
    metrics: {
      peso: 0,
      altura: 0,
      imc: 0,
      grasa_corporal: 0,
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const updateMetric = (key: string, value: number) => {
    setFormData({
      ...formData,
      metrics: { ...formData.metrics, [key]: value }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva Evaluación</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="athlete_name">Nombre del Atleta *</Label>
              <Input
                id="athlete_name"
                value={formData.athlete_name}
                onChange={(e) => setFormData({ ...formData, athlete_name: e.target.value })}
                placeholder="Nombre completo"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="evaluation_type">Tipo de Evaluación *</Label>
              <Select
                value={formData.evaluation_type}
                onValueChange={(value) => setFormData({ ...formData, evaluation_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona tipo" />
                </SelectTrigger>
                <SelectContent>
                  {evaluationTypes.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Métricas Físicas</Label>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Peso (kg)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={formData.metrics.peso || ''}
                  onChange={(e) => updateMetric('peso', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Altura (cm)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.metrics.altura || ''}
                  onChange={(e) => updateMetric('altura', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">IMC</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={formData.metrics.imc || ''}
                  onChange={(e) => updateMetric('imc', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Grasa (%)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={formData.metrics.grasa_corporal || ''}
                  onChange={(e) => updateMetric('grasa_corporal', parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="score">Puntuación General (0-100)</Label>
              <Input
                id="score"
                type="number"
                min="0"
                max="100"
                value={formData.score}
                onChange={(e) => setFormData({ ...formData, score: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="follow_up_date">Fecha de Seguimiento</Label>
              <Input
                id="follow_up_date"
                type="date"
                value={formData.follow_up_date}
                onChange={(e) => setFormData({ ...formData, follow_up_date: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recommendations">Recomendaciones</Label>
            <Textarea
              id="recommendations"
              value={formData.recommendations}
              onChange={(e) => setFormData({ ...formData, recommendations: e.target.value })}
              placeholder="Recomendaciones para el atleta..."
              rows={4}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar Evaluación
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}