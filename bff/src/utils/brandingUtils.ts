/**
 * Normaliza los nombres de las escuelas para el entorno de demo.
 * Reemplaza nombres de legado (Spirit, NPC, Original Boxing, etc.)
 * con "Escuela Demo" para mantener una marca consistente en emails y comunicaciones.
 */
export function normalizeSchoolName(name: string): string {
  if (!name) return 'Escuela Demo';
  
  const legacyNames = ["ORIGINAL BOXING STYLE", "Spirit All Stars", "NPC", "Academia Demo", "Spirit"];
  
  const shouldReplace = legacyNames.some(legacy => 
    name.toUpperCase().includes(legacy.toUpperCase())
  );
  
  if (shouldReplace) {
    return "Escuela Demo";
  }
  
  return name;
}
