import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Mail, UserPlus, Check, Clock, X as XIcon, Send, Copy, DollarSign, Link as LinkIcon, MessageCircle } from 'lucide-react';
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
  parent_phone?: string;
  registration_link?: string;
}

export default function InvitationsManagementPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { schoolId, schoolName, programs, defaultMonthlyFee, currentUserRole } = useSchoolContext();
  const isAdmin = currentUserRole === 'admin' || currentUserRole === 'owner';

  const [formData, setFormData] = useState({
    parentEmail: '',
    parentPhone: '',
    childName: '',
    programId: '',
    monthlyFee: defaultMonthlyFee,
  });

  // Handle URL params
  useEffect(() => {
    const email = searchParams.get('email');
    const child = searchParams.get('child');
    const program = searchParams.get('program');
    const phone = searchParams.get('phone');

    if (email || child || program || phone) {
      setFormData(prev => ({
        ...prev,
        parentEmail: email || prev.parentEmail,
        childName: child || prev.childName,
        programId: program || prev.programId,
        parentPhone: phone || prev.parentPhone,
      }));
      setDialogOpen(true);
    }
  }, [searchParams]);

  // Fetch real invitations
  const { data: invitations = [], isLoading: loadingInvites } = useQuery({
    queryKey: ['invitations', schoolId],
    queryFn: async () => {
      if (!schoolId) return [];
      const { data, error } = await (supabase
        .from('invitations' as any) as any)
        .select('*')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Map DB fields to Invitation interface
      return (data || []).map((inv: any) => ({
        id: inv.id,
        invited_email: inv.email,
        parent_phone: inv.parent_phone || '',
        child_name: inv.child_name || '—',
        program_name: programs.find(p => p.id === inv.program_id)?.name || 'Programa General',
        monthly_fee: inv.monthly_fee || 0,
        status: inv.status,
        created_at: inv.created_at,
      })) as Invitation[];
    },
    enabled: !!schoolId,
  });

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);

  const generateRegistrationLink = (invitation: Partial<Invitation>) => {
    const params = new URLSearchParams({
      school: schoolId || 'demo',
      email: invitation.invited_email || '',
      child: invitation.child_name || '',
      invite: invitation.id || '',
    });
    return `${window.location.origin}/register?${params.toString()}`;
  };

  const sendWhatsApp = (invitation: Partial<Invitation>) => {
    const link = generateRegistrationLink(invitation);
    const message = `¡Hola! Te invitamos a inscribir a ${invitation.child_name} en ${schoolName}. Puedes completar el registro aquí: ${link}`;
    const phone = invitation.parent_phone || formData.parentPhone;
    const cleanPhone = phone.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
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

      // 1. Create in DB via RPC
      const { data: inviteId, error } = await (supabase.rpc as any)('invite_parent_to_school', {
        p_parent_email: data.parentEmail,
        p_child_name: data.childName,
        p_program_id: data.programId || null,
        p_monthly_fee: fee,
        p_parent_phone: data.parentPhone || null
      });

      if (error) throw error;

      // 2. Try to send email via edge function (non-blocking)
      const registration_link = `${window.location.origin}/register?email=${encodeURIComponent(data.parentEmail)}&role=parent&invite=${inviteId}`;

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
            invitationLink: registration_link,
          })
        }
      ).catch(error => {
        console.warn('Email send failed (RPC succeeded):', error);
      });

      return { id: inviteId, registration_link };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      setDialogOpen(false);
      const email = formData.parentEmail;
      setFormData({ parentEmail: '', parentPhone: '', childName: '', programId: '', monthlyFee: defaultMonthlyFee });

      toast({
        title: '✅ Invitación creada',
        description: `Invitación registrada para ${email}.`,
      });

      // Auto-copy registration link
      if (result.registration_link) {
        navigator.clipboard.writeText(result.registration_link);
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
                <TableHead>Email / WhatsApp</TableHead>
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
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Mail className="w-3 h-3 text-muted-foreground" />
                        <span className="text-sm">{invitation.invited_email}</span>
                      </div>
                      {invitation.parent_phone && (
                        <div className="flex items-center gap-2">
                          <MessageCircle className="w-3 h-3 text-green-500" />
                          <span className="text-xs text-muted-foreground">{invitation.parent_phone}</span>
                        </div>
                      )}
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
                        title="Copiar link"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        onClick={() => sendWhatsApp(invitation)}
                        title="Enviar por WhatsApp"
                      >
                        <MessageCircle className="w-4 h-4" />
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
              <Label htmlFor="parentPhone">WhatsApp / Teléfono</Label>
              <Input
                id="parentPhone"
                placeholder="Ej: 3001234567"
                value={formData.parentPhone}
                onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })}
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
              <Button
                type="button"
                variant="outline"
                className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                onClick={() => sendWhatsApp({})}
                disabled={!formData.parentPhone || !formData.childName}
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                WhatsApp
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
