/** Celular de la escuela → enlace de WhatsApp. Sin indicativo se asume Colombia (57). */
export function whatsappDeLaEscuela(phone: string | null | undefined): string | null {
  const digitos = (phone ?? '').replace(/\D/g, '');
  if (digitos.length === 10 && digitos.startsWith('3')) return `https://wa.me/57${digitos}`;
  if (digitos.length >= 11) return `https://wa.me/${digitos}`;
  return null;
}
