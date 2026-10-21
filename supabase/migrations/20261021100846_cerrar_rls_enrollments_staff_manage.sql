-- Cierra la policy "Staff can manage enrollments" (FOR ALL, USING is_school_admin OR
-- is_school_coach, sin WITH CHECK). Se creó a mano en el SQL editor (aparece ya en el
-- volcado CONTEXT del 2026-02-27 y no está en ninguna migración): dejaba a cualquier
-- coach crear, modificar o cancelar CUALQUIER inscripción de su escuela. Cancelar
-- anula los cobros pendientes del atleta, así que era un hueco de dinero (I2 + I3).
--
-- Reemplazo: lectura igual que hoy; escritura solo owner/admin, con WITH CHECK.
-- El BFF escribe con service_role y no se afecta. Orden de despliegue: primero el
-- frontend (Remover por BFF / oculto al coach), después esta migración.
-- Las policies "athlete cancel own" / "parent cancel child" y las trial_block_*
-- RESTRICTIVE no se tocan.

DROP POLICY IF EXISTS "Staff can manage enrollments" ON public.enrollments;

CREATE POLICY "Enrollments: staff select" ON public.enrollments
  FOR SELECT
  USING (public.is_school_admin(school_id) OR public.is_school_coach(school_id));

CREATE POLICY "Enrollments: admin insert" ON public.enrollments
  FOR INSERT TO authenticated
  WITH CHECK (school_id = ANY (public.user_admin_school_ids()));

CREATE POLICY "Enrollments: admin update" ON public.enrollments
  FOR UPDATE TO authenticated
  USING (school_id = ANY (public.user_admin_school_ids()))
  WITH CHECK (school_id = ANY (public.user_admin_school_ids()));

CREATE POLICY "Enrollments: admin delete" ON public.enrollments
  FOR DELETE TO authenticated
  USING (school_id = ANY (public.user_admin_school_ids()));

-- Sin sesión no se escribe ni se lee (las policies ya no alcanzan a anon por escritura,
-- pero el GRANT era una segunda puerta).
REVOKE ALL ON public.enrollments FROM anon;
