import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { bffClient } from '@/lib/api/bffClient';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Users,
  Trophy,
  DollarSign,
  FileText,
  Upload,
  CheckCircle2,
  XCircle,
  Ticket,
  Clock,
} from 'lucide-react';

interface DelegationDetail {
  id: string;
  event_id: string;
  status: string;
  total_amount: number;
  paid_amount: number;
  created_at: string;
  event: {
    id: string;
    title: string;
    sport: string;
    event_date: string;
    city: string;
    slug: string;
    status: string;
    image_url?: string;
    registration_deadline?: string;
    payment_deadline?: string;
  };
  teams: {
    id: string;
    team_name: string;
    category: string;
    athletes: {
      id: string;
      athlete_id: string;
      athlete_name: string;
      package_id: string;
      has_documents: boolean;
      documents: { name: string; path: string }[];
    }[];
  }[];
  coaches: {
    id: string;
    coach_id: string;
    name: string;
    package_id: string;
  }[];
}

const STATUS_CONFIG: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string; color: string }> = {
  draft: { variant: 'outline', label: 'Borrador', color: 'text-gray-600' },
  pending_payment: { variant: 'outline', label: 'Pendiente Pago', color: 'text-yellow-600' },
  approved: { variant: 'default', label: 'Aprobada', color: 'text-green-600' },
  rejected: { variant: 'destructive', label: 'Rechazada', color: 'text-red-600' },
  cancelled: { variant: 'secondary', label: 'Cancelada', color: 'text-gray-500' },
};

export default function SchoolDelegationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [delegation, setDelegation] = useState<DelegationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  useEffect(() => {
    if (id) loadDetail();
  }, [id]);

  const loadDetail = async () => {
    setLoading(true);
    try {
      const data = await bffClient.get<DelegationDetail>(`/api/v1/school/delegations/${id}`);
      setDelegation(data);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleUploadDocument = async (athleteId: string, file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Archivo muy grande', description: 'Max 5MB', variant: 'destructive' });
      return;
    }
    setUploadingFor(athleteId);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `${Date.now()}.${ext}`;
      const path = `children/${athleteId}/docs/${fileName}`;

      const { error } = await supabase.storage
        .from('identity-documents')
        .upload(path, file);

      if (error) throw error;

      toast({ title: 'Documento subido', description: 'El archivo se subió correctamente' });
      loadDetail(); // Refresh to show new document
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setUploadingFor(null);
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);

  if (loading) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-5xl space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!delegation) {
    return (
      <div className="container mx-auto py-12 px-4 text-center">
        <XCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Delegación no encontrada</h2>
        <Button onClick={() => navigate('/school/delegations')}>Volver a Delegaciones</Button>
      </div>
    );
  }

  const ev = delegation.event;
  const cfg = STATUS_CONFIG[delegation.status] || STATUS_CONFIG.draft;
  const balance = Number(delegation.total_amount || 0) - Number(delegation.paid_amount || 0);
  const totalAthletes = delegation.teams.reduce((s, t) => s + t.athletes.length, 0);
  const athletesWithDocs = delegation.teams.reduce((s, t) => s + t.athletes.filter(a => a.has_documents).length, 0);

  return (
    <div className="container mx-auto py-6 px-4 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/school/delegations')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{ev?.title || 'Evento'}</h1>
            <Badge variant={cfg.variant}>{cfg.label}</Badge>
          </div>
          <p className="text-muted-foreground">{ev?.sport} &bull; {ev?.city}</p>
        </div>
        {ev?.slug && (
          <Button variant="outline" onClick={() => window.open(`/event/${ev.slug}`, '_blank')} className="gap-2">
            <Ticket className="h-4 w-4" />
            Ver Evento
          </Button>
        )}
      </div>

      {/* Event & Delegation Summary */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Datos del Evento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              {ev?.event_date ? formatDate(ev.event_date) : '—'}
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              {ev?.city || '—'}
            </div>
            {ev?.registration_deadline && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>Cierre inscripciones: {formatDate(ev.registration_deadline)}</span>
              </div>
            )}
            {ev?.payment_deadline && (
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span>Límite pago: {formatDate(ev.payment_deadline)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Resumen de la Delegación</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Equipos</span>
                <p className="text-xl font-bold">{delegation.teams.length}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Atletas</span>
                <p className="text-xl font-bold">{totalAthletes}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Total</span>
                <p className="text-xl font-bold">{formatPrice(delegation.total_amount)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Saldo</span>
                <p className={`text-xl font-bold ${balance > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                  {balance > 0 ? formatPrice(balance) : 'Pagado'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Equipos | Documentos */}
      <Tabs defaultValue="equipos">
        <TabsList>
          <TabsTrigger value="equipos" className="gap-2">
            <Trophy className="h-4 w-4" />
            Equipos y Atletas
          </TabsTrigger>
          <TabsTrigger value="documentos" className="gap-2">
            <FileText className="h-4 w-4" />
            Documentos ({athletesWithDocs}/{totalAthletes})
          </TabsTrigger>
        </TabsList>

        {/* Tab: Equipos */}
        <TabsContent value="equipos" className="space-y-4">
          {delegation.teams.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No hay equipos registrados en esta delegación</p>
              </CardContent>
            </Card>
          ) : (
            delegation.teams.map((team) => (
              <Card key={team.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Trophy className="h-4 w-4" />
                      {team.team_name}
                    </CardTitle>
                    <Badge variant="outline">{team.category}</Badge>
                  </div>
                  <CardDescription>{team.athletes.length} atleta(s)</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Atleta</TableHead>
                        <TableHead>Documentos</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {team.athletes.map((athlete) => (
                        <TableRow key={athlete.id}>
                          <TableCell className="font-medium">{athlete.athlete_name}</TableCell>
                          <TableCell>
                            {athlete.has_documents ? (
                              <span className="flex items-center gap-1 text-green-600 text-sm">
                                <CheckCircle2 className="h-4 w-4" />
                                {athlete.documents.length} doc(s)
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-yellow-600 text-sm">
                                <XCircle className="h-4 w-4" />
                                Sin documentos
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))
          )}

          {delegation.coaches.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Entrenadores</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {delegation.coaches.map((coach) => (
                    <div key={coach.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <span className="font-medium">{coach.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab: Documentos */}
        <TabsContent value="documentos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Documentos de Identidad
              </CardTitle>
              <CardDescription>
                Sube documentos (cédula, tarjeta de identidad) de cada atleta.
                Progreso: {athletesWithDocs} de {totalAthletes} atletas con documentos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Progress bar */}
              <div className="mb-6">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Documentos subidos</span>
                  <span className="font-medium">{totalAthletes > 0 ? Math.round((athletesWithDocs / totalAthletes) * 100) : 0}%</span>
                </div>
                <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${totalAthletes > 0 ? (athletesWithDocs / totalAthletes) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div className="space-y-3">
                {delegation.teams.flatMap(team =>
                  team.athletes.map(athlete => (
                    <div key={athlete.id} className="flex items-center justify-between p-4 rounded-lg border">
                      <div>
                        <p className="font-medium">{athlete.athlete_name}</p>
                        <p className="text-xs text-muted-foreground">{team.team_name} &bull; {team.category}</p>
                        {athlete.has_documents && (
                          <div className="flex items-center gap-1 mt-1 text-green-600 text-xs">
                            <CheckCircle2 className="h-3 w-3" />
                            {athlete.documents.length} documento(s) subido(s)
                          </div>
                        )}
                      </div>
                      <div>
                        <Label htmlFor={`doc-${athlete.athlete_id}`} className="cursor-pointer">
                          <div className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                            uploadingFor === athlete.athlete_id
                              ? 'opacity-50 cursor-wait'
                              : 'hover:bg-accent cursor-pointer'
                          }`}>
                            <Upload className="h-4 w-4" />
                            {athlete.has_documents ? 'Agregar' : 'Subir'}
                          </div>
                        </Label>
                        <Input
                          id={`doc-${athlete.athlete_id}`}
                          type="file"
                          className="hidden"
                          accept=".pdf,image/*"
                          disabled={uploadingFor === athlete.athlete_id}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadDocument(athlete.athlete_id, file);
                            e.target.value = '';
                          }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
