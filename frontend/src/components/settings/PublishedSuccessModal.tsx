import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Copy, ExternalLink, Lightbulb } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface PublishedSuccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  publicUrl: string;
  viewUrl: string;              // relative path, ej "/schools/abc"
  exploreHint?: { label: string; href: string };
  title?: string;
  description?: string;
}

/**
 * Modal "Perfil publicado!" reutilizable por todos los roles (school, trainer,
 * wellness, store). Muestra el link publico con copia y CTAs "Ver perfil" y
 * "Listo", mas hint opcional hacia el tab del explorar.
 */
export function PublishedSuccessModal({
  open, onOpenChange, publicUrl, viewUrl, exploreHint,
  title = '¡Perfil publicado!',
  description = 'Ya eres visible para clientes potenciales en SportMaps. Comparte tu link para que te encuentren.',
}: PublishedSuccessModalProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <div className="flex flex-col items-center text-center space-y-4 py-2">
          <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" strokeWidth={2.5} />
          </div>

          <div className="space-y-1">
            <h2 className="text-xl font-bold">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>

          <div className="w-full flex items-stretch gap-2 bg-muted/40 border border-border rounded-lg p-1">
            <div className="flex-1 min-w-0 px-3 py-2 text-xs font-mono truncate">
              {publicUrl}
            </div>
            <Button size="sm" variant="outline" onClick={copy} className="shrink-0 h-auto">
              {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
              {copied ? 'Copiado' : 'COPIAR'}
            </Button>
          </div>

          <div className="flex gap-2 w-full">
            <Button asChild variant="outline" className="flex-1 gap-1.5">
              <Link to={viewUrl}>
                <ExternalLink className="h-4 w-4" />
                Ver Perfil
              </Link>
            </Button>
            <Button className="flex-1" onClick={() => onOpenChange(false)}>
              Listo
            </Button>
          </div>

          {exploreHint && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
              También puedes encontrar tu perfil en{' '}
              <Link to={exploreHint.href} className="font-semibold underline underline-offset-2 text-foreground">
                {exploreHint.label}
              </Link>
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
