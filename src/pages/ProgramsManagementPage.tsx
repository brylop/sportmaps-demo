import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Users, Calendar, MapPin, DollarSign } from 'lucide-react';
import { ProgramFormDialog } from '@/components/school/ProgramFormDialog';

export default function ProgramsManagementPage() {
  const { user } = useAuth();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [schoolId, setSchoolId] = useState<string | null>(null);

  // Fetch school for current user
  const { data: school } = useQuery({
    queryKey: ['user-school', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schools')
        .select('id')
        .eq('owner_id', user?.id)
        .single();
      if (error) return null;
      setSchoolId(data?.id || null);
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch programs
  const { data: programs, refetch } = useQuery({
    queryKey: ['school-programs', schoolId],
    queryFn: async () => {
      if (!schoolId) return [];
      const { data, error } = await supabase
        .from('programs')
        .select('*')
        .eq('school_id', schoolId)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!schoolId,
  });

  // Demo data if no programs
  const displayPrograms = programs?.length ? programs : [
    { id: '1', name: 'Fútbol Sub-12', sport: 'Fútbol', schedule: 'Ma/Ju 4:00 PM - 6:00 PM', price_monthly: 150000, current_participants: 20, max_participants: 20 },
    { id: '2', name: 'Tenis Infantil', sport: 'Tenis', schedule: 'Lu/Mi 3:00 PM - 4:30 PM', price_monthly: 180000, current_participants: 8, max_participants: 12 },
    { id: '3', name: 'Fútbol Sub-10', sport: 'Fútbol', schedule: 'Ma/Ju 3:00 PM - 4:30 PM', price_monthly: 150000, current_participants: 18, max_participants: 20 },
  ];

  const getCapacityBadge = (current: number, max: number | null) => {
    if (!max) return <Badge className="bg-green-500">Disponible</Badge>;
    const percentage = (current / max) * 100;
    if (percentage === 100) return <Badge className="bg-red-500">Lleno</Badge>;
    if (percentage >= 80) return <Badge className="bg-yellow-500">Casi lleno</Badge>;
    return <Badge className="bg-green-500">Disponible</Badge>;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold font-poppins">Programas</h1>
          <p className="text-muted-foreground">Catálogo de productos y servicios</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Crear Nuevo Programa
        </Button>
      </div>

      <ProgramFormDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        schoolId={schoolId || 'demo-school'}
        onSuccess={refetch}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {displayPrograms.map((program) => (
          <Card key={program.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>{program.name}</CardTitle>
                  <CardDescription>{program.sport}</CardDescription>
                </div>
                {getCapacityBadge(program.current_participants || 0, program.max_participants || null)}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center text-sm text-muted-foreground">
                <Users className="mr-2 h-4 w-4" />
                <span className="font-medium">Cupos:</span>
                <span className="ml-2">{program.current_participants || 0}/{program.max_participants || '∞'}</span>
              </div>
              <div className="flex items-center text-sm text-muted-foreground">
                <Calendar className="mr-2 h-4 w-4" />
                <span className="font-medium">Horario:</span>
                <span className="ml-2">{program.schedule}</span>
              </div>
              <div className="flex items-center text-sm text-muted-foreground">
                <DollarSign className="mr-2 h-4 w-4" />
                <span className="font-medium">Precio:</span>
                <span className="ml-2">${(program.price_monthly || 0).toLocaleString()} / Mes</span>
              </div>
              <div className="flex gap-2 pt-4">
                <Button variant="outline" size="sm" className="flex-1">Editar</Button>
                <Button variant="ghost" size="sm" className="flex-1">Ver Alumnos</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
              </div>
              <div className="flex items-center text-sm text-muted-foreground">
                <Calendar className="mr-2 h-4 w-4" />
                <span className="font-medium">Horario:</span>
                <span className="ml-2">{program.schedule}</span>
              </div>
              <div className="flex items-center text-sm text-muted-foreground">
                <MapPin className="mr-2 h-4 w-4" />
                <span className="font-medium">Instalación:</span>
                <span className="ml-2">{program.facility}</span>
              </div>
              <div className="flex items-center text-sm text-muted-foreground">
                <DollarSign className="mr-2 h-4 w-4" />
                <span className="font-medium">Precio:</span>
                <span className="ml-2">${program.price.toLocaleString()} / Mes</span>
              </div>
              <div className="flex gap-2 pt-4">
                <Button variant="outline" size="sm" className="flex-1">Editar</Button>
                <Button variant="ghost" size="sm" className="flex-1">Ver Alumnos</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
