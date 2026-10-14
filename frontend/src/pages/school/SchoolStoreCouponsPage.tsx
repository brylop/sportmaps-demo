/**
 * Tu tienda → Cupones (/tienda-escuela/cupones) — tienda v2 F3b.
 *
 * Códigos de descuento de la tienda de la ESCUELA ACTIVA (useSchoolStore, por
 * school_id: bug N0). Los maneja el dueño o un administrador; la base vuelve a
 * decidir (can_manage_store_as en el BFF). El descuento lo asume la escuela.
 */
import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Tag } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useSchoolStore } from '@/hooks/useSchoolStore';
import { useStoreEnabled } from '@/hooks/useStoreEnabled';
import { StoreCouponsManager } from '@/components/store/StoreCouponsManager';

export default function SchoolStoreCouponsPage() {
    const { enabled: storeEnabled, isLoading: flagLoading } = useStoreEnabled();
    const { store, isSchoolAdmin, isOpen, isLoading } = useSchoolStore();

    if (flagLoading || isLoading) return <Shell><Skeleton className="h-40 w-full" /></Shell>;
    if (!storeEnabled) {
        return <Shell><Note>La tienda todavía no está disponible en SportMaps.</Note></Shell>;
    }
    if (!isSchoolAdmin) {
        return <Shell><Note>Los cupones de la tienda los maneja el dueño o un administrador de la escuela.</Note></Shell>;
    }
    if (!store || !isOpen) {
        return (
            <Shell>
                <Note>
                    Primero activa la tienda de la escuela en <Link className="underline" to="/tienda-escuela/ajustes">Cobros y entrega</Link>.
                </Note>
            </Shell>
        );
    }
    return (
        <Shell name={store.display_name}>
            <StoreCouponsManager vendorProfileId={store.id} />
        </Shell>
    );
}

function Note({ children }: { children: ReactNode }) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">{children}</CardContent></Card>;
}

function Shell({ children, name }: { children: ReactNode; name?: string | null }) {
    return (
        <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6">
            <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Tag className="h-5 w-5" />
                </div>
                <div>
                    <p className="text-xs text-muted-foreground">Tu tienda{name ? ` · ${name}` : ''}</p>
                    <h1 className="text-2xl font-bold">Cupones de descuento</h1>
                </div>
            </div>
            {children}
        </div>
    );
}
