import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Check, Gift, Info } from 'lucide-react';

export interface PlanFeature {
  label: string;
  highlight?: boolean;
}

export interface PlanDuration {
  key: string;
  label: string;        // "1 mes - 30 días / $39.900"
  price: number;
  durationDays: number;
}

export interface PlanCardProps {
  title: string;                    // "fútbol · Premium" etc
  subtitle?: string;                // tagline corto opcional
  sport?: string;                   // deporte principal (chip)
  level?: string | null;            // nivel (chip)
  badges?: { label: string; tone?: 'primary' | 'destructive' | 'secondary' | 'outline' }[];
  features: PlanFeature[];
  durations: PlanDuration[];        // al menos 1
  primaryCta: string;               // "Inscribirme"
  onPrimary: (duration: PlanDuration) => void;
  showGift?: boolean;               // mostrar "Obsequiar plan"
  onGift?: (duration: PlanDuration) => void;
  disabled?: boolean;
  disabledLabel?: string;           // ej: "Programa lleno"
  accentClassName?: string;         // clase Tailwind del CTA primario (default dark navy)
  footnoteUrl?: string;             // link "(Aplican T&C)"
}

/**
 * Card de plan con diseño Fitpal:
 *  - Título branded + chips
 *  - Lista de features con check verde
 *  - Selector de duración (1 mes / 3 meses / 6 meses / 12 meses según durations)
 *  - CTA primario "Comprar plan"/"Inscribirme" y opcional "Obsequiar plan"
 */
export function PlanCard({
  title, subtitle, sport, level, badges,
  features, durations,
  primaryCta, onPrimary,
  showGift = false, onGift,
  disabled = false, disabledLabel = 'No disponible',
  accentClassName = 'bg-[#1e2b5e] hover:bg-[#17234a] text-white',
  footnoteUrl,
}: PlanCardProps) {
  const [selectedKey, setSelectedKey] = useState<string>(durations[0]?.key ?? '');
  const selected = durations.find(d => d.key === selectedKey) ?? durations[0];

  return (
    <Card className="relative overflow-hidden border border-border/40 hover:shadow-xl transition-all duration-300 flex flex-col bg-card">
      <CardContent className="p-6 flex-1 flex flex-col">
        {/* Header: brand + chips */}
        <div className="space-y-3 pb-5 border-b border-border/40">
          <div className="flex items-start gap-1.5">
            <h3 className="text-2xl md:text-3xl font-extrabold tracking-tight leading-tight text-foreground">
              {title}
            </h3>
            <Info className="h-3.5 w-3.5 text-muted-foreground mt-1.5 flex-shrink-0" />
          </div>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            {sport && (
              <Badge className="bg-primary/10 text-primary border-0 text-[11px] font-semibold">
                {sport}
              </Badge>
            )}
            {level && (
              <Badge variant="outline" className="text-[11px]">{level}</Badge>
            )}
            {badges?.map((b, i) => (
              <Badge
                key={i}
                variant={b.tone === 'destructive' ? 'destructive' : b.tone === 'outline' ? 'outline' : 'secondary'}
                className={`text-[11px] ${b.tone === 'destructive' ? 'animate-pulse' : ''}`}
              >
                {b.label}
              </Badge>
            ))}
          </div>
        </div>

        {/* Features */}
        <ul className="space-y-2.5 py-5 flex-1">
          {features.map((f, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed">
              <span className="mt-0.5 flex-shrink-0 h-5 w-5 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Check className="h-3 w-3 text-emerald-600" strokeWidth={3} />
              </span>
              <span className={f.highlight ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
                {f.label}
                {f.highlight && footnoteUrl && (
                  <a href={footnoteUrl} target="_blank" rel="noreferrer" className="ml-1 text-primary underline underline-offset-2 font-semibold">
                    (Aplican T&C)
                  </a>
                )}
              </span>
            </li>
          ))}
        </ul>

        <Separator className="mb-4" />

        {/* Duration selector */}
        {durations.length > 1 ? (
          <Select value={selectedKey} onValueChange={setSelectedKey}>
            <SelectTrigger className="w-full h-11 rounded-full border-border/60 bg-muted/40 text-sm font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {durations.map(d => (
                <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="w-full h-11 rounded-full border border-border/60 bg-muted/40 px-4 flex items-center justify-between text-sm font-medium">
            <span>{durations[0]?.label}</span>
          </div>
        )}

        {/* CTAs */}
        <div className="pt-4 space-y-2.5">
          <Button
            size="lg"
            className={`w-full h-12 rounded-full font-bold text-sm tracking-wide ${accentClassName}`}
            onClick={() => selected && onPrimary(selected)}
            disabled={disabled || !selected}
          >
            {disabled ? disabledLabel : primaryCta}
          </Button>

          {showGift && onGift && !disabled && (
            <Button
              size="lg"
              variant="outline"
              className="w-full h-12 rounded-full font-semibold text-sm gap-2"
              onClick={() => selected && onGift(selected)}
            >
              <Gift className="h-4 w-4" />
              Obsequiar plan
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
