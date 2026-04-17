import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { MapPin, Star, Instagram, Phone, DollarSign, Clock, Award, ChevronLeft, ExternalLink } from 'lucide-react';

const BFF_URL = import.meta.env.VITE_BFF_URL || 'http://localhost:3000';

interface PublicProfile {
  id: string;
  user_id: string;
  display_name: string | null;
  tagline: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_image_url: string | null;
  primary_sport: string | null;
  secondary_sports: string[] | null;
  specialties: string[] | null;
  experience_years: number | null;
  certifications: any;
  rate_per_session: number | null;
  rate_currency: string;
  rate_notes: string | null;
  city: string | null;
  modality: string;
  instagram_url: string | null;
  whatsapp_number: string | null;
  rating: number;
  review_count: number;
}

export default function TrainerPublicProfile() {
  const { userId } = useParams<{ userId: string }>();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [availability, setAvailability] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${BFF_URL}/api/v1/trainer/public/${userId}`);
        if (res.status === 404) { setNotFound(true); return; }
        const data = await res.json();
        setProfile(data);
        
        if (data.school_id) {
          const { data: avail } = await supabase
            .from('coach_availability')
            .select('day_of_week, start_time, end_time')
            .eq('school_id', data.school_id)
            .eq('available_for_personal_classes', true)
            .order('day_of_week')
            .order('start_time');
          setAvailability(avail ?? []);
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [userId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
        <p className="text-2xl font-bold mb-2">Perfil no encontrado</p>
        <p className="text-muted-foreground mb-6">Este entrenador aún no ha publicado su perfil.</p>
        <Link to="/explore">
          <Button variant="outline">Explorar SportMaps</Button>
        </Link>
      </div>
    );
  }

  const modalityLabel = { presencial: '📍 Presencial', virtual: '💻 Virtual', ambas: '🌐 Presencial y Virtual' }[profile.modality] ?? profile.modality;

  return (
    <div className="min-h-screen bg-background">
      {/* Cover */}
      <div className="relative h-52 sm:h-72 bg-gradient-to-br from-primary/20 via-primary/10 to-background overflow-hidden">
        {profile.cover_image_url && (
          <img src={profile.cover_image_url} alt="Cover" className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
        <div className="absolute top-4 left-4">
          <Link to="/explore">
            <Button size="sm" variant="outline" className="gap-2 bg-background/80 backdrop-blur">
              <ChevronLeft className="h-4 w-4" />
              Volver
            </Button>
          </Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 -mt-16 sm:-mt-20 pb-16 relative">
        {/* Avatar + name */}
        <div className="flex items-end gap-4 mb-6">
          <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-2xl border-4 border-background bg-primary/10 flex items-center justify-center text-4xl font-bold text-primary shadow-xl flex-shrink-0 overflow-hidden">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.display_name ?? ''} className="h-full w-full object-cover" />
            ) : (
              (profile.display_name ?? 'T').substring(0, 2).toUpperCase()
            )}
          </div>
          <div className="pb-2">
            <h1 className="text-2xl font-bold tracking-tight">{profile.display_name ?? 'Entrenador Personal'}</h1>
            {profile.tagline && <p className="text-muted-foreground text-sm mt-0.5">{profile.tagline}</p>}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {profile.primary_sport && <Badge variant="secondary">{profile.primary_sport}</Badge>}
              <span className="text-xs text-muted-foreground">{modalityLabel}</span>
              {profile.city && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />{profile.city}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {profile.bio && (
              <Card className="border-border/50">
                <CardContent className="p-5">
                  <h2 className="font-semibold mb-3">Sobre mí</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{profile.bio}</p>
                </CardContent>
              </Card>
            )}

            {profile.specialties && profile.specialties.length > 0 && (
              <Card className="border-border/50">
                <CardContent className="p-5">
                  <h2 className="font-semibold mb-3">Especialidades</h2>
                  <div className="flex flex-wrap gap-2">
                    {profile.specialties.map(s => (
                      <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {profile.experience_years && (
              <Card className="border-border/50">
                <CardContent className="p-5 flex items-center gap-3">
                  <Award className="h-5 w-5 text-primary flex-shrink-0" />
                  <p className="text-sm"><strong>{profile.experience_years} años</strong> de experiencia entrenando</p>
                </CardContent>
              </Card>
            )}

            {availability.length > 0 && (
              <Card className="border-border/50">
                <CardContent className="p-5">
                  <h2 className="font-semibold mb-4 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    Horarios disponibles
                  </h2>
                  <div className="space-y-3">
                    {['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'].map((day, idx) => {
                      const slots = availability.filter((a: any) => a.day_of_week === idx);
                      if (slots.length === 0) return null;
                      return (
                        <div key={idx} className="flex items-start gap-3">
                          <span className="text-xs font-semibold w-24 text-muted-foreground pt-1 shrink-0">
                            {day}
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {slots.map((slot: any, i: number) => (
                              <Badge key={i} variant="outline" className="text-xs font-mono">
                                {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Rate */}
            {profile.rate_per_session && (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm">Tarifa</span>
                  </div>
                  <p className="text-2xl font-bold">
                    {profile.rate_per_session.toLocaleString('es-CO')}
                    <span className="text-sm font-normal text-muted-foreground ml-1">{profile.rate_currency}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">por sesión</p>
                  {profile.rate_notes && <p className="text-xs text-muted-foreground mt-2 border-t border-primary/20 pt-2">{profile.rate_notes}</p>}
                </CardContent>
              </Card>
            )}

            {/* Rating */}
            {profile.review_count > 0 && (
              <Card className="border-border/50">
                <CardContent className="p-4 flex items-center gap-3">
                  <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
                  <div>
                    <p className="font-bold">{profile.rating.toFixed(1)}</p>
                    <p className="text-xs text-muted-foreground">{profile.review_count} reseñas</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Contact buttons */}
            <div className="space-y-2">
              {profile.whatsapp_number && (
                <a href={`https://wa.me/${profile.whatsapp_number.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                  <Button className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white">
                    <Phone className="h-4 w-4" />
                    Contactar por WhatsApp
                  </Button>
                </a>
              )}
              {profile.instagram_url && (
                <a href={profile.instagram_url} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="w-full gap-2">
                    <Instagram className="h-4 w-4" />
                    Ver Instagram
                    <ExternalLink className="h-3 w-3 ml-auto" />
                  </Button>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
