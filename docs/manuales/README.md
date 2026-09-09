# Manuales de uso

Carpeta única para todos los manuales en PDF (y su fuente `.md` cuando exista), separados por audiencia:

- **`interno/`** — para el equipo SportMaps. Incluye notas de producto, huecos conocidos, nombres de proveedores y decisiones técnicas que no van a un cliente. Portada y pie de página marcados "Uso interno — no enviar a escuelas".
- **`academias/`** — para enviar a escuelas/clientes. Mismo contenido how-to que la versión interna, sin los callouts internos ni jerga de proveedor.

Ver `feedback_pdf_manual_template` (memoria del proyecto) para el proceso técnico completo: capturas reales vía Playwright contra un ambiente desplegado (nunca mockups), sistema visual (Baloo 2 + Inter, paleta de marca), y por qué todo manual nuevo sale en las dos versiones por defecto.

Cuando un manual tiene versión interna, ambos archivos comparten el mismo nombre de base en su carpeta respectiva (ej. `catalogo-articulos-escolares.pdf` en `interno/` y en `academias/`) para que sea fácil encontrar el par.

## Manuales sueltos en la raíz

`Guia-SportMaps-Registro-Atletas-QR.pdf` y `SportMaps_Manual_de_Marca_v2.pdf` viven en la raíz de `docs/manuales/`, no en `interno/` ni `academias/`: son documentos traídos de la carpeta de documentación general del proyecto (fuera del repo) para unificar todo en un solo lugar, y no siguen el proceso de capturas Playwright ni el par interno/academias — no tienen contraparte de la otra audiencia.
