import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Download, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { bffClient } from '@/lib/api/bffClient';

/**
 * Barra de la pestaña Cartera: «Descargar informe» (CSV para Excel) y el
 * interruptor del informe semanal por correo (lunes 7:00).
 *
 * El informe lo arma el BFF (services/informe-cartera.service) con la MISMA
 * lógica que el correo: morosos por familia, pendientes del mes, comprobantes
 * en revisión, atletas que no asisten y dados de baja con saldo. No se recalcula
 * acá para que el archivo y el correo nunca digan cosas distintas.
 */
type Ajuste = { activo: boolean; explicito: boolean | null; cancelacionAutomatica: boolean; columnaDisponible: boolean };

export function CarteraInformeBar({ schoolId }: { schoolId: string | null | undefined }) {
  const { toast } = useToast();
  const [ajuste, setAjuste] = useState<Ajuste | null>(null);
  const [descargando, setDescargando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    let vivo = true;
    bffClient.get<{ ajuste: Ajuste }>('/api/v1/reports/school/cartera/ajuste')
      .then((r) => { if (vivo) setAjuste(r.ajuste); })
      .catch(() => { if (vivo) setAjuste(null); });
    return () => { vivo = false; };
  }, [schoolId]);

  const descargar = async () => {
    setDescargando(true);
    try {
      const r = await bffClient.get<{ csv: string; archivo: string }>('/api/v1/reports/school/cartera');
      const url = URL.createObjectURL(new Blob([r.csv], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = r.archivo || 'cartera.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err: any) {
      toast({ title: 'No se pudo generar el informe', description: err?.message || 'Intenta de nuevo en un momento.', variant: 'destructive' });
    } finally {
      setDescargando(false);
    }
  };

  const cambiar = async (activo: boolean) => {
    setGuardando(true);
    try {
      const r = await bffClient.put<{ ajuste: Ajuste }>('/api/v1/reports/school/cartera/ajuste', { enabled: activo });
      setAjuste(r.ajuste);
      toast({ title: activo ? 'Recibirás el informe de cartera los lunes' : 'Informe semanal desactivado' });
    } catch (err: any) {
      toast({ title: 'No se pudo guardar', description: err?.message || 'Intenta de nuevo.', variant: 'destructive' });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-md border bg-muted/30 p-3 mb-4">
      <div className="flex items-center gap-3">
        <Switch
          id="informe-cartera-semanal"
          checked={!!ajuste?.activo}
          disabled={!ajuste || guardando || !ajuste.columnaDisponible}
          onCheckedChange={cambiar}
        />
        <label htmlFor="informe-cartera-semanal" className="text-sm leading-tight">
          <span className="font-medium">Informe de cartera por correo los lunes</span>
          <span className="block text-xs text-muted-foreground">
            Morosos, pendientes del mes, comprobantes en revisión y atletas que no asisten.
            {ajuste && ajuste.explicito === null && (ajuste.activo
              ? ' Activo porque las inscripciones no se cancelan por mora.'
              : ' Apagado por defecto.')}
          </span>
        </label>
      </div>
      <Button variant="outline" size="sm" onClick={descargar} disabled={descargando || !schoolId} className="gap-2 shrink-0">
        {descargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        Descargar informe
      </Button>
    </div>
  );
}
