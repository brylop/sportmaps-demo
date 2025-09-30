import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Calendar, MapPin, Trophy, X, Building2 } from 'lucide-react';
import { useEnrollments } from '@/hooks/useEnrollments';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';
import { useNavigate } from 'react-router-dom';

export default function MyEnrollmentsPage() {
  const { activeEnrollments, pastEnrollments, loading, cancelEnrollment } = useEnrollments();
  const navigate = useNavigate();

  if (loading) {
    return <LoadingSpinner fullScreen text="Cargando inscripciones..." />;
  }

  const EnrollmentCard = ({ enrollment, isPast = false }: { enrollment: any; isPast?: boolean }) => (
    <Card key={enrollment.id} className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-xl mb-2">{enrollment.program.name}</CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Building2 className="h-4 w-4" />
              <span>{enrollment.program.school.name}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{enrollment.program.school.city}</span>
            </div>
          </div>
          <Badge variant={isPast ? 'secondary' : 'default'}>
            <Trophy className="h-3 w-3 mr-1" />
            {enrollment.program.sport}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span>
            Inicio: {new Date(enrollment.start_date).toLocaleDateString('es-CO', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </span>
        </div>

        {enrollment.end_date && (
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>
              Fin: {new Date(enrollment.end_date).toLocaleDateString('es-CO', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
        )}

        <div className="pt-2">
          <Badge
            variant={
              enrollment.status === 'active'
                ? 'default'
                : enrollment.status === 'cancelled'
                ? 'destructive'
                : 'secondary'
            }
          >
            {enrollment.status === 'active'
              ? 'Activo'
              : enrollment.status === 'cancelled'
              ? 'Cancelado'
              : 'Completado'}
          </Badge>
        </div>

        {!isPast && (
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/schools/${enrollment.program.school_id}`)}
              className="flex-1"
            >
              Ver Escuela
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <X className="h-4 w-4 mr-1" />
                  Cancelar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Cancelar inscripción?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción cancelará tu inscripción a{' '}
                    <strong>{enrollment.program.name}</strong>. Esta acción no se puede deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>No, mantener</AlertDialogCancel>
                  <AlertDialogAction onClick={() => cancelEnrollment(enrollment.id)}>
                    Sí, cancelar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="container max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mis Inscripciones</h1>
        <p className="text-muted-foreground">
          Gestiona tus programas deportivos activos y revisa tu historial
        </p>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="active">
            Activas ({activeEnrollments.length})
          </TabsTrigger>
          <TabsTrigger value="past">
            Historial ({pastEnrollments.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-6">
          {activeEnrollments.length === 0 ? (
            <EmptyState
              icon={Trophy}
              title="No tienes inscripciones activas"
              description="Explora escuelas deportivas y encuentra el programa perfecto para ti"
              actionLabel="Explorar Escuelas"
              onAction={() => navigate('/explore')}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {activeEnrollments.map((enrollment) => (
                <EnrollmentCard key={enrollment.id} enrollment={enrollment} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="past" className="mt-6">
          {pastEnrollments.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No hay historial de inscripciones"
              description="Tus inscripciones completadas o canceladas aparecerán aquí"
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {pastEnrollments.map((enrollment) => (
                <EnrollmentCard key={enrollment.id} enrollment={enrollment} isPast />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
