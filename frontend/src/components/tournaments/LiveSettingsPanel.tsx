import { useCallback, useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { bffClient } from '@/lib/api/bffClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, Trash2, Link2, AlertCircle } from 'lucide-react';
import type { LiveConfigDto, ScorekeeperCreated, ScorekeeperDto } from '@/lib/tournamentTypes';
import { validateStreamUrl, formatBogota } from '@/lib/tournamentDisplay';

const LIVE_BASE = '/api/v1/tournament-live';
const selectCls = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** Plantilla actualmente guardada: la sugerida si no hay config propia; la que coincida; o «personalizada». */
export function currentPresetKey(cfg: LiveConfigDto): string {
  const saved = cfg.event.scoring_config;
  if (!saved || Object.keys(saved).length === 0) return cfg.suggested_preset;
  const s = JSON.stringify(saved);
  return cfg.presets.find((p) => JSON.stringify(p.config) === s)?.key ?? '';
}

export function LiveSettingsPanel({ eventId, config, onChanged }: { eventId: string; config: LiveConfigDto; onChanged: () => void }) {
  const { toast } = useToast();
  const base = `${LIVE_BASE}/school/${eventId}`;
  const [preset, setPreset] = useState(currentPresetKey(config));
  const [stream, setStream] = useState(config.event.stream_url ?? '');
  const [busy, setBusy] = useState(false);
  const [keepers, setKeepers] = useState<ScorekeeperDto[]>([]);
  const [label, setLabel] = useState('');
  const [court, setCourt] = useState('');
  const [hours, setHours] = useState('12');
  const [created, setCreated] = useState<ScorekeeperCreated | null>(null);

  const streamError = useMemo(() => validateStreamUrl(stream), [stream]);

  useEffect(() => { setPreset(currentPresetKey(config)); setStream(config.event.stream_url ?? ''); }, [config]);

  const loadKeepers = useCallback(async () => {
    try { setKeepers(await bffClient.get<ScorekeeperDto[]>(`${base}/scorekeepers`)); }
    catch (e) { toast({ title: 'No se pudieron cargar los anotadores', description: (e as Error).message, variant: 'destructive' }); }
  }, [base, toast]);
  useEffect(() => { void loadKeepers(); }, [loadKeepers]);

  const patch = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true);
    try { await bffClient.patch(`${base}/config`, body); toast({ title: ok }); onChanged(); }
    catch (e) { toast({ title: 'No se pudo guardar', description: (e as Error).message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };

  const createKeeper = async () => {
    if (!label.trim()) { toast({ title: 'Ponle una etiqueta al enlace (por ejemplo «Mesa cancha 1»)', variant: 'destructive' }); return; }
    setBusy(true);
    try {
      const r = await bffClient.post<ScorekeeperCreated>(`${base}/scorekeepers`, {
        label: label.trim(), ...(court.trim() ? { court: court.trim() } : {}), expires_hours: Number(hours) || 12,
      });
      setCreated(r); setLabel(''); setCourt('');
      await loadKeepers();
    } catch (e) { toast({ title: 'No se pudo crear el enlace', description: (e as Error).message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast({ title: 'Enlace copiado' }); }
    catch { toast({ title: 'No se pudo copiar', description: 'Selecciona el enlace y cópialo a mano.', variant: 'destructive' }); }
  };

  const revoke = async (k: ScorekeeperDto) => {
    try { await bffClient.delete(`${base}/scorekeepers/${k.id}`); toast({ title: 'Enlace revocado' }); await loadKeepers(); }
    catch (e) { toast({ title: 'No se pudo revocar', description: (e as Error).message, variant: 'destructive' }); }
  };

  const keeperState = (k: ScorekeeperDto) => {
    if (k.revoked_at) return { label: 'Revocado', variant: 'outline' as const };
    if (k.expires_at && Date.parse(k.expires_at) < Date.now()) return { label: 'Vencido', variant: 'outline' as const };
    return { label: 'Activo', variant: 'default' as const };
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Ajustes en vivo</CardTitle></CardHeader>
      <CardContent className="space-y-5">
        {config.global_live_disabled && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>El marcador en vivo está apagado temporalmente en toda la plataforma. Podrás cargar resultados finales, pero no anotar en vivo.</AlertDescription>
          </Alert>
        )}

        <div className="flex items-center justify-between gap-3">
          <div>
            <Label htmlFor="live-enabled" className="text-sm font-medium">Marcador en vivo</Label>
            <p className="text-xs text-muted-foreground">Apagado: solo se muestra el resultado final de cada partido.</p>
          </div>
          <Switch id="live-enabled" checked={config.event.live_enabled} disabled={busy}
            onCheckedChange={(v) => patch({ live_enabled: v }, v ? 'Marcador en vivo encendido' : 'Marcador en vivo apagado')} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="live-preset">Plantilla de marcador</Label>
          <div className="flex gap-2">
            <select id="live-preset" className={selectCls} value={preset} onChange={(e) => setPreset(e.target.value)}>
              {preset === '' && <option value="">Personalizada</option>}
              {config.presets.map((p) => (
                <option key={p.key} value={p.key}>{p.label}{p.key === config.suggested_preset ? ' (sugerida)' : ''}</option>
              ))}
            </select>
            <Button variant="outline" disabled={busy || preset === '' || preset === currentPresetKey(config)} onClick={() => patch({ preset }, 'Plantilla guardada')}>Guardar</Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="live-stream">Enlace de la transmisión (opcional)</Label>
          <div className="flex gap-2">
            <Input id="live-stream" inputMode="url" placeholder="https://www.youtube.com/watch?v=…" value={stream} onChange={(e) => setStream(e.target.value)} aria-invalid={!!streamError} />
            <Button variant="outline" disabled={busy || !!streamError || stream.trim() === (config.event.stream_url ?? '')}
              onClick={() => patch({ stream_url: stream.trim() === '' ? null : stream.trim() }, 'Enlace guardado')}>Guardar</Button>
          </div>
          {streamError ? <p role="alert" className="text-xs text-destructive">{streamError}</p>
            : <p className="text-xs text-muted-foreground">YouTube, Facebook o Vimeo. En la página pública aparece como «Ver transmisión».</p>}
        </div>

        {/* Anotadores sin cuenta */}
        <div className="space-y-3 border-t pt-4">
          <div>
            <h3 className="text-sm font-semibold">Anotadores sin cuenta</h3>
            <p className="text-xs text-muted-foreground">Enlaces para que la mesa anote desde el celular sin iniciar sesión. Se pueden revocar en cualquier momento.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_6rem_auto]">
            <Input aria-label="Etiqueta del enlace" placeholder="Etiqueta (Mesa cancha 1)" value={label} onChange={(e) => setLabel(e.target.value)} />
            <Input aria-label="Cancha" placeholder="Cancha (opcional)" value={court} onChange={(e) => setCourt(e.target.value)} />
            <Input aria-label="Horas de vigencia" type="number" min={1} max={720} value={hours} onChange={(e) => setHours(e.target.value)} title="Horas de vigencia" />
            <Button onClick={createKeeper} disabled={busy}><Link2 className="mr-1 h-4 w-4" /> Crear enlace</Button>
          </div>

          {created && (
            <div className="space-y-2 rounded-md border border-primary/40 bg-primary/5 p-3" data-testid="created-link">
              <p className="text-sm font-medium">Copia este enlace ahora: no volverá a mostrarse.</p>
              <div className="flex gap-2">
                <Input readOnly value={created.url} onFocus={(e) => e.currentTarget.select()} aria-label="Enlace del anotador" />
                <Button variant="outline" onClick={() => copy(created.url)}><Copy className="mr-1 h-4 w-4" /> Copiar</Button>
              </div>
              <div className="inline-block rounded bg-white p-2"><QRCodeSVG value={created.url} size={144} level="M" /></div>
              <div><Button variant="ghost" size="sm" onClick={() => setCreated(null)}>Ya lo copié</Button></div>
            </div>
          )}

          {keepers.length === 0 ? <p className="text-sm text-muted-foreground">Aún no hay enlaces.</p> : (
            <ul className="space-y-1.5">
              {keepers.map((k) => {
                const st = keeperState(k);
                return (
                  <li key={k.id} className="flex flex-wrap items-center gap-2 rounded border px-2 py-1.5 text-sm">
                    <span className="font-medium">{k.label}</span>
                    {k.court && <span className="text-muted-foreground">· {k.court}</span>}
                    <Badge variant={st.variant}>{st.label}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {k.expires_at ? `vence ${formatBogota(k.expires_at)}` : ''}{k.last_used_at ? ` · usado ${formatBogota(k.last_used_at)}` : ''}
                    </span>
                    {st.label === 'Activo' && (
                      <Button variant="ghost" size="sm" className="ml-auto" onClick={() => revoke(k)} aria-label={`Revocar ${k.label}`}><Trash2 className="mr-1 h-4 w-4" /> Revocar</Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
