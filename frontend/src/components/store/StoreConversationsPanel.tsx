/**
 * StoreConversationsPanel — bandeja de conversaciones de tienda del VENDEDOR.
 *
 * Lista los hilos comprador↔vendedor de su vendor_profile y abre el chat.
 * Consume `store_conversations`/`store_messages` directo por supabase (RLS).
 * Se monta como pestaña "Conversaciones" en el Inbox del vendedor.
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useVendorProfile } from '@/hooks/useVendorProfile';
import { StoreChat } from './StoreChat';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, MessageSquare, ChevronRight } from 'lucide-react';

interface Conv {
  id: string;
  buyer_id: string;
  order_id: string | null;
  product_id: string | null;
  subject: string | null;
  last_message_at: string;
  vendor_unread: number;
}

export function StoreConversationsPanel() {
  const { data: vendor } = useVendorProfile();
  const vpId = vendor?.id;
  const [convs, setConvs] = useState<Conv[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!vpId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('store_conversations')
      .select('id, buyer_id, order_id, product_id, subject, last_message_at, vendor_unread')
      .eq('vendor_profile_id', vpId)
      .order('last_message_at', { ascending: false });
    const list = (data as Conv[]) ?? [];
    setConvs(list);
    const ids = [...new Set(list.map((c) => c.buyer_id))];
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', ids);
      setNames(Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.full_name || 'Cliente'])));
    }
    setLoading(false);
  }, [vpId]);

  useEffect(() => { load(); }, [load]);

  if (!vpId) {
    return <p className="text-sm text-muted-foreground py-10 text-center">Configura tu tienda para recibir mensajes de clientes.</p>;
  }
  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (convs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
        <MessageSquare className="h-10 w-10 opacity-30" />
        <p className="text-sm">Aún no tienes conversaciones con clientes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {convs.map((c) => (
        <Card
          key={c.id}
          className="cursor-pointer hover:border-primary/40 transition-colors"
          onClick={() => setOpenId(c.id)}
        >
          <CardContent className="p-3 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 text-primary grid place-items-center font-semibold shrink-0">
              {(names[c.buyer_id] || 'C').slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm truncate">{names[c.buyer_id] || 'Cliente'}</span>
                {c.order_id && <Badge variant="secondary" className="text-[10px]">Pedido</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(c.last_message_at).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            {c.vendor_unread > 0 && (
              <Badge variant="destructive" className="h-5 text-[10px] px-1.5">{c.vendor_unread}</Badge>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </CardContent>
        </Card>
      ))}

      <Dialog open={!!openId} onOpenChange={(v) => { if (!v) { setOpenId(null); load(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{openId ? (names[convs.find((c) => c.id === openId)?.buyer_id ?? ''] || 'Cliente') : 'Conversación'}</DialogTitle>
          </DialogHeader>
          {openId && <StoreChat conversationId={openId} viewerRole="vendor" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
