import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Star, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface School {
  id: string;
  name: string;
  city: string;
  rating: number;
  sports: string[];
  logo_url: string | null;
}

export function FeaturedSchools() {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSchools = async () => {
      try {
        const { data, error } = await supabase
          .from('schools')
          .select('id, name, city, rating, sports, logo_url')
          .eq('verified', true)
          .order('rating', { ascending: false })
          .limit(3);

        if (error) throw error;
        setSchools(data || []);
      } catch (error) {
        console.error('Error fetching schools:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSchools();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <h3 className="text-2xl font-bold">Escuelas Destacadas</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6 space-y-4">
                <div className="w-16 h-16 bg-muted rounded-full" />
                <div className="h-6 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (schools.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-bold">Escuelas Destacadas</h3>
        <Link to="/explore">
          <Button variant="link" className="text-primary">
            Ver todas →
          </Button>
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {schools.map((school) => (
          <Link key={school.id} to={`/schools/${school.id}`}>
            <Card className="h-full hover:shadow-card transition-all duration-300 hover:scale-105 cursor-pointer group">
              <CardContent className="p-6 space-y-4">
                {/* Logo and Badge */}
                <div className="flex items-start justify-between">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-3xl group-hover:bg-primary/20 transition-colors">
                    {school.logo_url ? (
                      <img 
                        src={school.logo_url} 
                        alt={school.name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      '🏆'
                    )}
                  </div>
                  {school.sports[0] && (
                    <Badge variant="secondary" className="text-xs">
                      {school.sports[0]}
                    </Badge>
                  )}
                </div>

                {/* School Info */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-lg group-hover:text-primary transition-colors">
                    {school.name}
                  </h4>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    {school.city}
                  </div>
                </div>

                {/* Rating and Students */}
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                    <span className="font-medium">{school.rating}</span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>Ver detalles</span>
                  </div>
                </div>

                {/* Action Button */}
                <Button variant="outline" className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  Ver detalles
                </Button>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
