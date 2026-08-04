import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAddManualConfirmation } from '@/hooks/usePolls';
import { AttendancePoll, PollSession } from '@/lib/api/polls.api';

interface Props {
  poll: AttendancePoll;
  session: PollSession;
  onClose: () => void;
}

export function AddConfirmationDialog({ poll, session, onClose }: Props) {
  const { mutate: addConfirmation, isPending } = useAddManualConfirmation(poll.id);
  const [tab, setTab] = useState<'guest'>('guest');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');

  const handleSubmit = () => {
    if (!guestName.trim()) return;

    addConfirmation(
      {
        sessionId: session.id,
        guest_name: guestName.trim(),
        guest_phone: guestPhone.trim() || undefined,
      },
      { onSuccess: () => onClose() }
    );
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Agregar asistencia manual</DialogTitle>
          <DialogDescription>
            Registra a un invitado en <strong>{session.title}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Nombre completo</Label>
            <Input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Ej: Carlos Mendoza"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>WhatsApp (opcional)</Label>
            <PhoneInput value={guestPhone} onChange={setGuestPhone} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !guestName.trim()}
          >
            {isPending ? 'Registrando...' : 'Registrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
