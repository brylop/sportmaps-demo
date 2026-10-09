/**
 * Utilidades puras de los documentos del mesociclo (bucket privado
 * 'mesocycle-documents', migración 20261008154654). Aparte del componente
 * para poder probarlas sin DOM.
 */

export const MESOCYCLE_DOCUMENTS_BUCKET = 'mesocycle-documents';

/** Igual al file_size_limit del bucket y al CHECK de la tabla. */
export const MAX_MESOCYCLE_DOCUMENT_BYTES = 10 * 1024 * 1024;

/** Extensión → MIME permitido por el bucket. */
const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

const ALLOWED_MIMES = new Set([...Object.values(MIME_BY_EXT), 'image/jpg']);

export const ACCEPT_ATTR = [
  ...Object.keys(MIME_BY_EXT).map((e) => `.${e}`),
  ...Array.from(new Set(Object.values(MIME_BY_EXT))),
].join(',');

/**
 * MIME aceptado por el bucket o null. Algunos navegadores (Windows sin Office,
 * Android) mandan `type` vacío o genérico para .docx/.xlsx: se resuelve por la
 * extensión.
 */
export function resolveMimeType(file: { name: string; type: string }): string | null {
  if (file.type && ALLOWED_MIMES.has(file.type)) return file.type === 'image/jpg' ? 'image/jpeg' : file.type;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXT[ext] ?? null;
}

/**
 * Nombre seguro para la key de Storage: sin tildes, sin espacios ni símbolos
 * (Storage rechaza algunos caracteres y el path se usa en URLs firmadas).
 * El nombre original se guarda aparte en file_name.
 */
export function safeFileName(name: string): string {
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  const cleanBase =
    base
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-.]+|[-.]+$/g, '')
      .slice(0, 80) || 'archivo';
  return ext ? `${cleanBase}.${ext}` : cleanBase;
}

/** `{school_id}/{mesocycle_id}/{ts}-{nombre seguro}` — lo exigen las policies y el CHECK de la tabla. */
export function buildMesocycleDocumentPath(schoolId: string, mesocycleId: string, fileName: string, now = Date.now()): string {
  return `${schoolId.toLowerCase()}/${mesocycleId.toLowerCase()}/${now}-${safeFileName(fileName)}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}
