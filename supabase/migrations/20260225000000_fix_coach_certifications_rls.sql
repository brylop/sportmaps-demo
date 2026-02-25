-- Habilitar RLS en coach_certifications
ALTER TABLE "public"."coach_certifications" ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes si las hay para evitar duplicados
DROP POLICY IF EXISTS "Coaches can view their own certifications" ON "public"."coach_certifications";
DROP POLICY IF EXISTS "Coaches can insert their own certifications" ON "public"."coach_certifications";
DROP POLICY IF EXISTS "Coaches can update their own certifications" ON "public"."coach_certifications";
DROP POLICY IF EXISTS "Coaches can delete their own certifications" ON "public"."coach_certifications";

-- Política para que los coaches puedan ver sus propias certificaciones
CREATE POLICY "Coaches can view their own certifications" 
ON "public"."coach_certifications" 
FOR SELECT 
TO authenticated 
USING (auth.uid() = coach_id);

-- Política para que los coaches puedan insertar sus propias certificaciones
CREATE POLICY "Coaches can insert their own certifications" 
ON "public"."coach_certifications" 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = coach_id);

-- Política para que los coaches puedan actualizar sus propias certificaciones
CREATE POLICY "Coaches can update their own certifications" 
ON "public"."coach_certifications" 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = coach_id)
WITH CHECK (auth.uid() = coach_id);

-- Política para que los coaches puedan borrar sus propias certificaciones
CREATE POLICY "Coaches can delete their own certifications" 
ON "public"."coach_certifications" 
FOR DELETE 
TO authenticated 
USING (auth.uid() = coach_id);
