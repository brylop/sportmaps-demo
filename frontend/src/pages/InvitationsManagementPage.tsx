import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Mail, UserPlus, Check, Clock, X as XIcon, Send, Copy, DollarSign, Link as LinkIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSchoolContext } from '@/hooks/useSchoolContext';

interface Invitation {
  id: string;
  invited_email: string;
  child_name: string;
  program_name: string;
  monthly_fee: number;
  status: string;
  created_at: string;
  registration_link?: string;
}

export default function InvitationsManagementPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { schoolId, schoolName, programs, defaultMonthlyFee } = useSchoolContext();

  const [formData, setFormData] = useState({
    parentEmail: '',
    childName: '',
    programId: '',
    monthlyFee: defaultMonthlyFee,
  });

  // Demo invitations with monthly_fee
  const [invitations, setInvitations] = useState<Invitation[]>([
    {
      id: '1',
      invited_email: 'maria.gonzalez@email.com',
      child_name: 'Mateo Pérez',
      program_name: 'Firesquad (Senior L3)',
      monthly_fee: 180000,
      status: 'accepted',
      created_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: '2',
      invited_email: 'carlos.rodriguez@email.com',
      child_name: 'Laura Rodríguez',
      program_name: 'Butterfly (Junior Prep)',
      monthly_fee: 150000,
      status: 'pending',
      created_at: new Date(Date.now() - 172800000).toISOString(),
    },
    {
      id: '3',
      invited_email: 'ana.martinez@email.com',
      child_name: 'Santiago Martínez',
      program_name: 'Bombsquad (Coed L5)',
      monthly_fee: 200000,
      status: 'pending',
      created_at: new Date(Date.now() - 259200000).toISOString(),
    },
    {
      id: '4',
      invited_email: 'spoortmaps@gmail.com',
      child_name: 'Demo Hijo',
      program_name: 'Legends (Open L6)',
      monthly_fee: 220000,
      status: 'accepted',
      created_at: new Date(Date.now() - 345600000).toISOString(),
    }
  ]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);

  const generateRegistrationLink = (invitation: Partial<Invitation>) => {
    const params = new URLSearchParams({
      school: schoolId || 'demo',
      program: invitation.program_name || '',
      fee: String(invitation.monthly_fee || defaultMonthlyFee),
      child: invitation.child_name || '',
    });
    return `${window.location.origin}/register?${params.toString()}`;
  };

  const copyLinkToClipboard = (invitation: Invitation) => {
    const link = generateRegistrationLink(invitation);
    navigator.clipboard.writeText(link);
    toast({
      title: '📋 Link copiado',
      description: 'Link de registro copiado al portapapeles. Compártelo por WhatsApp o email.',
    });
  };

  const sendInvitationMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const selectedProgram = programs.find(p => p.id === data.programId);
      const programName = selectedProgram?.name || 'Programa';
      const fee = data.monthlyFee || selectedProgram?.monthly_fee || defaultMonthlyFee;

      // Create new invitation in local state
      const newInvitation: Invitation = {
        id: `inv-${Date.now()}`,
        invited_email: data.parentEmail,
        child_name: data.childName,
        program_name: programName,
        monthly_fee: fee,
        status: 'pending',
        created_at: new Date().toISOString(),
        registration_link: generateRegistrationLink({
          program_name: programName,
          monthly_fee: fee,
          child_name: data.childName,
        }),
      };

      setInvitations(prev => [newInvitation, ...prev]);

      // Try to send email via edge function (non-blocking)
      try {
        await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-invitation-email`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
            },
            body: JSON.stringify({
              to: data.parentEmail,
              parentName: data.parentEmail.split('@')[0],
              childName: data.childName,
              schoolName,
              programName,
              monthlyFee: fee,
              invitationLink: newInvitation.registration_link,
            })
          }
        );
      } catch (e) {
        console.warn('Email send failed (demo mode):', e);
      }

      return newInvitation;
    },
    onSuccess: (invitation) => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      setDialogOpen(false);
      setFormData({ parentEmail: '', childName: '', programId: '', monthlyFee: defaultMonthlyFee });

      toast({
        title: '✅ Invitación creada',
        description: `Invitación para ${invitation.child_name} creada. Mensualidad: ${formatCurrency(invitation.monthly_fee)}`,
      });

      // Auto-copy registration link
      if (invitation.registration_link) {
        navigator.clipboard.writeText(invitation.registration_link);
        toast({
          title: '📋 Link copiado automáticamente',
          description: 'Compártelo por WhatsApp o email para que el padre se registre.',
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: '❌ Error',
        description: error.message || 'No se pudo crear la invitación',
        variant: 'destructive',
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendInvitationMutation.mutate(formData);
  };

  const handleProgramChange = (programId: string) => {
    const selectedProgram = programs.find(p => p.id === programId);
    setFormData({
      ...formData,
      programId,
      monthlyFee: selectedProgram?.monthly_fee || defaultMonthlyFee,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'accepted':
        return (
          <Badge className="bg-green-500">
            <Check className="w-3 h-3 mr-1" />
            Aceptada
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="secondary">
            <Clock className="w-3 h-3 mr-1" />
            Pendiente
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="destructive">
            <XIcon className="w-3 h-3 mr-1" />
            Rechazada
          </Badge>
        );
      default:
        return null;
    }
  };

  const stats = {
    total: invitations.length,
    accepted: invitations.filter(i => i.status === 'accepted').length,
    pending: invitations.filter(i => i.status === 'pending').length,
    rejected: invitations.filter(i => i.status === 'rejected').length
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Gestión de Invitaciones</h1>
          <p className="text-muted-foreground">
            Invita a padres para que inscriban a sus hijos en <strong>{schoolName}</strong>
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <UserPlus className="w-4 h-4 mr-2" />
          Nueva Invitación
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Invitaciones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Aceptadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats.accepted}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pendientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Rechazadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats.rejected}</div>
          </CardContent>
        </Card>
      </div>

      {/* Invitations Table */}
      <Card>
        <CardHeader>
          <CardTitle>Invitaciones Enviadas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email del Padre</TableHead>
                <TableHead>Nombre del Hijo</TableHead>
                <TableHead>Programa</TableHead>
                <TableHead>Mensualidad</TableHead>
                <TableHead>Fecha de Envío</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations.map((invitation) => (
                <TableRow key={invitation.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      {invitation.invited_email}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {invitation.child_name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{invitation.program_name}</Badge>
                  </TableCell>
                  <TableCell className="font-semibold text-primary">
                    {formatCurrency(invitation.monthly_fee)}
                  </TableCell>
                  <TableCell>
                    {format(new Date(invitation.created_at), 'PPP', { locale: es })}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(invitation.status)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyLinkToClipboard(invitation)}
                        title="Copiar link de registro"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      {invitation.status === 'pending' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            toast({
                              title: '📧 Invitación reenviada',
                              description: `Re-enviando invitación a ${invitation.invited_email}`,
                            });
                          }}
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Invitation Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar Nueva Invitación</DialogTitle>
            <DialogDescription>
              Crea una invitación para que un padre inscriba a su hijo. Se generará un link de registro.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="parentEmail">Email del Padre/Tutor *</Label>
              <Input
                id="parentEmail"
                type="email"
                placeholder="padre@ejemplo.com"
                value={formData.parentEmail}
                onChange={(e) => setFormData({ ...formData, parentEmail: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="childName">Nombre del Hijo/a *</Label>
              <Input
                id="childName"
                placeholder="Ej: María Rodríguez"
                value={formData.childName}
                onChange={(e) => setFormData({ ...formData, childName: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="programId">Programa *</Label>
              <Select
                value={formData.programId}
                onValueChange={handleProgramChange}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar programa" />
                </SelectTrigger>
                <SelectContent>
                  {programs.map(program => (
                    <SelectItem key={program.id} value={program.id}>
                      {program.name} — {formatCurrency(program.monthly_fee)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="monthlyFee">Mensualidad (COP) *</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="monthlyFee"
                  type="number"
                  className="pl-9"
                  value={formData.monthlyFee}
                  onChange={(e) => setFormData({ ...formData, monthlyFee: parseInt(e.target.value) || 0 })}
                  required
                />
              </div>
            </div>

            {/* Preview link */}
            {formData.childName && formData.programId && (
              <div className="bg-muted/50 rounded-lg p-3 flex items-start gap-2">
                <LinkIcon className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium">Link de registro:</p>
                  <p className="text-xs text-muted-foreground break-all">
                    {generateRegistrationLink({
                      program_name: programs.find(p => p.id === formData.programId)?.name || '',
                      monthly_fee: formData.monthlyFee,
                      child_name: formData.childName,
                    })}
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={sendInvitationMutation.isPending}
              >
                {sendInvitationMutation.isPending ? 'Creando...' : 'Crear & Copiar Link'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
