import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, AlertCircle, UserPlus, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

/**
 * Pagina publica de auto-registro por equipo.
 * URL: /join-team/:teamId
 *
 * Flujo:
 * 1. Carga info del equipo/escuela/sede via get_team_join_info
 * 2. Padre ingresa: email, password, nombre, telefono, documento del hijo
 * 3. Validamos el doc via validate_child_for_team_join (pre-registro)
 * 4. Si OK -> supabase.auth.signUp -> claim_child_for_parent -> dashboard
 */

interface TeamInfo {
  team_id: string;
  team_name: string;
  school_id: string;
  school_name: string;
  branch_id: string | null;
  branch_name: string | null;
  athletes_count: number;
}

interface ValidationResult {
  child_id: string;
  full_name: string;
  already_linked: boolean;
}

export default function JoinTeamPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('+57');
  const [childDoc, setChildDoc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [success, setSuccess] = useState(false);

  // ── Cargar info del equipo ───────────────────────────────────────────────
  const { data: teamInfo, isLoading: loadingTeam, error: teamError } = useQuery<TeamInfo | null>({
    queryKey: ['team-join-info', teamId],
    queryFn: async () => {
      if (!teamId) return null;
      const { data, error } = await (supabase.rpc as any)('get_team_join_info', { p_team_id: teamId });
      if (error) throw error;
      return (data && data.length > 0) ? data[0] : null;
    },
    enabled: !!teamId,
  });

  // ── Validar documento cuando cambia ──────────────────────────────────────
  useEffect(() => {
    setValidation(null);
    if (!childDoc || !teamId || childDoc.replace(/\D/g, '').length < 5) return;
    const timer = setTimeout(async () => {
      setValidating(true);
      const { data, error } = await (supabase.rpc as any)('validate_child_for_team_join', {
        p_team_id: teamId,
        p_doc_number: childDoc,
      });
      setValidating(false);
      if (!error && data && data.length > 0) {
        setValidation(data[0] as ValidationResult);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [childDoc, teamId]);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation) {
      toast({ title: 'Documento invalido', description: 'El atleta no existe en este equipo', variant: 'destructive' });
      return;
    }
    if (validation.already_linked) {
      toast({ title: 'Ya vinculado', description: 'Este atleta ya tiene un acudiente asociado', variant: 'destructive' });
      return;
    }
    if (password.length < 8) {
      toast({ title: 'Password corto', description: 'Minimo 8 caracteres', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      // 1. Registrar en auth
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, phone, role: 'parent' },
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (signUpError) {
        throw new Error(signUpError.message);
      }
      if (!signUpData.user) {
        throw new Error('No se pudo crear el usuario');
      }

      // Si requiere confirmar email, igual dejamos el claim para cuando haga login
      // Pero si ya esta autenticado (auto-confirm), seguimos con el claim
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast({
          title: 'Revisa tu correo',
          description: 'Te enviamos un enlace para confirmar tu cuenta. Despues de confirmar, haz login e ingresa el documento de tu hijo/a.',
        });
        setSuccess(true);
        return;
      }

      // 2. Reclamar al hijo
      const { data: claimData, error: claimError } = await (supabase.rpc as any)('claim_child_for_parent', {
        p_child_id:  validation.child_id,
        p_full_name: fullName,
        p_phone:     phone,
      });

      if (claimError) {
        throw new Error(claimError.message);
      }

      // La RPC devuelve status_code: 'ok' | 'already_linked' | 'not_found' | 'no_auth'
      const status = Array.isArray(claimData) && claimData.length > 0 ? claimData[0].status_code : null;
      if (status === 'already_linked') {
        throw new Error('Este atleta ya esta vinculado a otro acudiente. Contacta a la escuela.');
      }
      if (status === 'not_found') {
        throw new Error('Atleta no encontrado');
      }
      if (status === 'no_auth') {
        throw new Error('Sesion no valida. Vuelve a iniciar sesion.');
      }
      if (status !== 'ok') {
        throw new Error('No se pudo completar la vinculacion');
      }

      setSuccess(true);
      toast({ title: '✅ Registro completado', description: `${validation.full_name} vinculado a tu cuenta` });

      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'No se pudo completar el registro', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loadingTeam) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (teamError || !teamInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" /> Equipo no encontrado
            </CardTitle>
            <CardDescription>
              El link que usaste no corresponde a un equipo valido. Contacta a la escuela.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" /> ¡Listo!
            </CardTitle>
            <CardDescription>
              {validation ? `${validation.full_name} quedo vinculado a tu cuenta.` : 'Te enviamos un correo para confirmar.'}
              Te redirigimos al dashboard.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 to-background">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <UserPlus className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Registro de Acudientes</CardTitle>
              <CardDescription className="text-xs">
                {teamInfo.school_name}
                {teamInfo.branch_name ? ` · ${teamInfo.branch_name}` : ''}
                {' · '}
                <span className="font-semibold text-primary">{teamInfo.team_name}</span>
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Correo electronico *</Label>
              <Input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@correo.com" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Contraseña (min 8) *</Label>
              <Input id="password" type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="********" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fullName">Tu nombre completo *</Label>
              <Input id="fullName" required value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Nombre del acudiente" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone">Telefono / WhatsApp *</Label>
              <Input id="phone" type="tel" required value={phone} onChange={e => setPhone(e.target.value)} />
            </div>

            <div className="space-y-1.5 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <Label htmlFor="childDoc" className="flex items-center gap-1.5 font-semibold">
                <Shield className="h-3.5 w-3.5" /> Documento del hijo/a *
              </Label>
              <Input
                id="childDoc"
                required
                value={childDoc}
                onChange={e => setChildDoc(e.target.value)}
                placeholder="Numero de documento (TI, RC o CC)"
                className={validation ? (validation.already_linked ? 'border-destructive' : 'border-green-500') : ''}
              />
              {validating && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Validando...
                </p>
              )}
              {validation && !validation.already_linked && (
                <p className="text-xs text-green-600 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="h-3 w-3" /> {validation.full_name}
                </p>
              )}
              {validation && validation.already_linked && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Este atleta ya tiene acudiente vinculado
                </p>
              )}
              {childDoc.length >= 5 && !validating && !validation && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Documento no encontrado en este equipo
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={submitting || !validation || validation.already_linked}
            >
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Registrando...</>
              ) : (
                'Completar registro'
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Al registrarte aceptas los terminos y la politica de privacidad de SportMaps.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
