/**
 * ShareStoreDialog — compartir la tienda pública del vendedor.
 *
 * Muestra el enlace público (/tienda/:slug), un QR real escaneable
 * (qrcode.react), y accesos para WhatsApp / compartir nativo / copiar.
 * Solo aparecen los productos públicos en ese enlace.
 */

import { useRef, useState } from 'react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Copy, Check, Download, Share2, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

export function ShareStoreDialog({
  open, onOpenChange, publicUrl, displayName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  publicUrl: string;
  displayName: string;
}) {
  const qrWrapRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      toast.success('Enlace copiado');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('No se pudo copiar el enlace');
    }
  };

  const downloadQR = () => {
    const canvas = qrWrapRef.current?.querySelector('canvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    const slug = (displayName || 'tienda').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `tienda-${slug}-qr.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('QR descargado');
  };

  const waHref = `https://wa.me/?text=${encodeURIComponent(`Mira la tienda de ${displayName} en SportMaps 🛍️\n${publicUrl}`)}`;

  const nativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: `Tienda ${displayName}`, text: `Mira la tienda de ${displayName}`, url: publicUrl });
      } catch { /* usuario canceló */ }
    } else {
      copy();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Compartir tienda</DialogTitle>
          <DialogDescription>
            Un enlace público, sin app ni login. Solo aparecen tus productos públicos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Enlace */}
          <div className="flex items-center gap-1.5 border rounded-lg pl-3 pr-1 py-1">
            <Input
              readOnly
              value={publicUrl}
              className="border-0 shadow-none focus-visible:ring-0 px-0 h-8 text-sm"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button size="sm" variant="ghost" className="shrink-0 gap-1.5" onClick={copy}>
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copiado' : 'Copiar'}
            </Button>
          </div>

          {/* QR */}
          <div ref={qrWrapRef} className="flex flex-col items-center gap-3">
            <div className="bg-white p-3 rounded-xl border shadow-sm">
              <QRCodeSVG value={publicUrl} size={168} level="M" />
            </div>
            {/* canvas oculto solo para exportar PNG en alta resolución */}
            <div className="hidden" aria-hidden="true">
              <QRCodeCanvas value={publicUrl} size={512} level="M" />
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadQR}>
              <Download className="h-4 w-4" /> Descargar QR
            </Button>
          </div>

          {/* Compartir */}
          <div className="grid grid-cols-2 gap-2">
            <Button asChild variant="outline" className="gap-1.5">
              <a href={waHref} target="_blank" rel="noreferrer">
                <MessageCircle className="h-4 w-4 text-emerald-600" /> WhatsApp
              </a>
            </Button>
            <Button variant="outline" className="gap-1.5" onClick={nativeShare}>
              <Share2 className="h-4 w-4" /> Compartir
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
