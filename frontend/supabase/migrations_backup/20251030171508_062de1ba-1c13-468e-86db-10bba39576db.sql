-- Agregar política para permitir que usuarios no autenticados vean escuelas públicas
DO $$ BEGIN
  CREATE POLICY "Public can view non-demo schools" ON public.schools FOR SELECT TO anon USING (is_demo = false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Agregar política para permitir que usuarios no autenticados vean programas activos
DO $$ BEGIN
  CREATE POLICY "Public can view active programs" ON public.programs FOR SELECT TO anon USING (active = true AND is_demo = false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;