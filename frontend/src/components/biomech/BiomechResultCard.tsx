/**
 * BiomechResultCard.tsx
 * 
 * Card compacta que muestra el resultado de un análisis biomecánico.
 * Usada en:
 *   - ClientProgressTab (vista del trainer, lista de capturas del cliente)
 *   - SessionExecution post-captura (confirmación al atleta)
 * 
 * Ubicación: frontend/src/components/biomech/BiomechResultCard.tsx
 */

import { Badge }   from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button }  from '@/components/ui/button';
import {
  CheckCircle2, AlertTriangle, AlertCircle,
  Activity, ChevronDown, ChevronUp, Clock,
} from 'lucide-react';
import { useState } from 'react';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface BiomechAnalysis {
  id:                  string;
  rep_count?:          number | null;
  metrics?:            Record<string, number>;
  flags?:              Array<{ metric: string; value?: number; threshold?: number; severity: 'warning' | 'critical' }>;
  summary?:            string | null;
  quality_rating?:     'good' | 'acceptable' | 'poor' | null;
  suggested_correctives?: any[];
  processed_at?:       string | null;
}

export interface BiomechCapture {
  id:              string;
  analyzer_code:   string;
  status:          string;
  duration_seconds?: number | null;
  quality_score?:  number | null;
  source:          string;
  created_at:      string;
  biomech_analyses?: BiomechAnalysis | BiomechAnalysis[] | null;
}

interface BiomechResultCardProps {
  capture:      BiomechCapture;
  /** Si true muestra el botón de anotación (solo en vista del trainer) */
  showAnnotate?: boolean;
  onAnnotate?:   (captureId: string) => void;
  className?:    string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ANALYZER_LABELS: Record<string, string> = {
  hack_squat:    'Sentadilla Hack',
  incline_press: 'Press Inclinado',
  row:           'Remo',
};

const QUALITY_CONFIG = {
  good:       { label: 'Buena',      color: 'text-green-500',  bg: 'bg-green-500/10',  border: 'border-green-500/20',  icon: CheckCircle2   },
  acceptable: { label: 'Aceptable',  color: 'text-amber-500',  bg: 'bg-amber-500/10',  border: 'border-amber-500/20',  icon: AlertTriangle  },
  poor:       { label: 'A mejorar',  color: 'text-red-500',    bg: 'bg-red-500/10',    border: 'border-red-500/20',    icon: AlertCircle    },
};

function normalizeAnalysis(raw: BiomechAnalysis | BiomechAnalysis[] | null | undefined): BiomechAnalysis | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw;
}

function formatMetricKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function metricUnit(key: string): string {
  if (key.includes('angle') || key.includes('extension') || key.includes('rom') ||
      key.includes('symmetry') || key.includes('compensation') || key.includes('torso')) return '°';
  if (key.includes('depth') || key.includes('score')) return '';
  return '';
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (days > 0)  return `hace ${days}d`;
  if (hours > 0) return `hace ${hours}h`;
  if (mins > 0)  return `hace ${mins}min`;
  return 'ahora';
}

// ── Componente ────────────────────────────────────────────────────────────────

export function BiomechResultCard({
  capture, showAnnotate = false, onAnnotate, className = '',
}: BiomechResultCardProps) {
  const [expanded, setExpanded] = useState(false);

  const analysis = normalizeAnalysis(capture.biomech_analyses);
  const label    = ANALYZER_LABELS[capture.analyzer_code] ?? capture.analyzer_code;

  // Si aún no tiene análisis (status pending/processing)
  if (!analysis) {
    return (
      <Card className={`border-border/40 bg-card/60 ${className}`}>
        <CardContent className="p-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-muted/40 flex items-center justify-center shrink-0">
            <Activity className="h-4 w-4 text-muted-foreground animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate">{label}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {capture.status === 'processing' ? 'Procesando...' : 'Pendiente de análisis'}
            </p>
          </div>
          <Badge variant="outline" className="text-[9px] shrink-0">
            {capture.status}
          </Badge>
        </CardContent>
      </Card>
    );
  }

  const quality = analysis.quality_rating
    ? QUALITY_CONFIG[analysis.quality_rating] ?? QUALITY_CONFIG.acceptable
    : null;
  const QualityIcon = quality?.icon ?? Activity;

  const criticalFlags = (analysis.flags ?? []).filter(f => f.severity === 'critical');
  const warningFlags  = (analysis.flags ?? []).filter(f => f.severity === 'warning');
  const hasFlags      = (analysis.flags?.length ?? 0) > 0;

  return (
    <Card className={`border-border/40 bg-card/60 overflow-hidden ${className}`}>
      {/* Barra de calidad superior */}
      <div className={`h-0.5 ${
        analysis.quality_rating === 'good'       ? 'bg-green-500' :
        analysis.quality_rating === 'acceptable' ? 'bg-amber-500' :
        analysis.quality_rating === 'poor'       ? 'bg-red-500'   : 'bg-border'
      }`} />

      <CardContent className="p-3 space-y-3">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          {/* Ícono de calidad */}
          <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${quality?.bg ?? 'bg-muted/40'} border ${quality?.border ?? 'border-border/30'}`}>
            <QualityIcon className={`h-4 w-4 ${quality?.color ?? 'text-muted-foreground'}`} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-bold text-sm truncate">{label}</p>
              {quality && (
                <Badge
                  variant="outline"
                  className={`text-[9px] font-bold shrink-0 ${quality.color} ${quality.bg} ${quality.border}`}
                >
                  {quality.label}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {analysis.rep_count && (
                <span className="text-[10px] text-muted-foreground">
                  {analysis.rep_count} reps
                </span>
              )}
              {capture.duration_seconds && (
                <>
                  <span className="text-[10px] text-muted-foreground/40">·</span>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5" />
                    {capture.duration_seconds}s
                  </span>
                </>
              )}
              <span className="text-[10px] text-muted-foreground/40">·</span>
              <span className="text-[10px] text-muted-foreground">
                {timeAgo(capture.created_at)}
              </span>
            </div>
          </div>

          {/* Flags resumen */}
          <div className="flex items-center gap-1 shrink-0">
            {criticalFlags.length > 0 && (
              <Badge variant="outline" className="text-[9px] font-bold text-red-500 border-red-500/30 bg-red-500/10 px-1.5">
                {criticalFlags.length} crítico{criticalFlags.length > 1 ? 's' : ''}
              </Badge>
            )}
            {warningFlags.length > 0 && (
              <Badge variant="outline" className="text-[9px] font-bold text-amber-500 border-amber-500/30 bg-amber-500/10 px-1.5">
                {warningFlags.length} aviso{warningFlags.length > 1 ? 's' : ''}
              </Badge>
            )}
            {!hasFlags && (
              <Badge variant="outline" className="text-[9px] font-bold text-green-500 border-green-500/30 bg-green-500/10 px-1.5">
                Sin flags
              </Badge>
            )}
          </div>

          {/* Toggle */}
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0 ml-1"
          >
            {expanded
              ? <ChevronUp className="h-4 w-4" />
              : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {/* ── Summary ─────────────────────────────────────────────────── */}
        {analysis.summary && (
          <p className="text-xs text-muted-foreground leading-relaxed px-1 border-l-2 border-border/40 pl-2">
            {analysis.summary}
          </p>
        )}

        {/* ── Detalle expandido ────────────────────────────────────────── */}
        {expanded && (
          <div className="space-y-3 pt-1 border-t border-border/30 animate-in fade-in duration-200">

            {/* Flags */}
            {hasFlags && (
              <div className="space-y-1.5">
                <p className="text-[9px] uppercase font-black tracking-widest text-muted-foreground">
                  Puntos detectados
                </p>
                {(analysis.flags ?? []).map((flag, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2 p-2 rounded-lg border ${
                      flag.severity === 'critical'
                        ? 'bg-red-500/5 border-red-500/20'
                        : 'bg-amber-500/5 border-amber-500/20'
                    }`}
                  >
                    <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                      flag.severity === 'critical' ? 'bg-red-500' : 'bg-amber-500'
                    }`} />
                    <p className="text-xs font-medium flex-1 capitalize">
                      {formatMetricKey(flag.metric)}
                    </p>
                    {flag.value !== undefined && (
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {flag.value}{metricUnit(flag.metric)}
                      </span>
                    )}
                    <Badge
                      variant="outline"
                      className={`text-[8px] font-bold px-1 ${
                        flag.severity === 'critical'
                          ? 'text-red-500 border-red-500/30'
                          : 'text-amber-500 border-amber-500/30'
                      }`}
                    >
                      {flag.severity}
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            {/* Métricas */}
            {analysis.metrics && Object.keys(analysis.metrics).length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[9px] uppercase font-black tracking-widest text-muted-foreground">
                  Métricas
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {Object.entries(analysis.metrics).map(([key, value]) => (
                    <div
                      key={key}
                      className="p-2 bg-muted/30 rounded-lg border border-border/30"
                    >
                      <p className="text-[8px] uppercase font-black tracking-widest text-muted-foreground truncate">
                        {formatMetricKey(key)}
                      </p>
                      <p className="font-black text-base text-primary leading-tight mt-0.5">
                        {typeof value === 'number' ? value : '-'}
                        <span className="text-[10px] font-normal text-muted-foreground ml-0.5">
                          {metricUnit(key)}
                        </span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Botón de anotación (solo para el trainer) */}
            {showAnnotate && onAnnotate && (
              <Button
                size="sm"
                variant="outline"
                className="w-full gap-2 text-xs font-bold border-primary/30 text-primary hover:bg-primary/10"
                onClick={() => onAnnotate(capture.id)}
              >
                + Agregar anotación
              </Button>
            )}

            {/* Disclaimer */}
            <p className="text-[9px] text-muted-foreground/60 text-center leading-relaxed">
              Métricas orientativas · cámara única ±5–10°
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
