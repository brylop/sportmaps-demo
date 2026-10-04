import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Loader2, Package, ShoppingCart, Store, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCart, type CartItem } from '@/contexts/CartContext';
import { useCartQuote } from '@/hooks/useCartQuote';
import { groupByStore, type StoreGroup } from '@/lib/store/cart';
import { formatCurrency } from '@/lib/utils';
import { QtyStepper } from './QtyStepper';

interface Props {
  /** Se llama antes de navegar (el drawer se cierra). */
  onNavigate?: () => void;
}

/**
 * Contenido del carrito (drawer y /carrito): productos agrupados por tienda,
 * revalidados contra `quote_cart`. Un botón "Pagar" por tienda (D-2).
 */
export function CartContents({ onNavigate }: Props) {
  const { items, removeItem } = useCart();
  const navigate = useNavigate();
  const products = items.filter((i) => i.type === 'product');
  const others = items.filter((i) => i.type !== 'product');
  const groups = groupByStore(products);

  if (items.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center py-12 px-4">
        <ShoppingCart className="h-14 w-14 text-muted-foreground/50 mb-4" />
        <h3 className="font-semibold text-lg mb-1">Tu carrito está vacío</h3>
        <p className="text-muted-foreground text-sm mb-6">Entra a la tienda de tu escuela y agrega lo que necesites.</p>
        <Button onClick={() => { onNavigate?.(); navigate('/mi-tienda'); }}>Ir a la tienda</Button>
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="cart-contents">
      {groups.map((g) => (
        <StoreCartGroup key={g.vendorProfileId ?? 'sin-tienda'} group={g} onNavigate={onNavigate} />
      ))}
      {others.length > 0 && (
        <div className="rounded-xl border p-3 space-y-2">
          <p className="text-sm font-medium">Otros ítems</p>
          <p className="text-xs text-muted-foreground">
            Las inscripciones, citas y servicios se pagan desde su propia ficha, no desde este carrito.
          </p>
          {others.map((i) => (
            <div key={i.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate">{i.name}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Quitar ${i.name}`} onClick={() => removeItem(i.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StoreCartGroup({ group, onNavigate }: { group: StoreGroup<CartItem>; onNavigate?: () => void }) {
  const { updateQuantity, removeItem } = useCart();
  const navigate = useNavigate();
  const { quote, isLoading, isFetching, notices, blocked, error } = useCartQuote(group.items);
  const noticeFor = (id: string) => notices.filter((n) => n.lineId === id);
  const canPay = !!group.vendorProfileId && !!quote && !blocked && !isFetching && quote.total > 0;

  return (
    <section className="rounded-xl border bg-card" aria-label={`Productos de ${group.vendorName}`} data-testid="cart-store-group">
      <header className="flex items-center gap-2 px-3 py-2.5 border-b">
        <Store className="h-4 w-4 text-primary" />
        <span className="font-semibold text-sm truncate">{group.vendorName}</span>
        <Badge variant="outline" className="ml-auto">{group.items.reduce((s, i) => s + i.quantity, 0)} und.</Badge>
      </header>

      <ul className="divide-y">
        {group.items.map((item) => {
          const lineNotices = noticeFor(item.id);
          const soldOut = item.stock === 0;
          return (
            <li key={item.id} className="p-3 flex gap-3" data-testid="cart-line">
              <div className="h-14 w-14 rounded-lg bg-muted overflow-hidden shrink-0 grid place-items-center">
                {item.image ? <img src={item.image} alt="" className="h-full w-full object-cover" /> : <Package className="h-5 w-5 text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-snug line-clamp-2">{item.name}</p>
                    {item.metadata.variantName && <p className="text-xs text-muted-foreground">{item.metadata.variantName}</p>}
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={`Quitar ${item.name}`} onClick={() => removeItem(item.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center justify-between gap-2">
                  {soldOut ? (
                    <Badge variant="secondary">Agotado</Badge>
                  ) : (
                    <QtyStepper
                      value={item.quantity}
                      max={item.stock}
                      label={item.name}
                      onChange={(q) => updateQuantity(item.id, q)}
                    />
                  )}
                  <span className="text-sm font-semibold tabular-nums">{formatCurrency(item.price * item.quantity)}</span>
                </div>
                {lineNotices.map((n) => (
                  <p key={n.kind} className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1" role="status">
                    <AlertTriangle className="h-3.5 w-3.5 mt-px shrink-0" /> {n.message}
                  </p>
                ))}
              </div>
            </li>
          );
        })}
      </ul>

      <footer className="px-3 py-3 border-t space-y-2">
        {error ? (
          <p className="text-xs text-destructive">No pudimos revisar precios y disponibilidad. Intenta de nuevo.</p>
        ) : null}
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-lg font-bold tabular-nums" data-testid="cart-group-total">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : formatCurrency(quote?.total ?? 0)}
          </span>
        </div>
        {quote && quote.tax_total > 0 && (
          <p className="text-xs text-muted-foreground text-right">Incluye IVA {formatCurrency(quote.tax_total)}</p>
        )}
        <Button
          className="w-full"
          disabled={!canPay}
          onClick={() => { onNavigate?.(); navigate(`/checkout/tienda/${group.vendorProfileId}`); }}
        >
          {isFetching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          {blocked ? 'Revisa tu carrito para continuar' : `Pagar en ${group.vendorName}`}
        </Button>
      </footer>
    </section>
  );
}
