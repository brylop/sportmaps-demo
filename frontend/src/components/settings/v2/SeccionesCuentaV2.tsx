/**
 * Formularios de «Mi cuenta» del acudiente V2: Perfil, Notificaciones,
 * Privacidad y Seguridad. Guardan EXACTAMENTE lo mismo que las secciones de
 * siempre (components/settings/*Section.tsx) con las mismas funciones de
 * useSettings; solo cambia la presentación (sin tarjetas, una frase por
 * opción, botón a lo ancho en el celular). Las secciones de siempre no se
 * tocan: las sigue viendo la escuela y los demás roles.
 */
import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PhoneInput } from '@/components/ui/phone-input';
import { Switch } from '@/components/ui/switch';
import { AccountDeletionCard } from '@/components/settings/AccountDeletionCard';
import { useAuth } from '@/contexts/AuthContext';
import { useStorage } from '@/hooks/useStorage';

/* eslint-disable @typescript-eslint/no-explicit-any -- `data` viene de get_my_settings sin tipo, igual que en las secciones de siempre */

function BotonGuardar({ saving, disabled, children }: { saving: boolean; disabled?: boolean; children: string }) {
  return (
    <Button type="submit" disabled={saving || disabled} className="min-h-touch w-full gap-2 sm:w-auto">
      {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </Button>
  );
}

export function FilaSwitch({
  id, label, ayuda, checked, onChange,
}: { id: string; label: string; ayuda: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex min-h-touch items-center justify-between gap-4 py-2">
      <div className="min-w-0 space-y-0.5">
        <Label htmlFor={id} className="text-base font-medium">{label}</Label>
        <p className="text-sm text-muted-foreground">{ayuda}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

// ── Perfil ───────────────────────────────────────────────────────────────────
export interface PerfilV2Props {
  data: any;
  saving: boolean;
  onSave: (u: { full_name: string; phone: string; bio: string; date_of_birth?: string; sports_interests?: string[] }) => Promise<void>;
}

export function PerfilV2({ data, saving, onSave }: PerfilV2Props) {
  const { profile, updateProfile: updateAuthProfile } = useAuth();
  const { uploadFile, uploading } = useStorage();
  const fileRef = useRef<HTMLInputElement>(null);
  const p = data?.profile ?? {};
  const [form, setForm] = useState({
    full_name: (p.full_name as string) || '',
    phone: (p.phone as string) || '',
    date_of_birth: (p.date_of_birth as string) || '',
  });

  const subirFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.id) return;
    try {
      const url = await uploadFile(file, 'avatars', profile.id);
      // Igual que ProfileSection: la foto va directo al perfil (save_profile_settings no la guarda).
      if (url) await updateAuthProfile({ avatar_url: url });
    } catch (err) {
      console.error('Error uploading avatar:', err);
    }
  };

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    // Biografía e intereses no se muestran al acudiente, pero viajan tal cual
    // estaban: guardar el perfil no los borra.
    void onSave({
      full_name: form.full_name,
      phone: form.phone,
      bio: (p.bio as string) || '',
      date_of_birth: form.date_of_birth,
      sports_interests: (p.sports_interests as string[]) || [],
    });
  };

  return (
    <form onSubmit={enviar} className="space-y-5">
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16 border">
          <AvatarImage src={profile?.avatar_url || ''} alt="" />
          <AvatarFallback className="bg-primary/10 text-lg font-bold text-primary">
            {(form.full_name || 'U').charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <Button
          type="button"
          variant="outline"
          className="min-h-touch gap-2"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Camera className="h-4 w-4" aria-hidden="true" />}
          Cambiar foto
        </Button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={subirFoto} disabled={uploading} aria-label="Foto de perfil" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="v2-full-name">Nombre completo</Label>
        <Input
          id="v2-full-name"
          className="text-input"
          value={form.full_name}
          onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
          autoComplete="name"
        />
      </div>
      <div className="space-y-2">
        <Label>WhatsApp</Label>
        <PhoneInput value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} />
        <p className="text-xs text-muted-foreground">Por aquí te escribe el club sobre cobros y avisos.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="v2-birth">Fecha de nacimiento</Label>
        <Input
          id="v2-birth"
          type="date"
          className="text-input"
          value={form.date_of_birth}
          onChange={(e) => setForm((f) => ({ ...f, date_of_birth: e.target.value }))}
        />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">Correo</p>
        <p className="text-sm text-muted-foreground break-all">{profile?.email}</p>
      </div>
      <p className="text-sm text-muted-foreground">
        Los documentos de tus hijos están en{' '}
        <Link to="/children" className="font-medium text-primary underline-offset-4 hover:underline">Hijos</Link>.
      </p>
      <BotonGuardar saving={saving} disabled={uploading}>Guardar cambios</BotonGuardar>
    </form>
  );
}

// ── Notificaciones ───────────────────────────────────────────────────────────
interface PrefsProps {
  data: any;
  saving: boolean;
  onSave: (prefs: Record<string, boolean>) => Promise<void>;
}

export function AvisosV2({ data, saving, onSave }: PrefsProps) {
  const pr = data?.profile?.preferences ?? {};
  // Mismas llaves y mismos valores por defecto que NotificationsSection.
  const [prefs, setPrefs] = useState({
    email_notifications: pr.email_notifications ?? true,
    push_notifications: pr.push_notifications ?? true,
    activity_alerts: pr.activity_alerts ?? true,
    marketing_emails: pr.marketing_emails ?? false,
    order_updates: pr.order_updates ?? true,
    post_training_opt_out: pr.post_training_opt_out ?? false,
  });
  const set = (k: keyof typeof prefs) => (v: boolean) => setPrefs((s) => ({ ...s, [k]: v }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); void onSave(prefs); }} className="space-y-4">
      <div className="divide-y">
        <FilaSwitch id="v2-email" label="Por correo" ayuda="Cobros, recordatorios y novedades del club." checked={prefs.email_notifications} onChange={set('email_notifications')} />
        <FilaSwitch id="v2-push" label="En el celular" ayuda="Avisos al instante en este teléfono o navegador." checked={prefs.push_notifications} onChange={set('push_notifications')} />
        <FilaSwitch id="v2-activity" label="Clases y horarios nuevos" ayuda="Cuando el club publique o cambie horarios." checked={prefs.activity_alerts} onChange={set('activity_alerts')} />
        <FilaSwitch id="v2-orders" label="Pagos y compras" ayuda="Confirmaciones de tus pagos y pedidos." checked={prefs.order_updates} onChange={set('order_updates')} />
        <FilaSwitch
          id="v2-post-training"
          label="Pregunta después del entreno"
          ayuda="Cómo fue cada entreno. El informe mensual te llega igual."
          checked={!prefs.post_training_opt_out}
          onChange={(v) => setPrefs((s) => ({ ...s, post_training_opt_out: !v }))}
        />
        <FilaSwitch id="v2-marketing" label="Novedades de SportMaps" ayuda="Funciones nuevas y promociones." checked={prefs.marketing_emails} onChange={set('marketing_emails')} />
      </div>
      <BotonGuardar saving={saving}>Guardar notificaciones</BotonGuardar>
    </form>
  );
}

// ── Privacidad ───────────────────────────────────────────────────────────────
export function PrivacidadV2({ data, saving, onSave }: PrefsProps) {
  const pr = data?.profile?.preferences ?? {};
  // Mismas llaves que PrivacySection (show_achievements viaja aunque no se muestre).
  const [prefs, setPrefs] = useState({
    public_profile: pr.public_profile ?? true,
    show_stats: pr.show_stats ?? true,
    show_achievements: pr.show_achievements ?? true,
    allow_search: pr.allow_search ?? true,
  });
  const set = (k: keyof typeof prefs) => (v: boolean) => setPrefs((s) => ({ ...s, [k]: v }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); void onSave(prefs); }} className="space-y-4">
      <div className="divide-y">
        <FilaSwitch id="v2-public" label="Perfil público" ayuda="Otras personas ven tu nombre y tu foto." checked={prefs.public_profile} onChange={set('public_profile')} />
        <FilaSwitch id="v2-search" label="Aparecer en búsquedas" ayuda="Que te encuentren por tu nombre o tu correo." checked={prefs.allow_search} onChange={set('allow_search')} />
        <FilaSwitch id="v2-stats" label="Mostrar estadísticas" ayuda="Si lo apagas, solo las ve el profe." checked={prefs.show_stats} onChange={set('show_stats')} />
      </div>
      <BotonGuardar saving={saving}>Guardar privacidad</BotonGuardar>
    </form>
  );
}

// ── Seguridad ────────────────────────────────────────────────────────────────
export function validarContrasena(nueva: string, repetida: string): string | null {
  if (nueva.length < 6) return 'La contraseña debe tener al menos 6 caracteres.';
  if (nueva !== repetida) return 'Las contraseñas no coinciden.';
  return null;
}

export function SeguridadV2({ saving, onChangePassword }: { saving: boolean; onChangePassword: (pw: string) => Promise<void> }) {
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [error, setError] = useState<string | null>(null);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const err = validarContrasena(nueva, repetida);
    setError(err);
    if (err) return;
    try {
      await onChangePassword(nueva);
      setNueva('');
      setRepetida('');
    } catch {
      // El hook ya avisa con un toast.
    }
  };

  return (
    <div className="space-y-5">
      <form onSubmit={enviar} className="space-y-4">
        <h3 className="text-base font-semibold">Cambiar contraseña</h3>
        <div className="space-y-2">
          <Label htmlFor="v2-new-password">Nueva contraseña</Label>
          <Input id="v2-new-password" type="password" className="text-input" autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="v2-confirm-password">Repítela</Label>
          <Input id="v2-confirm-password" type="password" className="text-input" autoComplete="new-password" value={repetida} onChange={(e) => setRepetida(e.target.value)} />
          <p className="text-xs text-muted-foreground">Mínimo 6 caracteres. Mejor si no la usas en otros sitios.</p>
        </div>
        {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        <BotonGuardar saving={saving} disabled={!nueva}>Cambiar contraseña</BotonGuardar>
      </form>
      <AccountDeletionCard variant="v2" />
    </div>
  );
}
