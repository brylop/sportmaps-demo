import { OfferingsManagement } from '@/components/universal/OfferingsManagement';

export default function OfferingsPage() {
    return (
        <div className="container mx-auto py-6 px-4 max-w-5xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Mis Planes</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Gestiona los planes y membresías disponibles para tus estudiantes.
                </p>
            </div>
            <OfferingsManagement />
        </div>
    );
}
