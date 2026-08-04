// bff/src/utils/emailLayout.ts
//
// Layout base para emails branded. Recibe contenido + branding y arma el
// HTML final con header (logo + nombre escuela), body, CTA opcional y
// footer (watermark "Powered by SportMaps" condicional).
//
// Todas las templates de emailTemplates.ts pasan por aqui — asi un cambio
// de marca / accesibilidad / dark-mode se hace en UN solo lugar.
//
// Compatible con clientes email comunes: tabla-based layout (Outlook),
// inline styles (Gmail/Apple Mail eat <style>), max-width 600px.

import type { SchoolBrandingForEmail } from './schoolBrandingResolver';
import { escapeHtml } from './schoolBrandingResolver';

interface BuildBrandedEmailParams {
    branding: SchoolBrandingForEmail;
    /** Titulo grande del email (ej. "¡Bienvenido!") */
    title: string;
    /** Saludo personalizado (ej. "Hola María,") — opcional */
    greeting?: string;
    /**
     * Bloque(s) HTML del cuerpo. El CALLER es responsable de escapar HTML
     * en valores variables. Esta funcion NO escapa el body por ti — para
     * permitir <strong>, <em>, listas. Para texto plano usa escapeHtml().
     */
    bodyHtml: string;
    /** CTA principal — opcional */
    cta?: { label: string; url: string };
    /** Subtitulo del CTA o mensaje de cierre */
    closingHtml?: string;
}

export function buildBrandedEmail(params: BuildBrandedEmailParams): string {
    const { branding, title, greeting, bodyHtml, cta, closingHtml } = params;

    // Defensive: todos los valores ya vienen sanitizados desde resolveSchoolBranding,
    // pero re-validamos hex aqui por si alguien llama buildBrandedEmail directamente.
    const primary = /^#[0-9A-Fa-f]{6}$/.test(branding.primaryColor)
        ? branding.primaryColor
        : '#248223';

    // Header: logo si lo hay, sino solo el nombre de la escuela
    const headerHtml = branding.logoUrl
        ? `
        <img
          src="${escapeHtml(branding.logoUrl)}"
          alt="${branding.schoolName}"
          style="max-height: 56px; max-width: 200px; object-fit: contain; display: block; margin: 0 auto;"
        />`
        : `
        <h2 style="color: ${primary}; font-size: 20px; font-weight: 700; margin: 0; text-align: center;">
          ${branding.schoolName}
        </h2>`;

    // CTA button
    const ctaHtml = cta
        ? `
        <div style="text-align: center; margin: 28px 0;">
          <a href="${escapeHtml(cta.url)}"
             style="background-color: ${primary}; color: #ffffff; padding: 14px 28px;
                    text-decoration: none; border-radius: 8px; display: inline-block;
                    font-weight: 600; font-size: 15px;">
            ${escapeHtml(cta.label)}
          </a>
        </div>`
        : '';

    // Footer
    const watermarkHtml = branding.showWatermark
        ? `
        <p style="color: #9ca3af; font-size: 11px; text-align: center; margin: 8px 0 0 0;">
          Powered by <a href="https://sportmaps.co" style="color: #9ca3af; text-decoration: underline;">SportMaps</a>
        </p>`
        : '';

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f3f4f6; padding: 24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="padding: 28px 24px 16px 24px; border-bottom: 3px solid ${primary};">
              ${headerHtml}
            </td>
          </tr>

          <!-- Title + Body -->
          <tr>
            <td style="padding: 28px 32px 8px 32px;">
              <h1 style="color: #111827; font-size: 22px; font-weight: 700; margin: 0 0 16px 0;">
                ${escapeHtml(title)}
              </h1>
              ${greeting ? `<p style="color: #374151; font-size: 15px; margin: 0 0 16px 0;">${escapeHtml(greeting)}</p>` : ''}
              <div style="color: #374151; font-size: 15px; line-height: 1.6;">
                ${bodyHtml}
              </div>
            </td>
          </tr>

          ${cta ? `<tr><td style="padding: 0 32px;">${ctaHtml}</td></tr>` : ''}

          ${closingHtml ? `
          <tr>
            <td style="padding: 0 32px 24px 32px;">
              <div style="color: #6b7280; font-size: 13px; line-height: 1.5;">
                ${closingHtml}
              </div>
            </td>
          </tr>` : ''}

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 32px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 12px; margin: 0; text-align: center;">
                Este correo fue enviado por <strong>${branding.schoolName}</strong> a través de SportMaps.
              </p>
              ${watermarkHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
