import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Clock, Loader2 } from 'lucide-react';
import { paymentRemindersAPI } from '@/lib/api/payment-reminders';

interface ReminderHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schoolId: string;
}

export function ReminderHistoryModal({ open, onOpenChange, schoolId }: ReminderHistoryModalProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && schoolId) {
      setLoading(true);
      paymentRemindersAPI.getReminderLogs(schoolId)
        .then(setLogs)
        .finally(() => setLoading(false));
    }
  }, [open, schoolId]);

  const channelBadge = (channel: string) => {
    if (channel === 'whatsapp') return <Badge className="bg-green-500 gap-1"><MessageCircle className="h-3 w-3" />WhatsApp</Badge>;
    if (channel === 'email') return <Badge variant="secondary">📧 Email</Badge>;
    if (channel === 'in_app') return <Badge variant="outline">🔔 In-app</Badge>;
    return <Badge variant="outline">📱 {channel}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Historial de Recordatorios Enviados
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No se han enviado recordatorios todavía</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Canal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">
                      {new Date(log.sent_at).toLocaleDateString('es-CO', {
                        day: '2-digit', month: 'short',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-sm">{log.contact_name}</p>
                      <p className="text-xs text-muted-foreground">{log.contact_email || log.contact_phone || '—'}</p>
                    </TableCell>
                    <TableCell className="font-semibold text-sm">
                      {log.amount
                        ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(log.amount)
                        : '—'}
                    </TableCell>
                    <TableCell>{channelBadge(log.channel)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
