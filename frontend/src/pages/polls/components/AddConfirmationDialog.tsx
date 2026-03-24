import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAddManualConfirmation } from '@/hooks/usePolls';
import { AttendancePoll, PollSession } from '@/lib/api/polls.api';

interface Props {
  poll: AttendancePoll;
  session: PollSession;
  onClose: () => void;
}

interface GuestForm {
  guest_name: string;
  guest_phone: string;
}

export function AddConfirmationDialog({ poll, session, onClose }: Props) {
  const { mutate: addConfirmation, isPending } = useAddManualConfirmation(poll.id);
  const [tab, setTab] = useState<'guest'>('guest');

  const { register, handleSubmit, reset } = useForm<GuestForm>();

  const onSubmit = (data: GuestForm) => {
    addConfirmation(
      {
        sessionId:  session.id,
        guest_name: data.guest_name,
        guest_phone: data.guest_phone,
      },
      {
        onSuccess: () => {
          reset();
          onClose();
        },
      }
    );
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Agregar a {session.title}</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'guest')}>
          <TabsList className="w-full">
            <TabsTrigger value="guest" className="flex-1">Invitado</TabsTrigger>
          </TabsList>

          <TabsContent value="guest" className="mt-4">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nombre completo</Label>
                <Input
                  {...register('guest_name', { required: true })}
                  placeholder="Ej: Carlos Mendoza"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Teléfono</Label>
                <Input
                  {...register('guest_phone')}
                  placeholder="+57 300 000 0000"
                  type="tel"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? 'Guardando...' : 'Agregar'}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
