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
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState('parents');
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
    },
    enabled: !!user?.id,
  });

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
    },
    enabled: !!user?.id,
  });

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

      if (error) throw error;

      toast({
        title: '📢 Anuncio enviado',
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
    }
  };

  const getAudienceLabel = (aud: string) => {
    switch (aud) {
      case 'parents': return 'Padres';
      case 'players': return 'Jugadores';
      case 'both': return 'Todos';
      default: return aud;
    }
  };

  const getAudienceIcon = (aud: string) => {
    switch (aud) {
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
              <Plus className="w-4 h-4" />
              Nuevo Anuncio
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Anuncio</DialogTitle>
              <DialogDescription>
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
                    {teams?.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Audiencia</Label>
                <Select value={audience} onValueChange={setAudience}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="parents">Solo Padres</SelectItem>
                    <SelectItem value="players">Solo Jugadores</SelectItem>
                    <SelectItem value="both">Padres y Jugadores</SelectItem>
                  </SelectContent>
                </Select>
              </div>

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
                  rows={5}
                />
              </div>
            </div>

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
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

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