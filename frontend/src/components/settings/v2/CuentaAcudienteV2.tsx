/**
 * «Mi cuenta» del acudiente V2 (/settings). Una sola columna, celular primero:
 * quién eres arriba y una lista de cuatro secciones que se abren en el sitio
 * (Perfil · Notificaciones · Privacidad · Seguridad). Sin «Panel de control»,
 * sin menú lateral de pestañas. «Eliminar cuenta» vive dentro de Seguridad.
 *
 * ?seccion=perfil|notificaciones|privacidad|seguridad abre una directo.
 * La escuela y los demás roles siguen con SettingsPage de siempre.
 */
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { AvisosV2, PerfilV2, PrivacidadV2, SeguridadV2, type PerfilV2Props } from './SeccionesCuentaV2';

/* eslint-disable @typescript-eslint/no-explicit-any -- `data` de get_my_settings no tiene tipo */

export const SECCIONES_CUENTA = [
  { id: 'perfil', label: 'Perfil', nota: 'Nombre, WhatsApp y foto' },
  { id: 'notificaciones', label: 'Notificaciones', nota: 'Qué avisos te llegan y por dónde' },
  { id: 'privacidad', label: 'Privacidad', nota: 'Quién ve tu perfil' },
  { id: 'seguridad', label: 'Seguridad', nota: 'Contraseña y eliminar cuenta' },
] as const;

export type SeccionCuenta = (typeof SECCIONES_CUENTA)[number]['id'];

function iniciales(nombre: string): string {
  return nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || 'U';
}

export interface CuentaAcudienteV2Props {
  loading: boolean;
  saving: boolean;
  data: any;
  onRetry: () => void;
  updateProfile: PerfilV2Props['onSave'];
  updateNotificationPreferences: (prefs: Record<string, boolean>) => Promise<void>;
  updatePrivacyPreferences: (prefs: Record<string, boolean>) => Promise<void>;
  changePassword: (password: string) => Promise<void>;
}

export function CuentaAcudienteV2({
  loading, saving, data, onRetry, updateProfile, updateNotificationPreferences, updatePrivacyPreferences, changePassword,
}: CuentaAcudienteV2Props) {
  const { profile } = useAuth();
  const [params, setParams] = useSearchParams();
  const pedida = params.get('seccion');
  const abierta = SECCIONES_CUENTA.some((s) => s.id === pedida) ? (pedida as SeccionCuenta) : '';

  const abrir = (v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set('seccion', v); else next.delete('seccion');
    // replace: abrir y cerrar secciones no debe llenar el «Volver» de pasos.
    setParams(next, { replace: true });
  };

  const nombre = (data?.profile?.full_name as string) || profile?.full_name || 'Tu cuenta';
  const correo = profile?.email ?? '';

  return (
    <div className="mx-auto w-full max-w-page-narrow space-y-5 pb-6 md:space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Mi cuenta</h1>
        <p className="text-base text-muted-foreground">Tus datos, tus avisos y tu contraseña.</p>
      </header>

      {loading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Cargando tu cuenta">
          <div className="flex items-center gap-3">
            <Skeleton className="h-touch w-touch rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
          <Skeleton className="h-56 w-full rounded-2xl" />
        </div>
      ) : !data ? (
        <div role="alert" className="space-y-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
          <p className="flex items-center gap-2 font-semibold text-destructive">
            <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
            No pudimos cargar tu cuenta
          </p>
          <p className="text-sm text-muted-foreground">Revisa tu conexión e inténtalo de nuevo.</p>
          <Button variant="outline" className="min-h-touch" onClick={onRetry}>
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            Reintentar
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <div className="flex h-touch w-touch shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-bold text-primary" aria-hidden="true">
              {iniciales(nombre)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold">{nombre}</p>
              <p className="truncate text-xs text-muted-foreground">Acudiente{correo ? ` · ${correo}` : ''}</p>
            </div>
          </div>

          <Accordion type="single" collapsible value={abierta} onValueChange={abrir} className="overflow-hidden rounded-2xl border bg-card">
            {SECCIONES_CUENTA.map((s) => (
              <AccordionItem key={s.id} value={s.id} className="border-b last:border-b-0">
                <AccordionTrigger className="min-h-touch gap-3 px-4 py-3 text-left hover:bg-muted/50 hover:no-underline">
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-medium">{s.label}</span>
                    <span className="block text-xs font-normal text-muted-foreground">{s.nota}</span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-5 pt-2 text-base">
                  {s.id === 'perfil' && <PerfilV2 data={data} saving={saving} onSave={updateProfile} />}
                  {s.id === 'notificaciones' && <AvisosV2 data={data} saving={saving} onSave={updateNotificationPreferences} />}
                  {s.id === 'privacidad' && <PrivacidadV2 data={data} saving={saving} onSave={updatePrivacyPreferences} />}
                  {s.id === 'seguridad' && <SeguridadV2 saving={saving} onChangePassword={changePassword} />}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <p className="text-center text-xs text-muted-foreground">Powered by SportMaps</p>
        </>
      )}
    </div>
  );
}
