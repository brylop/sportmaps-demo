import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Plus, Apple, Salad, Beef, Droplets, Target, User, AlertCircle } from 'lucide-react';

interface NutritionPlan {
  id: string;
  athlete: string;
  goal: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  status: 'active' | 'completed' | 'draft';
  startDate: string;
  endDate: string;
}

const mockPlans: NutritionPlan[] = [
  { id: '1', athlete: 'Miguel Torres', goal: 'Aumento masa muscular', calories: 3200, protein: 180, carbs: 400, fat: 80, status: 'active', startDate: '2025-12-01', endDate: '2026-02-28' },
  { id: '2', athlete: 'Sofía Ramírez', goal: 'Definición', calories: 1800, protein: 140, carbs: 150, fat: 60, status: 'active', startDate: '2025-12-15', endDate: '2026-01-31' },
  { id: '3', athlete: 'Diego Fernández', goal: 'Rendimiento maratón', calories: 2800, protein: 120, carbs: 450, fat: 70, status: 'active', startDate: '2025-11-01', endDate: '2026-03-15' },
  { id: '4', athlete: 'Valentina Castro', goal: 'Recuperación lesión', calories: 2200, protein: 150, carbs: 250, fat: 65, status: 'completed', startDate: '2025-10-01', endDate: '2025-12-15' },
];

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  active: { label: 'Activo', variant: 'default' },
  completed: { label: 'Completado', variant: 'outline' },
  draft: { label: 'Borrador', variant: 'secondary' },
};

export default function NutritionPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('plans');

  const filteredPlans = mockPlans.filter(plan =>
    plan.athlete.toLowerCase().includes(searchTerm.toLowerCase()) ||
    plan.goal.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Planes Nutricionales</h1>
          <p className="text-muted-foreground">Gestiona la nutrición de tus atletas</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Nuevo Plan
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Planes Activos</p>
                <p className="text-2xl font-bold text-primary">
                  {mockPlans.filter(p => p.status === 'active').length}
                </p>
              </div>
              <Salad className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Atletas</p>
                <p className="text-2xl font-bold">{mockPlans.length}</p>
              </div>
              <User className="h-8 w-8 text-orange" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Objetivos Cumplidos</p>
                <p className="text-2xl font-bold text-green-600">
                  {mockPlans.filter(p => p.status === 'completed').length}
                </p>
              </div>
              <Target className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Prom. Calorías</p>
                <p className="text-2xl font-bold">
                  {Math.round(mockPlans.reduce((a, p) => a + p.calories, 0) / mockPlans.length)}
                </p>
              </div>
              <Apple className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="plans">Planes</TabsTrigger>
          <TabsTrigger value="templates">Plantillas</TabsTrigger>
          <TabsTrigger value="foods">Alimentos</TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar planes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {filteredPlans.map((plan) => {
              const status = statusConfig[plan.status];
              return (
                <Card key={plan.id} className="hover:shadow-lg transition-shadow hover:border-primary/50">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{plan.athlete}</CardTitle>
                        <CardDescription>{plan.goal}</CardDescription>
                      </div>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-2 mb-4">
                      <div className="text-center p-2 bg-muted rounded-lg">
                        <Apple className="h-4 w-4 mx-auto mb-1 text-red-500" />
                        <p className="text-xs text-muted-foreground">Calorías</p>
                        <p className="font-bold">{plan.calories}</p>
                      </div>
                      <div className="text-center p-2 bg-muted rounded-lg">
                        <Beef className="h-4 w-4 mx-auto mb-1 text-amber-600" />
                        <p className="text-xs text-muted-foreground">Proteína</p>
                        <p className="font-bold">{plan.protein}g</p>
                      </div>
                      <div className="text-center p-2 bg-muted rounded-lg">
                        <Salad className="h-4 w-4 mx-auto mb-1 text-green-500" />
                        <p className="text-xs text-muted-foreground">Carbos</p>
                        <p className="font-bold">{plan.carbs}g</p>
                      </div>
                      <div className="text-center p-2 bg-muted rounded-lg">
                        <Droplets className="h-4 w-4 mx-auto mb-1 text-yellow-500" />
                        <p className="text-xs text-muted-foreground">Grasas</p>
                        <p className="font-bold">{plan.fat}g</p>
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-sm text-muted-foreground">
                      <span>{plan.startDate} - {plan.endDate}</span>
                      <Button variant="outline" size="sm">Ver Plan</Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="templates">
          <Card>
            <CardContent className="py-12 text-center">
              <Salad className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">Plantillas de Nutrición</h3>
              <p className="text-muted-foreground mb-4">
                Crea plantillas reutilizables para diferentes objetivos
              </p>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Crear Plantilla
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="foods">
          <Card>
            <CardContent className="py-12 text-center">
              <Apple className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">Base de Datos de Alimentos</h3>
              <p className="text-muted-foreground mb-4">
                Gestiona tu catálogo de alimentos con valores nutricionales
              </p>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Agregar Alimento
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}