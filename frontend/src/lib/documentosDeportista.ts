/**
 * Catálogo único de documentos del deportista que la FAMILIA puede subir.
 *
 * Son los mismos tipos que la escuela carga en `athlete_documents` (CHECK de la
 * migración 20260825125806, el formulario de afiliación de Monster Volley):
 * documento del deportista y del acudiente (frente y reverso), foto, EPS, paz y
 * salvo y las firmas del acudiente y del deportista. Ninguno es obligatorio.
 *
 * La familia sube a `identity-documents/children/{acudiente}/{hijo}/docs/` (la
 * policy de storage exige el uid del acudiente en el 2.º segmento). El tipo va
 * en el prefijo del nombre del archivo: `{tipo}-{fecha}-{nombre}`. Los prefijos
 * viejos (`identity-`, `id-`, `eps-`) se siguen reconociendo.
 */
export type TipoDocumento =
  | 'athlete_id_front'
  | 'athlete_id_back'
  | 'athlete_photo'
  | 'eps_certificate'
  | 'good_standing_certificate'
  | 'guardian_id_front'
  | 'guardian_id_back'
  | 'guardian_signature'
  | 'athlete_signature'
  | 'other';

export interface DocumentoCatalogo {
  tipo: TipoDocumento;
  label: string;
  grupo: 'deportista' | 'acudiente' | 'firmas' | 'otros';
  /** Prefijos con que se reconoce el archivo (el primero es el que se usa al subir). */
  prefijos: string[];
  /** Solo imagen (fotos y firmas); los demás aceptan también PDF. */
  soloImagen?: boolean;
}

export const DOCUMENTOS_DEPORTISTA: DocumentoCatalogo[] = [
  { tipo: 'athlete_id_front', label: 'Documento del deportista (frente)', grupo: 'deportista', prefijos: ['athlete_id_front-', 'identity-', 'id-'] },
  { tipo: 'athlete_id_back', label: 'Documento del deportista (reverso)', grupo: 'deportista', prefijos: ['athlete_id_back-'] },
  { tipo: 'athlete_photo', label: 'Foto del deportista', grupo: 'deportista', prefijos: ['athlete_photo-'], soloImagen: true },
  { tipo: 'eps_certificate', label: 'Certificado de la EPS', grupo: 'deportista', prefijos: ['eps_certificate-', 'eps-'] },
  { tipo: 'good_standing_certificate', label: 'Paz y salvo', grupo: 'deportista', prefijos: ['good_standing_certificate-'] },
  { tipo: 'guardian_id_front', label: 'Documento del acudiente (frente)', grupo: 'acudiente', prefijos: ['guardian_id_front-'] },
  { tipo: 'guardian_id_back', label: 'Documento del acudiente (reverso)', grupo: 'acudiente', prefijos: ['guardian_id_back-'] },
  { tipo: 'guardian_signature', label: 'Firma del acudiente', grupo: 'firmas', prefijos: ['guardian_signature-'], soloImagen: true },
  { tipo: 'athlete_signature', label: 'Firma del deportista', grupo: 'firmas', prefijos: ['athlete_signature-'], soloImagen: true },
  { tipo: 'other', label: 'Otro documento', grupo: 'otros', prefijos: ['other-'] },
];

export const GRUPOS_DOCUMENTOS: { id: DocumentoCatalogo['grupo']; titulo: string }[] = [
  { id: 'deportista', titulo: 'Del deportista' },
  { id: 'acudiente', titulo: 'Del acudiente' },
  { id: 'firmas', titulo: 'Firmas' },
  { id: 'otros', titulo: 'Otros' },
];

/** Tipo de un archivo por su nombre; null si no corresponde a ninguno. */
export function tipoDeArchivo(nombre: string): TipoDocumento | null {
  for (const d of DOCUMENTOS_DEPORTISTA) {
    if (d.prefijos.some((p) => nombre.startsWith(p))) return d.tipo;
  }
  return null;
}

/** Valida tamaño y formato antes de subir. Devuelve el mensaje de error o null. */
export function validarArchivo(file: { name: string; size: number }, doc: DocumentoCatalogo): string | null {
  if (file.size > 10 * 1024 * 1024) return 'El archivo pesa más de 10 MB.';
  const ok = doc.soloImagen ? /\.(jpe?g|png|webp|heic)$/i : /\.(pdf|jpe?g|png|webp|heic)$/i;
  if (!ok.test(file.name)) return doc.soloImagen ? 'Sube una foto (JPG o PNG).' : 'Sube un PDF o una foto (JPG o PNG).';
  return null;
}
