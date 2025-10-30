import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Bell, Plus, Send, Users, UserCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState('parents');
  const [selectedTeamId, setSelectedTeamId] = useState('');

  // Demo teams data
  const demoTeams = [
    {
      id: 'demo-team-1',
      coach_id: user?.id,
      name: 'Fútbol Sub-12',
      sport: 'Fútbol',
      age_group: 'Sub-12',
      season: '2024',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const { data: teamsData } = useQuery({
    queryKey: ['coach-teams', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('coach_id', user?.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const teams = teamsData && teamsData.length > 0 ? teamsData : demoTeams;

  // Demo announcements data
  const demoAnnouncements = [
    {
      id: 'ann-1',
      coach_id: user?.id,
      team_id: 'demo-team-1',
      subject: 'Partido importante este sábado',
      message: 'Recordatorio: El partido contra Tigres FC es este sábado a las 10:00 AM en el Estadio Municipal. Por favor lleguen 30 minutos antes.',
      audience: 'both',
      sent_at: '2024-10-29T10:00:00Z',
      teams: { name: 'Fútbol Sub-12' },
    },
    {
      id: 'ann-2',
      coach_id: user?.id,
      team_id: null,
      subject: 'Entrenamiento cancelado',
      message: 'El entrenamiento de mañana está cancelado por las lluvias. Nos vemos el jueves en el horario habitual.',
      audience: 'parents',
      sent_at: '2024-10-27T18:30:00Z',
      teams: null,
    },
  ];

  const { data: announcementsData, isLoading, refetch } = useQuery({
    queryKey: ['announcements', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('*, teams(name)')
        .eq('coach_id', user?.id)
        .order('sent_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const announcements = announcementsData && announcementsData.length > 0 ? announcementsData : demoAnnouncements;

  const handleSend = async () => {
    try {
      const { error } = await supabase.from('announcements').insert({
        coach_id: user?.id,
        team_id: selectedTeamId || null,
        subject,
        message,
        audience,
      });

      if (error) throw error;

      toast({
        title: '📢 Anuncio enviado',
        description: 'Tu mensaje ha sido enviado exitosamente',
      });

      setDialogOpen(false);
      setSubject('');
      setMessage('');
      refetch();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo enviar el anuncio',
        variant: 'destructive',
      });
    }
  };

  const getAudienceLabel = (aud: string) => {
    switch (aud) {
      case 'parents':
        return 'Padres';
      case 'players':
        return 'Jugadores';
      case 'both':
        return 'Padres y Jugadores';
      default:
        return aud;
    }
  };

  const getAudienceIcon = (aud: string) => {
    switch (aud) {
      case 'parents':
        return <Users className="w-4 h-4" />;
      case 'players':
        return <UserCircle className="w-4 h-4" />;
      case 'both':
        return <Users className="w-4 h-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Anuncios</h1>
          <p className="text-muted-foreground mt-1">
            Comunícate con padres y jugadores
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Nuevo Anuncio
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Anuncio</DialogTitle>
              <DialogDescription>
                Envía un mensaje a tu equipo o a todos tus equipos
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Equipo (Opcional)</Label>
                <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos mis equipos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos mis equipos</SelectItem>
                    {teams?.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Audiencia</Label>
                <Select value={audience} onValueChange={setAudience}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="parents">Padres</SelectItem>
                    <SelectItem value="players">Jugadores</SelectItem>
                    <SelectItem value="both">Padres y Jugadores</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Asunto</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Ej: Práctica cancelada por lluvia"
                />
              </div>

              <div>
                <Label>Mensaje</Label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Escribe tu mensaje aquí..."
                  rows={5}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleSend}
                disabled={!subject.trim() || !message.trim()}
                className="gap-2"
              >
                <Send className="w-4 h-4" />
                Enviar Anuncio
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            <CardTitle>Historial de Anuncios</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {announcements?.map((announcement: any) => (
              <div
                key={announcement.id}
                className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{announcement.subject}</h3>
                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                      <span>
                        {new Date(announcement.sent_at).toLocaleDateString('es-CO', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {announcement.teams && (
                        <>
                          <span>•</span>
                          <span>{announcement.teams.name}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <Badge variant="secondary" className="gap-1">
                    {getAudienceIcon(announcement.audience)}
                    {getAudienceLabel(announcement.audience)}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{announcement.message}</p>
              </div>
            ))}

            {announcements && announcements.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Bell className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p>No has enviado anuncios aún</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {isLoading && <LoadingSpinner text="Cargando anuncios..." />}
    </div>
  );
}
