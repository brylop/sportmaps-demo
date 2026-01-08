import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Clock } from 'lucide-react';

export interface ReminderRecord {
  id: string;
  parent: string;
  student: string;
  amount: number;
  sentAt: string;
  channel: 'whatsapp' | 'email' | 'sms';
}

interface ReminderHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reminders: ReminderRecord[];
}

export function ReminderHistoryModal({ open, onOpenChange, reminders }: ReminderHistoryModalProps) {
  const getChannelBadge = (channel: ReminderRecord['channel']) => {
    switch (channel) {
      case 'whatsapp':
        return <Badge className="bg-green-500 gap-1"><MessageCircle className="h-3 w-3" />WhatsApp</Badge>;
      case 'email':
        return <Badge variant="secondary">📧 Email</Badge>;
      case 'sms':
        return <Badge variant="outline">📱 SMS</Badge>;
    }
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
          {reminders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No se han enviado recordatorios todavía</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha/Hora</TableHead>
                  <TableHead>Padre</TableHead>
                  <TableHead>Estudiante</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Canal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reminders.map((reminder) => (
                  <TableRow key={reminder.id}>
                    <TableCell className="text-sm">
                      {new Date(reminder.sentAt).toLocaleDateString('es-CO', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </TableCell>
                    <TableCell className="font-medium">{reminder.parent}</TableCell>
                    <TableCell>{reminder.student}</TableCell>
                    <TableCell className="text-red-500 font-bold">
                      ${reminder.amount.toLocaleString()}
                    </TableCell>
                    <TableCell>{getChannelBadge(reminder.channel)}</TableCell>
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
