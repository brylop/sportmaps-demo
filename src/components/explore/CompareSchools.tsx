import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Trophy, X, MapPin, Star, DollarSign, Users, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface School {
  id: string;
  name: string;
  city: string;
  rating: number;
  total_reviews: number;
  sports: string[];
  description: string | null;
}

interface CompareSchoolsProps {
  schools: School[];
}

export function CompareSchools({ schools }: CompareSchoolsProps) {
  const [open, setOpen] = useState(false);
  const [selectedSchools, setSelectedSchools] = useState<string[]>([]);
  const navigate = useNavigate();

  const toggleSchool = (schoolId: string) => {
    setSelectedSchools(prev => {
      if (prev.includes(schoolId)) {
        return prev.filter(id => id !== schoolId);
      }
      if (prev.length >= 3) {
        return prev;
      }
      return [...prev, schoolId];
    });
  };

  const compareSchools = schools.filter(s => selectedSchools.includes(s.id));

  return (
    <>
      <Button 
        onClick={() => setOpen(true)}
        variant="outline"
        className="gap-2"
        disabled={schools.length === 0}
      >
        <Trophy className="h-4 w-4" />
        Comparar Escuelas {selectedSchools.length > 0 && `(${selectedSchools.length})`}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Comparar Escuelas Deportivas
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Selection Panel */}
            {compareSchools.length < 3 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">
                    Selecciona hasta 3 escuelas para comparar (actualmente {selectedSchools.length}/3)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 max-h-60 overflow-y-auto">
                    {schools.map((school) => (
                      <div 
                        key={school.id}
                        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                        onClick={() => toggleSchool(school.id)}
                      >
                        <Checkbox 
                          checked={selectedSchools.includes(school.id)}
                          onCheckedChange={() => toggleSchool(school.id)}
                        />
                        <div className="flex-1">
                          <p className="font-medium">{school.name}</p>
                          <p className="text-sm text-muted-foreground">{school.city}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                          <span className="text-sm font-medium">{school.rating.toFixed(1)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Comparison Table */}
            {compareSchools.length > 0 && (
              <div className="overflow-x-auto">
                <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${compareSchools.length}, 1fr)` }}>
                  {compareSchools.map((school) => (
                    <Card key={school.id} className="relative">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2 h-6 w-6 p-0"
                        onClick={() => toggleSchool(school.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      
                      <CardHeader>
                        <CardTitle className="text-lg pr-8">{school.name}</CardTitle>
                      </CardHeader>
                      
                      <CardContent className="space-y-4">
                        {/* Location */}
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            Ubicación
                          </p>
                          <p className="text-sm">{school.city}</p>
                        </div>

                        {/* Rating */}
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1">
                            <Star className="h-3 w-3" />
                            Calificación
                          </p>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                              <span className="font-semibold">{school.rating.toFixed(1)}</span>
                            </div>
                            <span className="text-sm text-muted-foreground">
                              ({school.total_reviews})
                            </span>
                          </div>
                        </div>

                        {/* Sports */}
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-2">Deportes</p>
                          <div className="flex flex-wrap gap-1">
                            {school.sports.slice(0, 4).map((sport) => (
                              <Badge key={sport} variant="secondary" className="text-xs">
                                {sport}
                              </Badge>
                            ))}
                            {school.sports.length > 4 && (
                              <Badge variant="secondary" className="text-xs">
                                +{school.sports.length - 4}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Description */}
                        {school.description && (
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-1">Descripción</p>
                            <p className="text-sm line-clamp-3">{school.description}</p>
                          </div>
                        )}

                        {/* Action Button */}
                        <Button 
                          className="w-full mt-4"
                          onClick={() => {
                            navigate(`/schools/${school.id}`);
                            setOpen(false);
                          }}
                        >
                          Ver Detalles
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {compareSchools.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Selecciona al menos una escuela para comparar
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
