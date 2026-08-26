import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, Loader2, Building2, Check, ShieldOff, CalendarClock, DollarSign, Receipt, Send, FileText, LayoutGrid } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { bffClient } from '@/lib/api/bffClient';
import { toWaPhone } from '@/lib/api/payment-reminders';
import { MODULE_CATALOG, MODULE_GROUPS } from '@/config/module-catalog';

// Duraciones de prueba que se conceden a mano. El registro nuevo nace con 1 mes
// (trigger create_default_school_subscription); acá se extiende cuando se acuerda.
const MESES_PRUEBA = [1, 2, 3, 6, 12];

// Los ÚNICOS valores que v_school_entitlements sabe mapear a módulos. Cualquier
// otro deja a la escuela sin Academia y sin Reservas — por eso el selector es
// cerrado y la RPC valida contra esta misma lista.
const TIPOS_ESCUELA = [
  { value: 'academy',          label: 'Academia — solo formación' },
  { value: 'club',             label: 'Club deportivo' },
  { value: 'escuela',          label: 'Escuela deportiva' },
  { value: 'hybrid',           label: 'Híbrido — formación + reservas' },
  { value: 'venue',            label: 'Escenario — solo reservas' },
  { value: 'gimnasio',         label: 'Gimnasio — reservas + formación' },
  { value: 'personal_trainer', label: 'Entrenador personal' },
];

// Add-ons que el super-admin puede prender/apagar por escuela.
const ADDONS: { key: string; label: string; icon: string; note?: string }[] = [
  { key: 'accounting',     label: 'Contabilidad',           icon: '📊' },
  { key: 'invoicing',      label: 'Facturación electrónica', icon: '🧾', note: 'DIAN · por volumen' },
  { key: 'tournaments',    label: 'Torneos',                icon: '🏆' },
  { key: 'store',          label: 'Tienda',                 icon: '🛍️' },
  { key: 'nutrition',      label: 'Nutrición',              icon: '🥗' },
  { key: 'biomech',        label: 'Biomecánica',            icon: '📈' },
  { key: 'access_control', label: 'Control de acceso',      icon: '🔐', note: 'Hardware' },
  // ── Los DOS productos de marca. No confundirlos ──────────────────────────
  // pwa_branding = la marca se MUESTRA (manifest, iconos, login, colores) en
  //                web, Android e iOS. Se instala desde el navegador.
  // whitelabel   = ADEMAS app NATIVA propia en App Store y Play Store, y es el
  //                unico que permite ocultar el "powered by SportMaps".
  // Prender whitelabel prende tambien pwa_branding (ver toggleAddon): la
  // herencia se aplica al otorgar, nunca al leer.
  { key: 'pwa_branding',   label: 'PWA con marca propia',   icon: '📲', note: 'Se instala del navegador · incluye iOS' },
  { key: 'whitelabel',     label: 'App nativa propia',      icon: '🎨', note: 'App Store + Play Store · sin atribución' },
  { key: 'whatsapp',       label: 'WhatsApp campañas',      icon: '💬' },
  { key: 'wompi',          label: 'Pasarela Wompi',         icon: '💳' },
  { key: 'mp',             label: 'Pasarela MercadoPago',   icon: '💳' },
];

const PLANS = [
  { code: 'starter',     label: 'Free Start (gratis)' },
  { code: 'start',       label: 'Escuela Start · $69k' },
  { code: 'crecimiento', label: 'Escuela Crecimiento · $99k' },
  { code: 'profesional', label: 'Escuela Pro · $159k' },
  { code: 'elite',       label: 'Escuela Elite · $349k · todo incluido' },
  { code: 'enterprise',  label: 'Custom' },
];

interface SchoolRow { id: string; name: string; city: string | null; }

interface SaasInvoiceRow {
  id: string;
  invoice_number: string;
  plan_code: string;
  amount_cents: number;
  period_start: string;
  period_end: string;
  due_date: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
}

const formatCopCents = (cents: number) => `$${Math.round(cents / 100).toLocaleString('es-CO')}`;

/**
 * Segmented control de 3 posiciones para un módulo del menú. Deliberadamente
 * NO es el switch binario que usa la grilla de add-ons de arriba: con dos
 * posiciones se pierde la distinción entre "heredado" (NULL — sigue el
 * default) y "forzado OFF" (false — apagado a propósito), que es la base de
 * que F0-F2 no cambien nada hasta que alguien toque este control.
 */
function TriStateModuleControl({
  state, disabled, onChange,
}: { state: 'heredado' | 'on' | 'off'; disabled: boolean; onChange: (v: boolean | null) => void }) {
  return (
    <div className="inline-flex rounded-lg border overflow-hidden text-xs shrink-0">
      {(['heredado', 'on', 'off'] as const).map((s) => (
        <button
          key={s}
          type="button"
          disabled={disabled}
          onClick={() => onChange(s === 'heredado' ? null : s === 'on')}
          className={`px-2.5 py-1.5 font-medium transition-colors disabled:opacity-50 ${
            state === s
              ? s === 'off' ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground'
              : 'hover:bg-muted text-muted-foreground'
          }`}
        >
          {s === 'heredado' ? 'Heredado' : s === 'on' ? 'ON' : 'OFF'}
        </button>
      ))}
    </div>
  );
}

export default function AdminSubscriptionsPage() {
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [selected, setSelected] = useState<SchoolRow | null>(null);
  const [ent, setEnt] = useState<Record<string, any> | null>(null);
  const [loadingEnt, setLoadingEnt] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [saasBillingEnabled, setSaasBillingEnabled] = useState<boolean | null>(null);
  const [saasInvoices, setSaasInvoices] = useState<SaasInvoiceRow[]>([]);
  const [loadingSaas, setLoadingSaas] = useState(false);
  const [sendingInvoiceId, setSendingInvoiceId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchSchools = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('admin_list_schools_global' as any, {
        p_search: debounced || null, p_verified: null, p_limit: 25, p_offset: 0,
      });
      if (error) throw error;
      const rows = ((data as any)?.rows ?? []) as any[];
      setSchools(rows.map((s) => ({ id: s.id, name: s.name, city: s.city })));
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [debounced]);

  useEffect(() => { void fetchSchools(); }, [fetchSchools]);

  async function loadEnt(schoolId: string) {
    setLoadingEnt(true);
    setEnt(null);
    const { data, error } = await supabase
      .from('v_school_entitlements' as any)
      .select('*')
      .eq('school_id', schoolId)
      .maybeSingle();
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else setEnt(data as any);
    setLoadingEnt(false);
  }

  async function loadSaasInvoicing(schoolId: string) {
    setLoadingSaas(true);
    const [{ data: sub }, { data: invoices }] = await Promise.all([
      supabase.from('school_subscriptions' as any).select('saas_billing_enabled').eq('school_id', schoolId).maybeSingle(),
      supabase.from('school_subscription_invoices' as any).select('*').eq('school_id', schoolId).order('period_start', { ascending: false }),
    ]);
    setSaasBillingEnabled((sub as any)?.saas_billing_enabled ?? false);
    setSaasInvoices((invoices as any) || []);
    setLoadingSaas(false);
  }

  function selectSchool(s: SchoolRow) {
    setSelected(s);
    void loadEnt(s.id);
    void loadSaasInvoicing(s.id);
  }

  /** Manda (o reenvía) email + push de una factura, y deja lista la ventana de WhatsApp. */
  async function sendSaasInvoice(invoiceId: string) {
    setSendingInvoiceId(invoiceId);
    try {
      const r = await bffClient.post<{ ok: boolean; whatsapp: { phone: string | null; message: string } | null }>(
        `/api/v1/platform/invoices/${invoiceId}/send`,
        {},
      );
      const waPhone = toWaPhone(r?.whatsapp?.phone);
      if (waPhone && r?.whatsapp?.message) {
        window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(r.whatsapp.message)}`, '_blank');
      }
      toast({
        title: 'Factura enviada',
        description: waPhone
          ? 'Email y notificación enviados. Se abrió WhatsApp con el mensaje listo.'
          : 'Email y notificación enviados. La escuela no tiene un celular válido para WhatsApp.',
      });
    } catch (e: any) {
      toast({ title: 'No se pudo enviar la factura', description: e?.message, variant: 'destructive' });
    } finally {
      setSendingInvoiceId(null);
    }
  }

  async function viewSaasInvoicePdf(invoiceId: string) {
    try {
      const r = await bffClient.get<{ ok: boolean; url: string }>(`/api/v1/platform/invoices/${invoiceId}/pdf-url`);
      window.open(r.url, '_blank');
    } catch (e: any) {
      toast({ title: 'No se pudo abrir el PDF', description: e?.message || 'Genera/envía la factura primero.', variant: 'destructive' });
    }
  }

  async function markSaasInvoicePaid(invoiceId: string) {
    setSendingInvoiceId(invoiceId);
    try {
      await bffClient.post(`/api/v1/platform/invoices/${invoiceId}/mark-paid`, {});
      setSaasInvoices((prev) => prev.map((i) => (i.id === invoiceId ? { ...i, status: 'paid' } : i)));
      toast({ title: 'Factura marcada como pagada' });
    } catch (e: any) {
      toast({ title: 'No se pudo marcar como pagada', description: e?.message, variant: 'destructive' });
    } finally {
      setSendingInvoiceId(null);
    }
  }

  async function toggleSaasBilling(next: boolean) {
    if (!selected) return;
    setSavingKey('__saas_billing__');
    const { data, error } = await supabase.rpc('admin_set_saas_billing_enabled' as any, {
      p_school_id: selected.id, p_enabled: next,
    });
    setSavingKey(null);
    if (error) {
      toast({ title: 'No se pudo cambiar', description: error.message, variant: 'destructive' });
      return;
    }
    setSaasBillingEnabled(next);
    const firstInvoiceId = (data as any)?.first_invoice_id as string | null;
    await loadSaasInvoicing(selected.id);
    if (firstInvoiceId) {
      toast({ title: 'Facturación SaaS activada', description: 'Generando y enviando la primera factura…' });
      await sendSaasInvoice(firstInvoiceId);
    } else {
      toast({ title: next ? 'Facturación SaaS activada' : 'Facturación SaaS desactivada', description: selected.name });
    }
  }

  async function toggleAddon(key: string, next: boolean) {
    if (!selected) return;
    setSavingKey(key);
    const { error } = await supabase.rpc('admin_set_school_addon' as any, {
      p_school_id: selected.id, p_addon_key: key, p_enabled: next,
    });
    if (error) {
      setSavingKey(null);
      toast({ title: 'No se pudo cambiar', description: error.message, variant: 'destructive' });
      return;
    }
    setEnt((prev) => prev ? { ...prev, [`has_${key}`]: next } : prev);

    // La app nativa INCLUYE la marca del PWA. Esa herencia se aplica al
    // OTORGAR, nunca al leer: si se resolviera en una vista con un OR, todo el
    // sistema tendria dos reglas para la misma pregunta y bastaria con que una
    // quedara desincronizada para que una escuela tuviera el icono con su logo
    // y los colores de SportMaps adentro. Ya paso: un OR en la vista activo la
    // marca en 29 escuelas de golpe (migraciones 20260814104612 / 105131).
    //
    // Al apagar white-label NO se apaga pwa_branding: puede haberse vendido
    // suelto, y decidir eso no le corresponde a este toggle.
    if (key === 'whitelabel' && next) {
      const { error: errPwa } = await supabase.rpc('admin_set_school_addon' as any, {
        p_school_id: selected.id, p_addon_key: 'pwa_branding', p_enabled: true,
      });
      if (!errPwa) {
        setEnt((prev) => prev ? { ...prev, has_pwa_branding: true } : prev);
        toast({
          title: 'App propia activada',
          description: 'Se activó también "PWA con marca propia": la app nativa la incluye.',
        });
        setSavingKey(null);
        return;
      }
      toast({
        title: 'Ojo: quedó a medias',
        description: 'Se activó la app propia pero NO la marca del PWA. Prendela a mano.',
        variant: 'destructive',
      });
      setSavingKey(null);
      return;
    }

    setSavingKey(null);
    toast({ title: next ? 'Módulo activado' : 'Módulo desactivado', description: `${key} · ${selected.name}` });
  }

  /**
   * Regenera los iconos del manifest PWA desde el logo ya cargado.
   *
   * Hace falta un boton porque los iconos se generan como efecto de guardar la
   * marca: una escuela que ya tenia logo, o a la que se le prende el addon hoy,
   * se queda sin iconos y el manifest le devuelve la marca SportMaps hasta que
   * su admin entre y reguarde el logo.
   */
  async function regenerarIconosPwa() {
    if (!selected) return;
    setSavingKey('__pwa_icons__');
    try {
      const r = await bffClient.post<{ ok: boolean }>(
        `/api/v1/schools/${selected.id}/pwa-icons/regenerate`,
        {},
        { 'X-Requested-With': 'SportMaps' },
      );
      toast({
        title: r?.ok ? 'Iconos generados' : 'No se generaron',
        description: r?.ok
          ? `${selected.name} ya se instala con su marca. Ojo: quien la tenga instalada necesita reinstalar.`
          : 'Revisa que la escuela tenga logo cargado.',
        variant: r?.ok ? undefined : 'destructive',
      });
    } catch (e: any) {
      toast({
        title: 'No se pudieron generar los iconos',
        description: e?.message || 'Verifica que la escuela tenga un logo cargado.',
        variant: 'destructive',
      });
    } finally {
      setSavingKey(null);
    }
  }

  /**
   * Corre un RPC de prueba y RELEE la fuente antes de pintar.
   * El resto de esta página usa update optimista (pinta lo que pidió, no lo que
   * la BD respondió) y por eso era imposible distinguir "se guardó" de "no se
   * guardó". Acá no: si la relectura no coincide con lo pedido, se ve.
   */
  async function accionPrueba(rpc: string, params: Record<string, unknown>, ok: string) {
    if (!selected) return;
    setSavingKey(rpc);
    const { error } = await supabase.rpc(rpc as any, { p_school_id: selected.id, ...params });
    if (error) {
      setSavingKey(null);
      toast({ title: 'No se pudo aplicar', description: error.message, variant: 'destructive' });
      return;
    }
    await loadEnt(selected.id);   // verificado, no optimista
    setSavingKey(null);
    toast({ title: ok, description: selected.name });
  }

  async function changePlan(code: string) {
    if (!selected) return;
    setSavingKey('__plan__');
    const { error } = await supabase.rpc('admin_set_school_plan' as any, {
      p_school_id: selected.id, p_plan_code: code, p_status: 'active',
    });
    setSavingKey(null);
    if (error) { toast({ title: 'No se pudo cambiar el plan', description: error.message, variant: 'destructive' }); return; }
    setEnt((prev) => prev ? { ...prev, plan_code: code } : prev);
    toast({ title: 'Plan actualizado', description: `${code} · ${selected.name}` });
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Building2 className="h-7 w-7 text-primary" />
          Suscripciones y módulos
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Activa o desactiva planes y módulos por escuela con un switch. Cambios inmediatos (auditados).
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
        {/* Lista de escuelas */}
        <Card>
          <CardHeader className="pb-3">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar escuela…" className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </CardHeader>
          <CardContent className="p-2 max-h-[70vh] overflow-y-auto">
            {loading ? (
              <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : schools.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4 text-center">Sin resultados.</p>
            ) : schools.map((s) => (
              <button
                key={s.id}
                onClick={() => selectSchool(s)}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${selected?.id === s.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
              >
                <div className="font-medium text-sm truncate">{s.name}</div>
                {s.city && <div className="text-xs text-muted-foreground">{s.city}</div>}
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Detalle de la escuela seleccionada */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {selected ? selected.name : 'Selecciona una escuela'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selected ? (
              <p className="text-muted-foreground text-sm py-8 text-center">Elige una escuela de la izquierda para gestionar su plan y módulos.</p>
            ) : loadingEnt ? (
              <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : (
              <div className="space-y-6">
                {/* Plan */}
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-semibold">Plan:</span>
                  <Select value={ent?.plan_code || 'starter'} onValueChange={changePlan}>
                    <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PLANS.map((p) => <SelectItem key={p.code} value={p.code}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {ent?.subscription_status && <Badge variant="outline">{ent.subscription_status}</Badge>}
                  {savingKey === '__plan__' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </div>

                {/* Periodo de prueba */}
                <div className="rounded-xl border p-4 space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold">Periodo de prueba</p>
                    {ent?.is_operational === false && <Badge variant="destructive">Bloqueada</Badge>}
                    {ent?.blocking_exempt && <Badge variant="outline" className="border-amber-500 text-amber-600">Avisa sin bloquear</Badge>}
                    {ent?.account_type && ent.account_type !== 'real' && (
                      <Badge variant="secondary">{String(ent.account_type).toUpperCase()}</Badge>
                    )}
                  </div>

                  {/* Estado verificado, leído de la BD tras cada cambio */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <div className="text-muted-foreground">Registro</div>
                      <div className="font-medium">
                        {ent?.school_created_at ? new Date(ent.school_created_at).toLocaleDateString('es-CO') : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Vence</div>
                      <div className="font-medium">
                        {ent?.trial_ends_at ? new Date(ent.trial_ends_at).toLocaleDateString('es-CO') : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Días restantes</div>
                      <div className="font-medium">
                        {ent?.trial_ends_at
                          ? Math.round((new Date(ent.trial_ends_at).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000)
                          : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Meses concedidos</div>
                      <div className="font-medium">{ent?.trial_months ?? '—'}</div>
                    </div>
                  </div>

                  {/* Fijar duración contada desde la fecha de registro */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">Prueba desde el registro:</span>
                    {MESES_PRUEBA.map((m) => (
                      <Button
                        key={m}
                        size="sm"
                        variant={ent?.trial_months === m ? 'default' : 'outline'}
                        disabled={!!savingKey}
                        onClick={() => accionPrueba('admin_set_trial', { p_months: m }, `Prueba fijada en ${m} mes(es)`)}
                      >
                        {m} {m === 1 ? 'mes' : 'meses'}
                      </Button>
                    ))}
                  </div>

                  {/* Fecha exacta, para acuerdos que no caen en meses redondos */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">O fecha exacta:</span>
                    <Input
                      type="date"
                      className="w-[170px] h-9"
                      defaultValue={ent?.trial_ends_at ? new Date(ent.trial_ends_at).toISOString().slice(0, 10) : ''}
                      disabled={!!savingKey}
                      onChange={(e) => {
                        if (!e.target.value) return;
                        // Se fija al cierre del día elegido: si no, "vence el 20"
                        // dejaría a la escuela bloqueada desde la medianoche del 20.
                        void accionPrueba(
                          'admin_set_trial',
                          { p_months: null, p_ends_at: `${e.target.value}T23:59:00-05:00` },
                          'Fecha de vencimiento actualizada',
                        );
                      }}
                    />
                    <Button size="sm" variant="outline" disabled={!!savingKey}
                      onClick={() => accionPrueba('admin_extend_trial', { p_months: 1 }, 'Prueba extendida 1 mes')}>
                      +1 mes
                    </Button>
                    <Button size="sm" variant="outline" disabled={!!savingKey}
                      onClick={() => accionPrueba('admin_expire_trial_now', {}, 'Prueba expirada')}>
                      Expirar ya
                    </Button>
                  </div>

                  {/* Exención: avisa pero no corta (el caso Dynasty) */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t">
                    <ShieldOff className="h-4 w-4 text-amber-600" />
                    <span className="text-xs text-muted-foreground flex-1 min-w-[180px]">
                      {ent?.blocking_exempt
                        ? `Exenta del bloqueo${ent.blocking_exempt_reason ? `: ${ent.blocking_exempt_reason}` : ''}`
                        : 'Ve el aviso y se bloquea al vencer.'}
                    </span>
                    <Button
                      size="sm"
                      variant={ent?.blocking_exempt ? 'default' : 'outline'}
                      disabled={!!savingKey}
                      onClick={() => accionPrueba(
                        'admin_set_blocking_exempt',
                        {
                          p_exempt: !ent?.blocking_exempt,
                          p_reason: ent?.blocking_exempt ? null : 'En uso real — exenta por decisión comercial',
                        },
                        ent?.blocking_exempt ? 'Exención retirada' : 'Exenta del bloqueo',
                      )}
                    >
                      {ent?.blocking_exempt ? 'Quitar exención' : 'No bloquear'}
                    </Button>
                    <Select
                      value={ent?.account_type || 'real'}
                      onValueChange={(v) => accionPrueba('admin_set_account_type', { p_account_type: v }, `Cuenta marcada como ${v}`)}
                    >
                      <SelectTrigger className="w-[130px] h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="real">Cliente real</SelectItem>
                        <SelectItem value="test">Pruebas</SelectItem>
                        <SelectItem value="demo">Demo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <p className="text-[11px] text-muted-foreground">
                    Las cuentas marcadas <b>Pruebas</b> o <b>Demo</b> nunca se bloquean ni las toca el cron de expiración.
                  </p>
                </div>

                {/* Tipo de escuela — decide qué módulos ve (CAR-1b) */}
                <div className="rounded-xl border p-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold">Tipo de escuela</p>
                    {ent?.school_type && !TIPOS_ESCUELA.some((t) => t.value === ent.school_type) && (
                      <Badge variant="destructive">Valor desconocido — sin módulos</Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Select
                      value={ent?.school_type || 'academy'}
                      onValueChange={(v) => accionPrueba('admin_set_school_type', { p_school_type: v }, `Tipo cambiado a ${v}`)}
                    >
                      <SelectTrigger className="w-[230px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TIPOS_ESCUELA.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* El efecto real, no el prometido: cambiar el tipo prende y
                        apaga módulos completos. */}
                    <div className="flex gap-2 text-xs">
                      <Badge variant={ent?.has_academy ? 'default' : 'outline'}>
                        Academia {ent?.has_academy ? '✓' : '✗'}
                      </Badge>
                      <Badge variant={ent?.has_reservations ? 'default' : 'outline'}>
                        Reservas {ent?.has_reservations ? '✓' : '✗'}
                      </Badge>
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground">
                    Decide qué módulos ve la escuela: <b>Academia</b> y <b>Reservas</b> se derivan de
                    acá, no del plan. Un club que además quiera reservar espacios va en <b>Híbrido</b>.
                    Cambiarlo prende o apaga módulos enteros — no es una preferencia estética.
                  </p>
                </div>

                {/* Cobros a familias — interruptor maestro (CAR-2) */}
                <div className="rounded-xl border p-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <DollarSign className="h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold">Cobros a familias</p>
                    {ent?.has_billing === false && (
                      <Badge variant="outline" className="border-amber-500 text-amber-600">Apagados</Badge>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {ent?.has_billing === false
                      ? 'Esta escuela NO cobra mensualidades por SportMaps: no ve Pagos, Finanzas ni Recordatorios, y ningún cron le genera cartera ni mora. Sus cobros existentes no se borran — vuelven a verse al reactivar.'
                      : 'Cobra mensualidades por SportMaps. Apágalo para clubes que cobran por fuera (membresías propias, convenios).'}
                  </p>

                  <Button
                    size="sm"
                    variant={ent?.has_billing === false ? 'default' : 'outline'}
                    disabled={!!savingKey}
                    onClick={() => accionPrueba(
                      'admin_set_billing_enabled',
                      { p_enabled: ent?.has_billing === false },
                      ent?.has_billing === false ? 'Cobros activados' : 'Cobros desactivados',
                    )}
                  >
                    {ent?.has_billing === false ? 'Activar cobros' : 'Desactivar cobros'}
                  </Button>

                  <p className="text-[11px] text-muted-foreground">
                    Apagarlo fuerza <code>auto_generate_payments</code>, <code>late_fee_enabled</code> y{' '}
                    <code>reminder_enabled</code> a <b>false</b>, que es lo que hace que los tres crons
                    salten la escuela. No toca <b>/mi-plan</b> (lo que la escuela nos paga a nosotros).
                  </p>
                </div>

                {/* Facturación SportMaps — lo que la escuela NOS paga a nosotros */}
                <div className="rounded-xl border p-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Receipt className="h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold">Facturación SportMaps</p>
                    {saasBillingEnabled && <Badge variant="outline" className="border-emerald-500 text-emerald-600">Activa</Badge>}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Recibo informal (no factura DIAN) de la mensualidad SaaS que esta escuela nos paga a
                    nosotros. Activar por primera vez genera y envía la primera factura de inmediato; de
                    ahí en adelante el ciclo sigue solo cada mes.
                  </p>

                  <Button
                    size="sm"
                    variant={saasBillingEnabled ? 'outline' : 'default'}
                    disabled={savingKey === '__saas_billing__' || loadingSaas}
                    onClick={() => toggleSaasBilling(!saasBillingEnabled)}
                  >
                    {savingKey === '__saas_billing__' ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                      saasBillingEnabled ? 'Desactivar facturación' : 'Activar facturación'
                    )}
                  </Button>

                  {saasInvoices.length > 0 && (
                    <div className="space-y-2 pt-2">
                      {saasInvoices.map((inv) => (
                        <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2 text-xs">
                          <div>
                            <p className="font-medium">{inv.invoice_number} · {formatCopCents(inv.amount_cents)}</p>
                            <p className="text-muted-foreground">
                              Vence {new Date(inv.due_date).toLocaleDateString('es-CO')} ·{' '}
                              <Badge
                                variant="outline"
                                className={
                                  inv.status === 'paid' ? 'border-emerald-500 text-emerald-600'
                                  : inv.status === 'overdue' ? 'border-red-500 text-red-600'
                                  : inv.status === 'cancelled' ? 'border-muted-foreground text-muted-foreground'
                                  : 'border-amber-500 text-amber-600'
                                }
                              >
                                {inv.status}
                              </Badge>
                            </p>
                          </div>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => viewSaasInvoicePdf(inv.id)} title="Ver PDF">
                              <FileText className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm" variant="ghost"
                              disabled={sendingInvoiceId === inv.id}
                              onClick={() => sendSaasInvoice(inv.id)}
                              title="Enviar / reenviar por email y WhatsApp"
                            >
                              {sendingInvoiceId === inv.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            </Button>
                            {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                              <Button
                                size="sm" variant="ghost"
                                disabled={sendingInvoiceId === inv.id}
                                onClick={() => markSaasInvoicePaid(inv.id)}
                                title="Marcar como pagada"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Módulos */}
                <div>
                  <p className="text-sm font-semibold mb-3">Módulos (add-ons)</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {ADDONS.map((a) => {
                      const on = !!ent?.[`has_${a.key}`];
                      const busy = savingKey === a.key;
                      return (
                        <button
                          key={a.key}
                          onClick={() => toggleAddon(a.key, !on)}
                          disabled={busy}
                          className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${on ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/30'}`}
                        >
                          <span className="text-xl">{a.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">{a.label}</div>
                            {a.note && <div className="text-[11px] text-muted-foreground">{a.note}</div>}
                          </div>
                          {/* Switch */}
                          <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${on ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                            {busy ? (
                              <Loader2 className="h-3 w-3 animate-spin text-white mx-auto" />
                            ) : (
                              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`}>
                                {on && <Check className="h-3 w-3 text-primary mx-auto mt-1" />}
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Los iconos del manifest se generan al guardar la marca. Si
                      la escuela ya tenía logo de antes, no los tiene y su app se
                      instalaría como SportMaps: este botón los crea sin que su
                      admin tenga que entrar a reguardar el logo. */}
                  {!!ent?.has_pwa_branding && (
                    <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-dashed p-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">Íconos de la app instalable</div>
                        <div className="text-[11px] text-muted-foreground">
                          Se generan desde el logo. Si la escuela ya tenía logo cargado, hay que generarlos una vez.
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!!savingKey}
                        onClick={regenerarIconosPwa}
                      >
                        {savingKey === '__pwa_icons__' && <Loader2 className="h-3 w-3 animate-spin mr-2" />}
                        Generar íconos
                      </Button>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground mt-3">
                    Prender un módulo lo activa al instante para la escuela (Modelo asistido). El cobro se gestiona aparte.
                  </p>
                </div>

                {/* Módulos del menú — override UX-only, capa independiente de los
                    add-ons de arriba. Un ítem con addon asociado (Contabilidad,
                    Control de Acceso) sigue necesitando el addon: acá solo se
                    puede apagar por encima, nunca sustituye la compra. */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <LayoutGrid className="h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold">Módulos del menú</p>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Oculta ítems del menú lateral para esta escuela. <b>Heredado</b> = visible
                    (o sigue al addon de arriba, si el ítem tiene uno). No reemplaza un addon:
                    forzar <b>ON</b> acá no activa un módulo que la escuela no compró.
                  </p>

                  <div className="space-y-4">
                    {MODULE_GROUPS.map((group) => {
                      const items = Object.values(MODULE_CATALOG).filter((m) => m.group === group);
                      return (
                        <div key={group}>
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                            {group}
                          </p>
                          <div className="space-y-1.5">
                            {items.map((def) => {
                              const raw = ent?.module_overrides?.[def.key] as boolean | undefined;
                              const state: 'heredado' | 'on' | 'off' = raw === undefined ? 'heredado' : raw ? 'on' : 'off';
                              const hasAddonRight = !def.addon || !!ent?.[`has_${def.addon}`];
                              return (
                                <div
                                  key={def.key}
                                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-sm truncate">{def.label}</span>
                                    {def.addon && !hasAddonRight && (
                                      <Badge variant="outline" className="border-amber-500 text-amber-600 shrink-0">
                                        sin addon
                                      </Badge>
                                    )}
                                  </div>
                                  <TriStateModuleControl
                                    state={state}
                                    disabled={!!savingKey}
                                    onChange={(v) => accionPrueba(
                                      'admin_set_school_module',
                                      { p_module_key: def.key, p_enabled: v },
                                      v === null
                                        ? `${def.label}: vuelto a heredado`
                                        : `${def.label}: forzado ${v ? 'ON' : 'OFF'}`,
                                    )}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Valor efectivo ahora mismo — la escuela real puede tener un
                      addon apagado Y un override en heredado a la vez; esta tabla
                      resuelve la cuenta en vez de que alguien la haga a mano. */}
                  <div className="mt-4 rounded-xl border p-3">
                    <p className="text-xs font-semibold mb-2">Valor efectivo ahora mismo</p>
                    <div className="space-y-1 text-xs">
                      {Object.values(MODULE_CATALOG).map((def) => {
                        const raw = ent?.module_overrides?.[def.key] as boolean | undefined;
                        const hasAddonRight = !def.addon || !!ent?.[`has_${def.addon}`];
                        const isOn = raw !== false;
                        const effective = hasAddonRight && isOn;
                        const motivo = !hasAddonRight
                          ? 'sin addon'
                          : raw === undefined ? 'heredado' : `forzado ${raw ? 'ON' : 'OFF'}`;
                        return (
                          <div key={def.key} className="flex items-center justify-between gap-2 py-0.5">
                            <span className="text-muted-foreground">{def.label}</span>
                            <span className={effective ? 'text-emerald-600' : 'text-muted-foreground'}>
                              {effective ? '✅' : '❌'} {motivo}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
