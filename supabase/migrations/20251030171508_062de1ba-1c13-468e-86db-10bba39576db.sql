-- Agregar política para permitir que usuarios no autenticados vean escuelas públicas
CREATE POLICY "Public can view non-demo schools"
ON public.schools
FOR SELECT
TO anon
USING (is_demo = false);

-- Agregar política para permitir que usuarios no autenticados vean programas activos
CREATE POLICY "Public can view active programs"
ON public.programs
FOR SELECT
TO anon
USING (active = true AND is_demo = false);