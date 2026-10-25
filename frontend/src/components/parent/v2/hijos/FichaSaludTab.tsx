import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { IdCard, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DocumentosHijo } from './DocumentosHijo';
import { allergiesLabel, emergencyContactLabel, maskDocument, type Hijo } from './hijosUtils';
import { Row, Section } from './parts';

interface Props {
  hijo: Hijo;
  onEdit: () => void;
  /** Ya no se usa: cada documento se sube desde su fila (DocumentosHijo). */
  onUploadDocs?: () => void;
  /** Bloque extra al final (p. ej. la pausa por vacaciones). */
  extra?: ReactNode;
}

const FALTA = <span className="text-muted-foreground">Sin dato</span>;

export function FichaSaludTab({ hijo, onEdit, extra }: Props) {

  const datos: { label: string; value: ReactNode }[] = [
    { label: 'Documento', value: maskDocument(hijo.doc_type, hijo.doc_number) ?? FALTA },
    { label: 'EPS', value: hijo.eps_name?.trim() || FALTA },
    { label: 'Tipo de sangre', value: hijo.blood_type?.trim() || FALTA },
    { label: 'Alergias', value: allergiesLabel(hijo.medical_info) },
    { label: 'Contacto de emergencia', value: emergencyContactLabel(hijo.emergency_contact) ?? FALTA },
  ];


  return (
    <div className="space-y-4">
      <Section title="Datos">
        <dl className="mt-1">
          {datos.map((d) => (
            <Row key={d.label} className="justify-between">
              <dt className="shrink-0 text-sm text-muted-foreground">{d.label}</dt>
              <dd className="min-w-0 truncate text-right text-sm font-medium">{d.value}</dd>
            </Row>
          ))}
        </dl>
      </Section>

      <DocumentosHijo childId={hijo.id} idDocumentUrl={hijo.id_document_url} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Button asChild className="min-h-touch">
          <Link to="/my-cards">
            <IdCard className="mr-2 h-4 w-4" aria-hidden="true" />
            Mostrar carnet
          </Link>
        </Button>
        <Button variant="outline" className="min-h-touch" onClick={onEdit}>
          <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
          Corregir un dato
        </Button>
      </div>

      {extra}
    </div>
  );
}
