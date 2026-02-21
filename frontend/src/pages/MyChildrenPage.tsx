import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorState } from '@/components/common/ErrorState';
import { Plus, Calendar, User, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AddChildDialog } from '@/components/children/AddChildDialog';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';

interface AllergyInfo {
  has_allergies: boolean;
  allergy_type?: string;
  allergy_severity?: string;
  allergy_treatment?: string;
  additional_notes?: string;
}

function parseAllergyInfo(medicalInfo: string | null | undefined): AllergyInfo | null {
  if (!medicalInfo) return null;
  try {
    const parsed = JSON.parse(medicalInfo);
    if (parsed.has_allergies) return parsed as AllergyInfo;
    return null;
  } catch {
    // Legacy plain text format — check if it mentions allergies
    if (medicalInfo.toLowerCase().includes('alergia')) {
      return { has_allergies: true, allergy_type: medicalInfo };
    }
    return null;
  }
}


export default function MyChildrenPage() {
  const { user } = useAuth();
  const [showAddDialog, setShowAddDialog] = useState(false);



  const { data: children, isLoading, error, refetch } = useQuery({
    queryKey: ['children', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('children')
        .select('*')
        .eq('parent_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Demo data only for demo users
  const displayChildren = children || [];

  if (isLoading) {
    return <LoadingSpinner fullScreen text="Cargando tus hijos..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Mis Hijos</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona la información de tus hijos y sus actividades deportivas
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Añadir Hijo
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {displayChildren?.map((child) => (
          <Card key={child.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="w-12 h-12 border border-primary/10">
                    <AvatarImage src={child.avatar_url || ''} className="object-cover" />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-white font-semibold text-lg">
                      {child.full_name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-lg">{child.full_name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {new Date(child.date_of_birth).toLocaleDateString('es-CO', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
                {/* Allergy Icon */}
                {(() => {
                  const allergyInfo = parseAllergyInfo(child.medical_info);
                  if (!allergyInfo) return null;
                  return (
                    <HoverCard>
                      <HoverCardTrigger asChild>
                        <button className="flex-shrink-0 p-1.5 rounded-full bg-orange-100 dark:bg-orange-950/40 hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors cursor-pointer" aria-label="Información de alergias">
                          <AlertTriangle className="w-5 h-5 text-orange-500" />
                        </button>
                      </HoverCardTrigger>
                      <HoverCardContent className="w-72 border-orange-200 dark:border-orange-800">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-orange-500" />
                            <h4 className="text-sm font-semibold text-orange-600 dark:text-orange-400">Información de Alergias</h4>
                          </div>
                          <div className="space-y-1.5 text-sm">
                            {allergyInfo.allergy_type && (
                              <div>
                                <span className="font-medium text-muted-foreground">Tipo:</span>{' '}
                                <span>{allergyInfo.allergy_type}</span>
                              </div>
                            )}
                            {allergyInfo.allergy_severity && (
                              <div>
                                <span className="font-medium text-muted-foreground">Severidad:</span>{' '}
                                <span className={allergyInfo.allergy_severity === 'alta' || allergyInfo.allergy_severity === 'Alta' ? 'text-red-500 font-semibold' : ''}>
                                  {allergyInfo.allergy_severity}
                                </span>
                              </div>
                            )}
                            {allergyInfo.allergy_treatment && (
                              <div>
                                <span className="font-medium text-muted-foreground">Tratamiento:</span>{' '}
                                <span>{allergyInfo.allergy_treatment}</span>
                              </div>
                            )}
                            {allergyInfo.additional_notes && (
                              <div className="pt-1 border-t border-muted">
                                <span className="font-medium text-muted-foreground">Notas:</span>{' '}
                                <span className="text-xs">{allergyInfo.additional_notes}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  );
                })()}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">

              {(child as any).school_name && (
                <div className="text-xs text-muted-foreground">
                  🏫 {(child as any).school_name}
                </div>
              )}
              {(child as any).monthly_fee && (
                <div className="text-sm font-semibold text-primary">
                  💰 Mensualidad: {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format((child as any).monthly_fee)}
                </div>
              )}
              <div className="pt-3 space-y-2">
                <Link to={`/children/${child.id}/progress`}>
                  <Button variant="outline" size="sm" className="w-full">
                    <User className="w-4 h-4 mr-2" />
                    Ver Progreso
                  </Button>
                </Link>
                <Link to={`/children/${child.id}/attendance`}>
                  <Button variant="outline" size="sm" className="w-full">
                    <Calendar className="w-4 h-4 mr-2" />
                    Ver Asistencias
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AddChildDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSuccess={refetch}
      />
    </div>
  );
}
