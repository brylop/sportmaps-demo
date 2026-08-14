import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, Loader2, Building2, Check, ShieldOff, CalendarClock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { bffClient } from '@/lib/api/bffClient';

// Duraciones de prueba que se conceden a mano. El registro nuevo nace con 1 mes
// (trigger create_default_school_subscription); acá se extiende cuando se acuerda.
const MESES_PRUEBA = [1, 2, 3, 6, 12];

// Add-ons que el super-admin puede prender/apagar por escuela.
const ADDONS: { key: string; label: string; icon: string; note?: string }[] = [
  { key: 'accounting',     label: 'Contabilidad',           icon: '📊' },
  { key: 'invoicing',      label: 'Facturación electrónica', icon: '🧾', note: 'DIAN · por volumen' },
  { key: 'tournaments',    label: 'Torneos',                icon: '🏆' },
  { key: 'store',          label: 'Tienda',                 icon: '🛍️' },
  { key: 'nutrition',      label: 'Nutrición',              icon: '🥗' },
  { key: 'biomech',        label: 'Biomecánica',            icon: '📈' },
  { key: 'access_control', label: 'Control de acceso',      icon: '🔐', note: 'Hardware' },
  { key: 'whitelabel',     label: 'App White-Label',        icon: '🎨', note: 'App nativa propia' },
  // OJO: distinto de whitelabel. Esto es solo la PWA — al instalarla desde el
  // navegador sale con el logo y el nombre de la escuela. No incluye app nativa.
  // Tampoco se hereda: si se contrata White-Label hay que prender los dos.
  { key: 'pwa_branding',   label: 'PWA con marca propia',   icon: '📲', note: 'Logo al instalar' },
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

export default function AdminSubscriptionsPage() {
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [selected, setSelected] = useState<SchoolRow | null>(null);
  const [ent, setEnt] = useState<Record<string, any> | null>(null);
  const [loadingEnt, setLoadingEnt] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);

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

  function selectSchool(s: SchoolRow) {
    setSelected(s);
    void loadEnt(s.id);
  }

  async function toggleAddon(key: string, next: boolean) {
    if (!selected) return;
    setSavingKey(key);
    const { error } = await supabase.rpc('admin_set_school_addon' as any, {
      p_school_id: selected.id, p_addon_key: key, p_enabled: next,
    });
    setSavingKey(null);
    if (error) { toast({ title: 'No se pudo cambiar', description: error.message, variant: 'destructive' }); return; }
    setEnt((prev) => prev ? { ...prev, [`has_${key}`]: next } : prev);
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
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
