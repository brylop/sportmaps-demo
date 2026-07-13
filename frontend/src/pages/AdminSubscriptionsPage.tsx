import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Loader2, Building2, Check } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

// Add-ons que el super-admin puede prender/apagar por escuela.
const ADDONS: { key: string; label: string; icon: string; note?: string }[] = [
  { key: 'accounting',     label: 'Contabilidad',           icon: '📊' },
  { key: 'invoicing',      label: 'Facturación electrónica', icon: '🧾', note: 'DIAN · por volumen' },
  { key: 'tournaments',    label: 'Torneos',                icon: '🏆' },
  { key: 'store',          label: 'Tienda',                 icon: '🛍️' },
  { key: 'nutrition',      label: 'Nutrición',              icon: '🥗' },
  { key: 'biomech',        label: 'Biomecánica',            icon: '📈' },
  { key: 'access_control', label: 'Control de acceso',      icon: '🔐', note: 'Hardware' },
  { key: 'whitelabel',     label: 'App White-Label',        icon: '🎨', note: 'App propia' },
  { key: 'whatsapp',       label: 'WhatsApp campañas',      icon: '💬' },
  { key: 'wompi',          label: 'Pasarela Wompi',         icon: '💳' },
  { key: 'mp',             label: 'Pasarela MercadoPago',   icon: '💳' },
];

const PLANS = [
  { code: 'starter',     label: 'Starter (gratis)' },
  { code: 'crecimiento', label: 'Crecimiento' },
  { code: 'profesional', label: 'Profesional' },
  { code: 'elite',       label: 'Elite' },
  { code: 'enterprise',  label: 'Enterprise / Custom' },
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
      setSchools((data as any[])?.map((s) => ({ id: s.id, name: s.name, city: s.city })) ?? []);
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
