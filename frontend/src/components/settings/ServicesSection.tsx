import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Briefcase, ChevronRight, Plus, Star } from 'lucide-react';
import { SchoolService } from '@/hooks/useSettings';

interface ServicesSectionProps {
  services: SchoolService[];
  schoolName?: string;
}

export function ServicesSection({ services, schoolName }: ServicesSectionProps) {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              Servicios y Programas
            </CardTitle>
            <CardDescription>
              Gestiona los equipos, clases y servicios que ofrece {schoolName || 'tu academia'}.
            </CardDescription>
          </div>
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Nuevo Servicio
          </Button>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {services.length > 0 ? (
              services.map((service) => (
                <div 
                  key={service.id} 
                  className="group relative flex flex-col p-4 rounded-xl border bg-card hover:shadow-md transition-all duration-200"
                >
                  <div className="flex justify-between items-start mb-3">
                    <Badge variant={service.active ? "default" : "secondary"} className="bg-primary/10 text-primary border-none">
                      {service.active ? 'Activo' : 'Inactivo'}
                    </Badge>
                    <span className="text-sm font-bold text-primary">
                      ${service.price_monthly}/mes
                    </span>
                  </div>
                  
                  <h4 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors">
                    {service.name}
                  </h4>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                    {service.description || 'Sin descripción disponible.'}
                  </p>
                  
                  <div className="mt-auto pt-4 border-t flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground capitalize">
                      <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                      {service.sport}
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 px-2 text-primary gap-1">
                      Gestionar
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full py-12 text-center border-2 border-dashed rounded-xl bg-muted/20">
                <Briefcase className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <h3 className="font-medium text-muted-foreground">No tienes servicios configurados</h3>
                <p className="text-sm text-muted-foreground/60 max-w-xs mx-auto mt-1">
                  Crea tu primer programa deportivo o clase para empezar a recibir inscripciones.
                </p>
                <Button variant="outline" size="sm" className="mt-4 gap-2 border-primary/20 text-primary">
                  <Plus className="h-4 w-4" />
                  Crear Servicio
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            <div className="p-3 bg-white rounded-xl shadow-sm">
              <Star className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold text-primary">Próximamente: SportMaps Shop</h4>
              <p className="text-sm text-primary/80">
                Vende uniformes, accesorios y merchandising directamente desde tu perfil de SportMaps.
              </p>
            </div>
            <Button size="sm" variant="outline" className="sm:ml-auto border-primary/20 text-primary hover:bg-primary/10 transition-colors">
              Suscripción Pro
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
