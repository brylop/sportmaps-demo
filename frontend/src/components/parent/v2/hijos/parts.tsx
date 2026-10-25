import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export type Tone = 'good' | 'neutral' | 'bad' | 'info';

const TONE: Record<Tone, string> = {
  good: 'bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300',
  neutral: 'bg-muted text-muted-foreground',
  bad: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
  info: 'bg-primary/10 text-primary',
};

export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', TONE[tone])}>
      {children}
    </span>
  );
}

/** Tarjeta de sección: título arriba, filas separadas por línea. */
export function Section({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn('overflow-hidden rounded-2xl border bg-card text-card-foreground', className)}>
      {title && <h2 className="px-4 pb-1 pt-4 text-sm font-semibold">{title}</h2>}
      {children}
    </section>
  );
}

export function Row({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-h-touch items-center gap-3 border-t px-4 py-2 first:border-t-0', className)}>
      {children}
    </div>
  );
}

export function SectionSkeleton({ rows = 3, label }: { rows?: number; label: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-touch animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
      ))}
    </div>
  );
}

export function InlineError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
      <p className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
        <span>{message}</span>
      </p>
      {onRetry && (
        <Button variant="outline" className="min-h-touch self-start" onClick={onRetry}>
          Intentar de nuevo
        </Button>
      )}
    </div>
  );
}

export function EmptyNote({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
      {icon}
      <div className="max-w-prose-ui">{children}</div>
    </div>
  );
}
