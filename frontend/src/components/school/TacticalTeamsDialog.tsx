/**
 * «Configuración de los equipos» (M6b de docs/specs/pizarra-m6-paridad-tacticalpad.md):
 * los dos equipos lado a lado (apilados en el celular), cada uno con nombre,
 * escudo, 3 colores, estilo de ficha, qué va dentro y debajo, y portero con
 * otra apariencia; abajo el tamaño global de jugadores y material y «Mostrar
 * nombres» para las exportaciones. Vista previa en vivo de cada ficha.
 *
 * El rival: «Plantilla» (solo número + alias, ≤ 30), «Guardar este rival» y
 * «Equipos almacenados». El propio: «Plantilla» abre los jugadores REALES
 * del equipo (el panel de siempre), nunca se copia al jsonb.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Loader2, Plus, Save, Trash2, Users, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useDeleteRivalTeam, useRivalTeams, useSaveRivalTeam } from '@/hooks/useTacticalTeams';
import {
  CAPTION_LABEL, CAPTIONS, CHIP_STYLE_LABEL, CHIP_STYLES, CREST_DESIGN_LABEL, CREST_DESIGNS, CREST_SHAPE_LABEL, CREST_SHAPES,
  INNER_LABEL, INNER_TEXTS, MAX_ALIAS, MAX_RIVAL_ROSTER, MAX_TEAM_NAME, SCALE_MAX, SCALE_MIN,
  chipCaption, chipInnerText, chipLook, contrastRatio, defaultTeamsConfig, initialsFrom, MIN_CONTRAST,
  type TacticalAwayConfig, type TacticalTeamConfig, type TacticalTeamsConfig, type TeamColors,
} from '@/lib/school/tacticalTeams';
import { applyRivalTeam, rivalInputFrom } from '@/lib/school/tacticalRivalTeams';
import { CrestGlyph, TeamPlayerGlyph } from './tacticalTeamGlyphs';

export interface TacticalTeamsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Configuración actual (null = aspecto de siempre: el diálogo arranca de los valores por defecto). */
  value: TacticalTeamsConfig | null;
  onApply: (next: TacticalTeamsConfig | null) => void;
  homeName: string;
  schoolLogoUrl?: string | null;
  /** Un jugador real de ejemplo para la vista previa (dorsal / nombre). */
  sample?: { number: string | null; name: string; position: string };
  /** «Plantilla» del equipo propio: abre el panel de jugadores de la pizarra. */
  onOpenRoster?: () => void;
  readOnly?: boolean;
}

const COLOR_LABELS: Record<keyof TeamColors, string> = { primary: 'Principal', secondary: 'Secundario', number: 'Número' };

function ColorInputs({ colors, onChange, idPrefix }: { colors: TeamColors; onChange: (c: TeamColors) => void; idPrefix: string }) {
  return (
    <div className="flex gap-3">
      {(Object.keys(COLOR_LABELS) as (keyof TeamColors)[]).map((k) => (
        <label key={k} className="flex flex-col items-center gap-1 text-[11px] text-muted-foreground" htmlFor={`${idPrefix}-${k}`}>
          <input
            id={`${idPrefix}-${k}`}
            type="color"
            value={colors[k]}
            onChange={(e) => onChange({ ...colors, [k]: e.target.value.toLowerCase() })}
            aria-label={`Color ${COLOR_LABELS[k].toLowerCase()}`}
            data-testid={`${idPrefix}-${k}`}
            className="h-10 w-10 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
          />
          {COLOR_LABELS[k]}
        </label>
      ))}
    </div>
  );
}

function Choice<T extends string>({ options, value, onChange, label, labels, testId }: {
  options: readonly T[]; value: T; onChange: (v: T) => void; label: string; labels: Record<T, string>; testId: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={label} data-testid={testId}>
        {options.map((o) => (
          <button key={o} type="button" role="radio" aria-checked={value === o} onClick={() => onChange(o)}
            className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${value === o ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted'}`}>
            {labels[o]}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Vista previa: jugador de campo + arquero sobre césped. */
function ChipPreview({ team, sample, testId }: { team: TacticalTeamConfig; sample: { number: string | null; name: string; position: string }; testId: string }) {
  const gk = { number: '1', name: sample.name, position: 'Arquero' };
  return (
    <svg viewBox="0 0 120 52" className="h-20 w-full rounded-md" role="img" aria-label="Vista previa de la ficha" data-testid={testId}>
      <rect width={120} height={52} rx={6} fill="#2f7d32" />
      <line x1={60} y1={0} x2={60} y2={52} stroke="#ffffff" strokeOpacity={0.35} strokeWidth={1} />
      <TeamPlayerGlyph x={36} y={20} look={chipLook(team, false)} text={chipInnerText(team, sample)} caption={chipCaption(team, sample)} />
      <TeamPlayerGlyph x={84} y={20} look={chipLook(team, true)} text={chipInnerText(team, gk)} caption={chipCaption(team, gk)} />
    </svg>
  );
}

function ContrastNote({ colors }: { colors: TeamColors }) {
  if (contrastRatio(colors.number, colors.primary) >= MIN_CONTRAST) return null;
  return (
    <p className="text-[11px] text-amber-600 dark:text-amber-400" role="status">
      El número no se lee bien sobre ese color: en la cancha lo pasamos a blanco o negro para que se vea.
    </p>
  );
}

function StyleButtons({ team, onChange, testId }: { team: TacticalTeamConfig; onChange: (s: TacticalTeamConfig['chip_style']) => void; testId: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-muted-foreground">Estilo de ficha</p>
      <div className="grid grid-cols-5 gap-1" role="radiogroup" aria-label="Estilo de ficha" data-testid={testId}>
        {CHIP_STYLES.map((s) => (
          <button key={s} type="button" role="radio" aria-checked={team.chip_style === s} aria-label={CHIP_STYLE_LABEL[s]} title={CHIP_STYLE_LABEL[s]}
            onClick={() => onChange(s)}
            className={`flex aspect-square items-center justify-center rounded-md border ${team.chip_style === s ? 'border-primary ring-2 ring-primary/40' : 'border-border hover:bg-muted'}`}>
            <svg viewBox="-14 -15 28 30" className="h-9 w-9" aria-hidden="true">
              <TeamPlayerGlyph x={0} y={0} look={chipLook({ ...team, chip_style: s }, false)} text="10" caption="" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}

function RosterEditor({ away, onChange }: { away: TacticalAwayConfig; onChange: (a: TacticalAwayConfig) => void }) {
  const setRow = (i: number, patch: Partial<{ number: number; alias: string }>) =>
    onChange({ ...away, roster: away.roster.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const add = () => {
    const used = new Set(away.roster.map((r) => r.number));
    let n = 1;
    while (used.has(n) && n < 99) n++;
    onChange({ ...away, roster: [...away.roster, { number: n }] });
  };
  return (
    <div className="space-y-2 rounded-md border border-border p-2" data-testid="rival-roster">
      <p className="text-[11px] text-muted-foreground">
        Solo número y un apodo corto (máx. {MAX_ALIAS} caracteres, 2 palabras). Nunca nombres completos de jugadores de otra escuela.
      </p>
      <div className="max-h-48 space-y-1 overflow-y-auto">
        {away.roster.map((r, i) => (
          <div key={i} className="flex items-center gap-1">
            <Input type="number" min={0} max={99} value={r.number} aria-label={`Número del rival ${i + 1}`}
              onChange={(e) => setRow(i, { number: Math.max(0, Math.min(99, Math.trunc(Number(e.target.value) || 0))) })}
              className="h-8 w-16 text-sm" />
            <Input value={r.alias ?? ''} maxLength={MAX_ALIAS} placeholder="Alias" aria-label={`Alias del rival ${i + 1}`}
              onChange={(e) => setRow(i, { alias: e.target.value.replace(/[^\p{L}\p{N} .'-]/gu, '').split(/\s+/).slice(0, 3).join(' ') })}
              className="h-8 flex-1 text-sm" />
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label={`Quitar al rival ${i + 1}`}
              onClick={() => onChange({ ...away, roster: away.roster.filter((_, j) => j !== i) })}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" size="sm" variant="outline" onClick={add} disabled={away.roster.length >= MAX_RIVAL_ROSTER}>
        <Plus className="mr-1 h-4 w-4" /> Agregar ({away.roster.length}/{MAX_RIVAL_ROSTER})
      </Button>
    </div>
  );
}

function TeamColumn({ side, team, onChange, logoUrl, sample, extra, testId }: {
  side: 'home' | 'away'; team: TacticalTeamConfig; onChange: (t: TacticalTeamConfig) => void; logoUrl?: string | null;
  sample: { number: string | null; name: string; position: string }; extra: ReactNode; testId: string;
}) {
  const crest = team.crest;
  const generated = crest.kind === 'generated' ? crest : { kind: 'generated' as const, shape: 'shield' as const, design: 'plain' as const, initials: initialsFrom(team.name) };
  const captionOptions = side === 'away' ? (CAPTIONS.filter((c) => c !== 'position')) : CAPTIONS;
  const captionLabels = side === 'away' ? { ...CAPTION_LABEL, name: 'Alias', initials: 'Iniciales del alias' } : CAPTION_LABEL;
  return (
    <section className="space-y-3" aria-label={side === 'home' ? 'Equipo propio' : 'Equipo rival'} data-testid={testId}>
      <div className="flex items-start gap-3">
        <div className="shrink-0" data-testid={`${testId}-crest`}>
          <CrestGlyph crest={crest} primary={team.colors.primary} secondary={team.colors.secondary} numberColor={team.colors.number}
            logoUrl={logoUrl} size={52} title={team.name} />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <Label htmlFor={`${testId}-name`} className="text-xs">{side === 'home' ? 'Nuestro equipo' : 'Rival'}</Label>
          <Input id={`${testId}-name`} value={team.name} maxLength={MAX_TEAM_NAME}
            onChange={(e) => onChange({ ...team, name: e.target.value })} placeholder="Nombre" />
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground">Colores</p>
        <ColorInputs colors={team.colors} onChange={(colors) => onChange({ ...team, colors })} idPrefix={`${testId}-color`} />
        <ContrastNote colors={team.colors} />
      </div>

      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground">Escudo</p>
        {side === 'home' && logoUrl && (
          <label className="flex items-center gap-2 text-xs">
            <Switch checked={crest.kind === 'school_logo'}
              onCheckedChange={(v) => onChange({ ...team, crest: v ? { kind: 'school_logo' } : generated })} aria-label="Usar el logo de la escuela" />
            Logo de la escuela
          </label>
        )}
        {crest.kind === 'generated' && (
          <div className="flex flex-wrap items-center gap-1.5">
            <select aria-label="Forma del escudo" value={crest.shape} className="h-8 rounded-md border border-border bg-background px-2 text-xs"
              onChange={(e) => onChange({ ...team, crest: { ...crest, shape: e.target.value as typeof crest.shape } })}>
              {CREST_SHAPES.map((s) => <option key={s} value={s}>{CREST_SHAPE_LABEL[s]}</option>)}
            </select>
            <select aria-label="Diseño del escudo" value={crest.design} className="h-8 rounded-md border border-border bg-background px-2 text-xs"
              onChange={(e) => onChange({ ...team, crest: { ...crest, design: e.target.value as typeof crest.design } })}>
              {CREST_DESIGNS.map((d) => <option key={d} value={d}>{CREST_DESIGN_LABEL[d]}</option>)}
            </select>
            <Input aria-label="Iniciales del escudo" value={crest.initials} maxLength={3} className="h-8 w-16 text-xs uppercase"
              onChange={(e) => onChange({ ...team, crest: { ...crest, initials: e.target.value.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 3).toUpperCase() } })} />
          </div>
        )}
      </div>

      <StyleButtons team={team} onChange={(chip_style) => onChange({ ...team, chip_style })} testId={`${testId}-style`} />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Choice label="Dentro de la ficha" options={INNER_TEXTS} labels={INNER_LABEL} value={team.inner}
          onChange={(inner) => onChange({ ...team, inner })} testId={`${testId}-inner`} />
        <Choice label="Debajo" options={captionOptions} labels={captionLabels} value={team.caption}
          onChange={(caption) => onChange({ ...team, caption })} testId={`${testId}-caption`} />
      </div>

      <div className="space-y-2 rounded-md bg-muted/40 p-2">
        <label className="flex items-center gap-2 text-xs font-medium">
          <Switch checked={team.gk_distinct} onCheckedChange={(v) => onChange({ ...team, gk_distinct: v })} aria-label="Portero con otra apariencia" />
          Portero con otra apariencia
        </label>
        {team.gk_distinct && (
          <ColorInputs colors={team.gk_colors} onChange={(gk_colors) => onChange({ ...team, gk_colors })} idPrefix={`${testId}-gk`} />
        )}
      </div>

      <ChipPreview team={team} sample={sample} testId={`${testId}-preview`} />
      {extra}
    </section>
  );
}

export function TacticalTeamsDialog({
  open, onOpenChange, value, onApply, homeName, schoolLogoUrl, sample, onOpenRoster, readOnly,
}: TacticalTeamsDialogProps) {
  const { toast } = useToast();
  const [draft, setDraft] = useState<TacticalTeamsConfig>(() => value ?? defaultTeamsConfig({ homeName, hasSchoolLogo: !!schoolLogoUrl }));
  const [rosterOpen, setRosterOpen] = useState(false);
  useEffect(() => {
    if (open) {
      setDraft(value ?? defaultTeamsConfig({ homeName, hasSchoolLogo: !!schoolLogoUrl }));
      setRosterOpen(false);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const rivals = useRivalTeams(open);
  const saveRival = useSaveRivalTeam();
  const deleteRival = useDeleteRivalTeam();
  const homeSample = sample ?? { number: '10', name: 'Jugador Ejemplo', position: 'Delantero' };
  const awaySample = useMemo(() => {
    const first = draft.away.roster[0];
    return { number: first ? String(first.number) : '9', name: first?.alias || 'Rival', position: '' };
  }, [draft.away.roster]);

  const setHome = (home: TacticalTeamConfig) => setDraft((d) => ({ ...d, home }));
  const setAway = (away: TacticalAwayConfig) => setDraft((d) => ({ ...d, away }));

  async function handleSaveRival() {
    try {
      const saved = await saveRival.mutateAsync({ id: draft.away.rival_team_id, body: rivalInputFrom(draft.away) });
      setAway({ ...draft.away, rival_team_id: saved.id });
      toast({ title: 'Rival guardado', description: `«${saved.name}» quedó en Equipos almacenados.` });
    } catch (err: any) {
      toast({ title: 'No se pudo guardar el rival', description: err?.message, variant: 'destructive' });
    }
  }

  const homeExtra = (
    <Button type="button" variant="outline" size="sm" onClick={() => { onOpenChange(false); onOpenRoster?.(); }} disabled={!onOpenRoster}>
      <Users className="mr-1 h-4 w-4" /> Plantilla
    </Button>
  );
  const awayExtra = (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <Button type="button" variant={rosterOpen ? 'default' : 'outline'} size="sm" onClick={() => setRosterOpen((v) => !v)} aria-pressed={rosterOpen}>
          <Users className="mr-1 h-4 w-4" /> Plantilla ({draft.away.roster.length})
        </Button>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm">Equipos almacenados</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64 max-h-72 overflow-y-auto">
            <DropdownMenuLabel>Rivales guardados</DropdownMenuLabel>
            {rivals.isLoading && <p className="px-2 py-1 text-xs text-muted-foreground"><Loader2 className="mr-1 inline h-3 w-3 animate-spin" />Cargando…</p>}
            {rivals.isError && <p className="px-2 py-1 text-xs text-muted-foreground">Todavía no están disponibles.</p>}
            {rivals.data && rivals.data.length === 0 && <p className="px-2 py-1 text-xs text-muted-foreground">Aún no hay rivales guardados.</p>}
            {(rivals.data ?? []).map((r) => (
              <DropdownMenuItem key={r.id} onSelect={() => setAway(applyRivalTeam(draft.away, r))} className="gap-2">
                <span className="h-3 w-3 shrink-0 rounded-full border" style={{ background: r.color_primary }} />
                <span className="flex-1 truncate">{r.name}</span>
                {!readOnly && (
                  <button type="button" aria-label={`Borrar ${r.name}`} className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteRival.mutate(r.id); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <p className="px-2 py-1 text-[11px] text-muted-foreground">Elegir uno copia su nombre, colores, escudo y plantilla.</p>
          </DropdownMenuContent>
        </DropdownMenu>
        {!readOnly && (
          <Button type="button" variant="secondary" size="sm" onClick={handleSaveRival} disabled={saveRival.isPending || !draft.away.name.trim()}>
            {saveRival.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
            Guardar este rival
          </Button>
        )}
      </div>
      {rosterOpen && <RosterEditor away={draft.away} onChange={setAway} />}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-4xl overflow-y-auto p-4 sm:p-6" data-testid="teams-dialog">
        <DialogHeader>
          <DialogTitle>Configuración de los equipos</DialogTitle>
          <DialogDescription>Cómo se ven tus jugadores y los del rival en la cancha, en el 3D y al exportar.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:divide-x md:divide-border">
          <TeamColumn side="home" team={draft.home} onChange={setHome} logoUrl={schoolLogoUrl} sample={homeSample} extra={homeExtra} testId="team-home" />
          <div className="md:pl-6">
            <TeamColumn side="away" team={draft.away} onChange={(t) => setAway({ ...draft.away, ...t })} sample={awaySample} extra={awayExtra} testId="team-away" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 border-t border-border pt-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs">Tamaño de los jugadores · {Math.round(draft.player_scale * 100)} %</Label>
            <Slider min={SCALE_MIN} max={SCALE_MAX} step={0.05} value={[draft.player_scale]} aria-label="Tamaño de los jugadores"
              onValueChange={([v]) => setDraft((d) => ({ ...d, player_scale: v }))} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Tamaño del material · {Math.round(draft.object_scale * 100)} %</Label>
            <Slider min={SCALE_MIN} max={SCALE_MAX} step={0.05} value={[draft.object_scale]} aria-label="Tamaño del material"
              onValueChange={([v]) => setDraft((d) => ({ ...d, object_scale: v }))} />
          </div>
          <label className="flex items-start gap-2 text-xs sm:col-span-2">
            <Switch checked={draft.export_names} onCheckedChange={(v) => setDraft((d) => ({ ...d, export_names: v }))} aria-label="Mostrar nombres al exportar" />
            <span>
              <span className="font-medium">Mostrar nombres al exportar</span>
              <span className="block text-muted-foreground">PNG, PDF, video y compartir. Apagado: salen número y posición (son menores de edad).</span>
            </span>
          </label>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" onClick={() => { onApply(null); onOpenChange(false); }} disabled={readOnly || !value}>
            Volver al aspecto de siempre
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="button" onClick={() => { onApply(draft); onOpenChange(false); }} disabled={readOnly}>Listo</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
