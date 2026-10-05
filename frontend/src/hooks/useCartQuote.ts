import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCart, type CartItem } from '@/contexts/CartContext';
import { quoteCart, type QuoteInput } from '@/lib/api/storeApi';
import { applyQuote, cartChanged, toQuoteItems, type CartNotice, type CartQuote } from '@/lib/store/cart';
import type { Fulfillment } from '@/lib/store/orderStatus';

/**
 * Revalida un grupo del carrito contra `quote_cart` (precio vigente,
 * disponible, ítems inactivos) y deja el carrito con lo que dijo el servidor.
 * El total que se muestra sale de la cotización, no de sumar en el cliente.
 */
export function useCartQuote(
  groupItems: CartItem[],
  opts: { fulfillment?: Fulfillment; address?: QuoteInput['address']; enabled?: boolean } = {},
) {
  const { items: allItems, replaceItems } = useCart();
  const fulfillment = opts.fulfillment ?? 'pickup';
  const quoteItems = useMemo(() => toQuoteItems(groupItems), [groupItems]);
  const addressKey = fulfillment === 'shipping' ? (opts.address?.departamento ?? '') : '';

  const query = useQuery<CartQuote>({
    queryKey: ['store', 'quote', quoteItems, fulfillment, addressKey],
    queryFn: () => quoteCart({ items: quoteItems, fulfillment, address: opts.address ?? null }),
    enabled: (opts.enabled ?? true) && quoteItems.length > 0,
    staleTime: 15_000,
    retry: false,
  });

  const applied = useMemo(
    () => (query.data ? applyQuote(groupItems, query.data) : { items: groupItems, notices: [] as CartNotice[], blocked: false }),
    [query.data, groupItems],
  );

  // Guardar en el carrito lo corregido (precio, disponible, cantidad ajustada).
  useEffect(() => {
    if (!query.data) return;
    if (!cartChanged(groupItems, applied.items)) return;
    const byId = new Map(applied.items.map((i) => [i.id, i]));
    replaceItems(allItems.map((i) => byId.get(i.id) ?? i));
    // allItems a propósito fuera: solo se reacciona a una cotización nueva.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied, query.data]);

  const lineErrors = query.data?.lines.filter((l) => l.error) ?? [];
  return {
    quote: query.data,
    isLoading: query.isLoading && quoteItems.length > 0,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    notices: applied.notices,
    blocked: applied.blocked || lineErrors.some((l) => l.error !== 'INSUFFICIENT_STOCK'),
    storeOpen: query.data ? query.data.store_enabled !== false : true,
  };
}
