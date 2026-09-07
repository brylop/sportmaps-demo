import { useSchoolContext } from '@/hooks/useSchoolContext';
import { InvoicingTab } from '@/components/accounting/InvoicingTab';
import { FileText } from 'lucide-react';

/**
 * Facturación electrónica standalone — misma pestaña que vive dentro de
 * Contabilidad (`AccountingPage.tsx`), pero accesible sin el addon
 * 'accounting'. El gate real (addon 'invoicing' + override de módulo) lo
 * resuelve `ModuleGate` en App.tsx; acá solo falta el caso sin escuela activa.
 */
export default function InvoicingStandalonePage() {
    const { schoolId } = useSchoolContext();

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                    <FileText className="h-7 w-7 text-primary" /> Facturación electrónica
                </h1>
                <p className="text-muted-foreground">Emisión de factura electrónica DIAN sobre tus cobros</p>
            </div>

            {schoolId
                ? <InvoicingTab ownerType="school" ownerId={schoolId} />
                : <p className="text-sm text-muted-foreground">Selecciona una escuela para configurar la facturación.</p>}
        </div>
    );
}
