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
<<<<<<< HEAD
import { EmptyState } from '@/components/common/EmptyState';

// Tipos para los datos de la base de datos
interface Team {
  id: string;
  name: string;
}

interface Announcement {
  id: string;
  subject: string;
  message: string;
  audience: string;
  sent_at: string;
  team_id: string | null;
  teams?: { name: string } | null; // Relación opcional
}

export default function AnnouncementsPage() {
  const { user } = useAuth();
=======

export default function AnnouncementsPage() {
  const { user, profile } = useAuth();
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState('parents');
<<<<<<< HEAD
  const [selectedTeamId, setSelectedTeamId] = useState<string>('all'); // 'all' o un UUID
  const [isSending, setIsSending] = useState(false);

  // 1. Cargar Equipos del Entrenador (para el selector)
  const { data: teams } = useQuery({
    queryKey: ['coach-teams', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('teams')
        .select('id, name')
        .eq('coach_id', user.id);
      
      if (error) throw error;
      return data as Team[];
=======
  const [selectedTeamId, setSelectedTeamId] = useState('');

  // Check if user is demo account
  const isDemoUser = user?.email?.endsWith('@demo.sportmaps.com');

  // Demo teams data (only for demo users)
  const demoTeams = isDemoUser ? [
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
  ] : [];

  const { data: teamsData } = useQuery({
    queryKey: ['coach-teams', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('coach_id', user?.id);
      if (error) throw error;
      return data;
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
    },
    enabled: !!user?.id,
  });

<<<<<<< HEAD
  // 2. Cargar Historial de Anuncios
  const { data: announcements, isLoading, refetch } = useQuery({
    queryKey: ['announcements', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('announcements')
        .select(`
          *,
          teams ( name )
        `)
        .eq('coach_id', user.id)
        .order('sent_at', { ascending: false });

      if (error) throw error;
      
      // FIX: Convertimos a 'any' primero para evitar el error de TypeScript de Supabase
      // cuando no detecta la relación en los tipos generados automáticamente.
      return (data as any[]).map((item) => ({
        ...item,
        teams: item.teams ? { name: item.teams.name } : null
      })) as Announcement[];
=======
  const teams = teamsData && teamsData.length > 0 ? teamsData : (isDemoUser ? demoTeams : []);

  // Demo announcements data (only for demo users)
  const demoAnnouncements = isDemoUser ? [
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
  ] : [];

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
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
    },
    enabled: !!user?.id,
  });

<<<<<<< HEAD
  const handleSend = async () => {
    if (!user) return;
    
    try {
      setIsSending(true);
      
      // Preparar el payload
      const newAnnouncement = {
        coach_id: user.id,
        team_id: selectedTeamId === 'all' ? null : selectedTeamId,
        subject,
        message,
        audience,
        sent_at: new Date().toISOString(), // Timestamp actual
      };

      const { error } = await supabase
        .from('announcements')
        .insert(newAnnouncement);
=======
  const announcements = announcementsData && announcementsData.length > 0 ? announcementsData : (isDemoUser ? demoAnnouncements : []);

  const handleSend = async () => {
    try {
      const { error } = await supabase.from('announcements').insert({
        coach_id: user?.id,
        team_id: selectedTeamId || null,
        subject,
        message,
        audience,
      });
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3

      if (error) throw error;

      toast({
        title: '📢 Anuncio enviado',
<<<<<<< HEAD
        description: 'Tu mensaje ha sido enviado exitosamente.',
      });

      // Limpiar formulario y cerrar modal
      setDialogOpen(false);
      setSubject('');
      setMessage('');
      setAudience('parents');
      setSelectedTeamId('all');
      
      // Recargar la lista
      refetch();

    } catch (error: any) {
      console.error('Error sending announcement:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo enviar el anuncio.',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
=======
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
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
    }
  };

  const getAudienceLabel = (aud: string) => {
    switch (aud) {
<<<<<<< HEAD
      case 'parents': return 'Padres';
      case 'players': return 'Jugadores';
      case 'both': return 'Todos';
      default: return aud;
=======
      case 'parents':
        return 'Padres';
      case 'players':
        return 'Jugadores';
      case 'both':
        return 'Padres y Jugadores';
      default:
        return aud;
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
    }
  };

  const getAudienceIcon = (aud: string) => {
    switch (aud) {
<<<<<<< HEAD
      case 'parents': return <Users className="w-3 h-3" />;
      case 'players': return <UserCircle className="w-3 h-3" />;
      default: return <Users className="w-3 h-3" />;
    }
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen text="Cargando anuncios..." />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Anuncios</h1>
          <p className="text-muted-foreground mt-1">
            Comunícate con padres y jugadores de tus equipos
          </p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 w-full sm:w-auto">
=======
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
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
              <Plus className="w-4 h-4" />
              Nuevo Anuncio
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Anuncio</DialogTitle>
              <DialogDescription>
<<<<<<< HEAD
                Envía un mensaje importante. Se enviará una notificación a los destinatarios.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Destinatarios (Equipo)</Label>
                <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar equipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos mis equipos</SelectItem>
=======
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
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
                    {teams?.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

<<<<<<< HEAD
              <div className="space-y-2">
=======
              <div>
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
                <Label>Audiencia</Label>
                <Select value={audience} onValueChange={setAudience}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
<<<<<<< HEAD
                    <SelectItem value="parents">Solo Padres</SelectItem>
                    <SelectItem value="players">Solo Jugadores</SelectItem>
=======
                    <SelectItem value="parents">Padres</SelectItem>
                    <SelectItem value="players">Jugadores</SelectItem>
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
                    <SelectItem value="both">Padres y Jugadores</SelectItem>
                  </SelectContent>
                </Select>
              </div>

<<<<<<< HEAD
              <div className="space-y-2">
                <Label htmlFor="subject">Asunto</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Ej: Cambio de horario entrenamiento"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Mensaje</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Escribe los detalles importantes aquí..."
=======
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
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
                  rows={5}
                />
              </div>
            </div>
<<<<<<< HEAD

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSending}>
                Cancelar
              </Button>
              <Button 
                onClick={handleSend} 
                disabled={!subject.trim() || !message.trim() || isSending}
                className="gap-2"
              >
                {isSending ? (
                  <>Enviando...</>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Enviar Anuncio
                  </>
                )}
=======
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
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

<<<<<<< HEAD
      <div className="space-y-4">
        {!announcements || announcements.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No has enviado anuncios"
            description="Tus comunicados oficiales aparecerán aquí. Crea el primero para informar a tu equipo."
            actionLabel="Crear Anuncio"
            onAction={() => setDialogOpen(true)}
          />
        ) : (
          <div className="grid gap-4">
            {announcements.map((announcement) => (
              <Card key={announcement.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-lg leading-tight">
                          {announcement.subject}
                        </h3>
                        {announcement.teams ? (
                          <Badge variant="outline" className="text-xs font-normal">
                            {announcement.teams.name}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs font-normal">
                            Todos los equipos
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>
                          {new Date(announcement.sent_at).toLocaleDateString('es-CO', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>

                    <Badge variant="secondary" className="w-fit flex items-center gap-1.5 px-2.5 py-1 h-fit shrink-0">
                      {getAudienceIcon(announcement.audience)}
                      <span>{getAudienceLabel(announcement.audience)}</span>
                    </Badge>
                  </div>

                  <div className="bg-muted/30 p-4 rounded-md text-sm text-foreground/90 whitespace-pre-wrap">
                    {announcement.message}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
=======
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
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
