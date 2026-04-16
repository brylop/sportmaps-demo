import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { bffClient } from '@/lib/api/bffClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Loader2,
  Users,
  DollarSign,
  FileText,
  Upload,
  CheckCircle2,
  User,
  Baby,
} from 'lucide-react';
import { sanitizeText, sanitizeDigits } from '@/lib/inputSanitizers';

export default function EventIndividualRegisterPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [event, setEvent] = useState<any>(null);
  const [children, setChildren] = useState<any[]>([]);

  // Form state
  const [registrationType, setRegistrationType] = useState<'self' | 'child'>('self');
  const [selectedChild, setSelectedChild] = useState('');
  const [formData, setFormData] = useState({
    participant_name: '',
    participant_email: '',
    participant_phone: '',
    participant_role: 'athlete' as string,
    participant_age: '',
    category_id: '',
    package_choice: '',
    notes: '',
  });
  const [paymentProofUrl, setPaymentProofUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (eventId) loadData();
  }, [eventId]);

  useEffect(() => {
    if (profile) {
      setFormData(prev => ({
        ...prev,
        participant_name: profile.full_name || '',
        participant_email: user?.email || '',
        participant_phone: profile.phone || '',
      }));
    }
  }, [profile, user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: ev, error } = await supabase
        .from('events')
        .select('*, categories:event_categories_config(*), phases:event_price_phases(*)')
        .eq('id', eventId)
        .single();

      if (error) throw error;
      setEvent(ev);

      // Load children if parent
      if (profile?.role === 'parent' && user?.id) {
        const { data: kids } = await supabase
          .from('children')
          .select('id, full_name, date_of_birth')
          .eq('parent_id', user.id);
        setChildren(kids || []);
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleChildSelect = (childId: string) => {
    setSelectedChild(childId);
    const child = children.find(c => c.id === childId);
    if (child) {
      setFormData(prev => ({
        ...prev,
        participant_name: child.full_name,
        participant_role: 'athlete',
        participant_age: child.date_of_birth
          ? String(Math.floor((Date.now() - new Date(child.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)))
          : '',
      }));
    }
  };

  const handleFileUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Archivo muy grande', description: 'Max 5MB', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `event-payments/${user?.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('payment-receipts').upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('payment-receipts').getPublicUrl(path);
      setPaymentProofUrl(urlData.publicUrl);
      toast({ title: 'Comprobante subido' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        participant_name: formData.participant_name,
        participant_email: formData.participant_email,
        participant_phone: formData.participant_phone,
        participant_role: formData.participant_role,
        participant_age: formData.participant_age ? Number(formData.participant_age) : null,
        category_id: formData.category_id || null,
        package_choice: formData.package_choice || null,
        child_id: registrationType === 'child' ? selectedChild : null,
        notes: formData.notes || null,
        payment_proof_url: paymentProofUrl || null,
      };

      await bffClient.post(`/api/v1/events/${eventId}/register`, payload);

      toast({
        title: 'Inscripcion enviada',
        description: 'Tu inscripcion ha sido registrada. El organizador la revisara pronto.',
      });
      navigate('/my-event-registrations');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const getSelectedPrice = () => {
    if (!formData.package_choice || !event?.phases?.[0]) return 0;
    const phase = event.phases[0];
    const prices: Record<string, number> = {
      pkg_solo: phase.pkg_solo_price || 0,
      pkg_3: phase.pkg_3_price || 0,
      pkg_2: phase.pkg_2_price || 0,
      pkg_1: phase.pkg_1_price || 0,
    };
    return prices[formData.package_choice] || 0;
  };

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);

  if (loading) {
    return (
      <div className="container max-w-3xl mx-auto py-8 px-4 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="container max-w-3xl mx-auto py-12 px-4 text-center">
        <h2 className="text-xl font-semibold mb-4">Evento no encontrado</h2>
        <Button onClick={() => navigate('/events')}>Explorar Eventos</Button>
      </div>
    );
  }

  const isParent = profile?.role === 'parent';

  return (
    <div className="container max-w-3xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Inscripcion Individual</h1>
          <p className="text-muted-foreground">{event.title} &bull; {event.sport}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex gap-2 mb-6">
        {[1, 2, 3].map(s => (
          <div key={s} className={`flex-1 h-2 rounded-full ${step >= s ? 'bg-primary' : 'bg-slate-200'}`} />
        ))}
      </div>

      {/* Step 1: Datos del participante */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" /> Datos del Participante</CardTitle>
            <CardDescription>Informacion del atleta que participara en el evento</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Parent: choose self or child */}
            {isParent && children.length > 0 && (
              <div className="space-y-3 p-4 border rounded-lg bg-slate-50">
                <Label className="text-base font-semibold">Inscribir a:</Label>
                <div className="flex gap-3">
                  <Button
                    variant={registrationType === 'self' ? 'default' : 'outline'}
                    onClick={() => {
                      setRegistrationType('self');
                      setSelectedChild('');
                      setFormData(prev => ({
                        ...prev,
                        participant_name: profile?.full_name || '',
                        participant_role: 'parent',
                        participant_age: '',
                      }));
                    }}
                    className="gap-2"
                  >
                    <User className="h-4 w-4" />
                    Yo mismo
                  </Button>
                  <Button
                    variant={registrationType === 'child' ? 'default' : 'outline'}
                    onClick={() => setRegistrationType('child')}
                    className="gap-2"
                  >
                    <Baby className="h-4 w-4" />
                    Mi hijo/a
                  </Button>
                </div>

                {registrationType === 'child' && (
                  <Select value={selectedChild} onValueChange={handleChildSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un hijo/a" />
                    </SelectTrigger>
                    <SelectContent>
                      {children.map(child => (
                        <SelectItem key={child.id} value={child.id}>{child.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <div className="md:col-span-2 space-y-2">
                <Label>Nombre completo *</Label>
                <Input
                  value={formData.participant_name}
                  onChange={e => setFormData(prev => ({ ...prev, participant_name: sanitizeText(e.target.value) }))}
                  maxLength={150}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.participant_email}
                  onChange={e => setFormData(prev => ({ ...prev, participant_email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Telefono *</Label>
                <Input
                  value={formData.participant_phone}
                  onChange={e => setFormData(prev => ({ ...prev, participant_phone: sanitizeDigits(e.target.value) }))}
                  maxLength={15}
                  inputMode="tel"
                />
              </div>
              <div className="space-y-2">
                <Label>Edad del participante</Label>
                <Input
                  value={formData.participant_age}
                  onChange={e => setFormData(prev => ({ ...prev, participant_age: sanitizeDigits(e.target.value) }))}
                  maxLength={2}
                  inputMode="numeric"
                  placeholder="Ej. 12"
                />
              </div>
              <div className="space-y-2">
                <Label>Rol</Label>
                <Select
                  value={formData.participant_role}
                  onValueChange={v => setFormData(prev => ({ ...prev, participant_role: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="athlete">Atleta</SelectItem>
                    <SelectItem value="coach">Entrenador</SelectItem>
                    <SelectItem value="parent">Padre/Acudiente</SelectItem>
                    <SelectItem value="other">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button
                onClick={() => {
                  if (!formData.participant_name || !formData.participant_phone) {
                    toast({ title: 'Error', description: 'Nombre y telefono son requeridos', variant: 'destructive' });
                    return;
                  }
                  setStep(2);
                }}
              >
                Siguiente: Categoria y Paquete
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Category & Package */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Categoria y Paquete</CardTitle>
            <CardDescription>Selecciona en que categoria participaras y tu paquete</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Category selection */}
            {event.categories && event.categories.length > 0 && (
              <div className="space-y-3">
                <Label className="text-base font-semibold">Categoria *</Label>
                <div className="grid gap-2">
                  {event.categories.map((cat: any) => (
                    <button
                      key={cat.id}
                      onClick={() => setFormData(prev => ({ ...prev, category_id: cat.id }))}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                        formData.category_id === cat.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium">{cat.division} {cat.category}</p>
                          <p className="text-sm text-muted-foreground">
                            {cat.rama} &bull; {cat.min_age}-{cat.max_age} anos &bull; Nivel {cat.level}
                          </p>
                        </div>
                        {formData.category_id === cat.id && (
                          <CheckCircle2 className="h-5 w-5 text-primary" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Package selection */}
            {event.phases && event.phases.length > 0 && (
              <div className="space-y-3">
                <Label className="text-base font-semibold">Paquete</Label>
                <p className="text-sm text-muted-foreground">Fase actual: {event.phases[0].phase_name}</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {[
                    { key: 'pkg_solo', label: 'Solo Competencia', price: event.phases[0].pkg_solo_price },
                    { key: 'pkg_3', label: '2 Noches Hotel', price: event.phases[0].pkg_3_price },
                    { key: 'pkg_2', label: '3 Noches Hotel', price: event.phases[0].pkg_2_price },
                    { key: 'pkg_1', label: '4 Noches Hotel', price: event.phases[0].pkg_1_price },
                  ].filter(p => p.price > 0).map((pkg) => (
                    <button
                      key={pkg.key}
                      onClick={() => setFormData(prev => ({ ...prev, package_choice: pkg.key }))}
                      className={`p-4 rounded-lg border-2 text-left transition-colors ${
                        formData.package_choice === pkg.key
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <p className="font-medium">{pkg.label}</p>
                      <p className="text-lg font-bold text-primary">{formatPrice(pkg.price)}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Notas adicionales</Label>
              <Textarea
                value={formData.notes}
                onChange={e => setFormData(prev => ({ ...prev, notes: sanitizeText(e.target.value) }))}
                placeholder="Ej. Soy alergico a..., necesito transporte..."
                maxLength={500}
                rows={3}
              />
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(1)}>Atras</Button>
              <Button onClick={() => setStep(3)}>Siguiente: Pago y Confirmacion</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Payment & Confirm */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" /> Pago y Confirmacion</CardTitle>
            <CardDescription>Revisa tu inscripcion y adjunta comprobante de pago si aplica</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Summary */}
            <div className="p-5 bg-slate-50 rounded-xl space-y-3 border">
              <h3 className="font-semibold text-lg">Resumen de Inscripcion</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Participante</span>
                  <p className="font-medium">{formData.participant_name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Rol</span>
                  <p className="font-medium capitalize">
                    {formData.participant_role === 'athlete' ? 'Atleta' :
                     formData.participant_role === 'parent' ? 'Padre' :
                     formData.participant_role === 'coach' ? 'Entrenador' : 'Otro'}
                  </p>
                </div>
                {formData.category_id && (
                  <div>
                    <span className="text-muted-foreground">Categoria</span>
                    <p className="font-medium">
                      {event.categories?.find((c: any) => c.id === formData.category_id)?.category || '—'}
                    </p>
                  </div>
                )}
                {formData.package_choice && (
                  <div>
                    <span className="text-muted-foreground">Paquete</span>
                    <p className="font-medium">
                      {formData.package_choice === 'pkg_solo' ? 'Solo Competencia' :
                       formData.package_choice === 'pkg_3' ? '2 Noches Hotel' :
                       formData.package_choice === 'pkg_2' ? '3 Noches Hotel' :
                       formData.package_choice === 'pkg_1' ? '4 Noches Hotel' : '—'}
                    </p>
                  </div>
                )}
              </div>
              {getSelectedPrice() > 0 && (
                <div className="pt-3 border-t mt-3">
                  <div className="flex justify-between items-center text-lg">
                    <span className="font-semibold">Total a Pagar</span>
                    <span className="font-bold text-primary">{formatPrice(getSelectedPrice())}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Payment proof upload */}
            {getSelectedPrice() > 0 && (
              <div className="space-y-3 p-4 border rounded-lg">
                <Label className="text-base font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Comprobante de Pago (opcional)
                </Label>
                <p className="text-sm text-muted-foreground">
                  Puedes subir el comprobante ahora o hacerlo despues. El organizador revisara tu inscripcion.
                </p>
                {paymentProofUrl ? (
                  <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg text-green-700">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="text-sm font-medium">Comprobante subido correctamente</span>
                  </div>
                ) : (
                  <div>
                    <Label htmlFor="payment-proof" className="cursor-pointer">
                      <div className="flex items-center justify-center gap-2 p-6 border-2 border-dashed rounded-lg hover:bg-slate-50 transition-colors">
                        {uploading ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <>
                            <Upload className="h-5 w-5 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Click para subir comprobante (PDF o imagen)</span>
                          </>
                        )}
                      </div>
                    </Label>
                    <Input
                      id="payment-proof"
                      type="file"
                      className="hidden"
                      accept=".pdf,image/*"
                      disabled={uploading}
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                        e.target.value = '';
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            <div className="p-4 bg-amber-50 text-amber-800 rounded-lg text-sm">
              Al confirmar, tu inscripcion quedara en estado <strong>Pendiente</strong> hasta que el organizador la apruebe.
              {getSelectedPrice() > 0 && ' Si adjuntaste comprobante, el pago sera verificado.'}
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(2)}>Atras</Button>
              <Button onClick={handleSubmit} disabled={submitting} size="lg">
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar Inscripcion
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
