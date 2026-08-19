-- ============================================================================
-- ¿Cuántas familias tienen la app INSTALADA? (READ-ONLY)
--
-- Existe para responder UNA decisión concreta que quedó pendiente el
-- 2026-08-14: si el manifest debe conservar `id: "/"` —para que las apps ya
-- instaladas se re-brandeen solas en Android— o mantener un `id` por escuela
-- —para que dos escuelas conviyan en el mismo teléfono—.
--
-- La respuesta depende de cuánta gente YA tiene la app instalada:
--   · Si son pocas, el `id` por escuela no cuesta nada y conviene.
--   · Si son muchas (Dynasty tiene 395 dispositivos), pedirles reinstalar es
--     fricción real y conviene el `id` fijo.
--
-- ── Cómo se mide ────────────────────────────────────────────────────────────
-- NO por el evento `appinstalled`: iOS nunca lo dispara y solo suena en el
-- instante de instalar, así que jamás clasificaría a los dispositivos que ya
-- existían. Se mide por el MODO DE VISUALIZACIÓN que el frontend reporta en
-- cada sesión (`display_mode`), lo cual además es retroactivo: el parque se
-- clasifica solo a medida que la gente vuelve a entrar.
--
-- ── OJO al leer esto ────────────────────────────────────────────────────────
-- `display_mode IS NULL` = dispositivo que todavía no volvió a entrar desde que
-- se desplegó el tracking (2026-08-14). NO significa "no instalado". Hasta que
-- esa columna baje a un número chico, los porcentajes están subestimados y la
-- decisión sigue siendo prematura.
-- ============================================================================

SELECT
    s.name                                                              AS escuela,
    e.has_pwa_branding                                                  AS tiene_marca,
    -- COUNT(d.id) y no COUNT(*): el LEFT JOIN produce una fila por miembro
    -- aunque no tenga dispositivo, y con COUNT(*) esos miembros se contaban
    -- como "sin reportar", inflando el numerador por encima del total.
    COUNT(d.id)                                                         AS dispositivos,
    COUNT(d.id) FILTER (WHERE d.display_mode IS NULL)                   AS sin_reportar_aun,
    COUNT(d.id) FILTER (WHERE d.display_mode = 'browser')               AS solo_navegador,
    COUNT(d.id) FILTER (WHERE d.installed_at IS NOT NULL)               AS instalados,
    COUNT(d.id) FILTER (WHERE d.install_tenant_slug IS NOT NULL)        AS instalados_con_marca,
    ROUND(
        100.0 * COUNT(d.id) FILTER (WHERE d.installed_at IS NOT NULL)
        / NULLIF(COUNT(d.id) FILTER (WHERE d.display_mode IS NOT NULL), 0)
    , 1)                                                                AS pct_instalacion
FROM public.schools s
JOIN public.v_school_entitlements e ON e.school_id = s.id
LEFT JOIN public.school_members m
       ON m.school_id = s.id
      AND m.status = 'active'
LEFT JOIN public.user_devices d
       ON d.user_id = m.profile_id
      AND d.revoked_at IS NULL
WHERE s.account_type = 'real'
GROUP BY s.id, s.name, e.has_pwa_branding
HAVING COUNT(d.id) > 0
ORDER BY COUNT(d.id) DESC
LIMIT 30;
