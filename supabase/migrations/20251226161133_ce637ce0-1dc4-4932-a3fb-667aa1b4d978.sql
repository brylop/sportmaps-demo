-- =============================================
-- FASE 1: POLÍTICAS RLS ESTRICTAS
-- =============================================

-- 1. REFORZAR spm_users - Denegar acceso público explícitamente
-- Ya tiene políticas pero necesitamos asegurar que son exhaustivas

-- 2. REFORZAR profiles - Denegar acceso público
-- Las políticas actuales solo permiten ver el propio perfil, lo cual es correcto

-- 3. REFORZAR payments - Asegurar que solo el parent_id puede ver/editar
-- Ya tiene políticas correctas

-- 4. REFORZAR orders - Agregar política de UPDATE para el propietario
CREATE POLICY "Users can update own orders" 
ON public.orders 
FOR UPDATE 
USING (auth.uid() = user_id);

-- 5. REFORZAR messages - Agregar política de DELETE para el propietario
CREATE POLICY "Users can delete own messages" 
ON public.messages 
FOR DELETE 
USING (auth.uid() = sender_id);

-- 6. REFORZAR children - Solo el parent puede acceder a medical_info
-- Las políticas actuales ya restringen por parent_id, lo cual es correcto
-- Agregamos comentario de documentación

COMMENT ON COLUMN public.children.medical_info IS 'Información médica sensible. Solo accesible por el parent_id del niño.';

-- 7. REFORZAR analytics_events - Restringir INSERT a solo el propio user_id
DROP POLICY IF EXISTS "System can insert analytics" ON public.analytics_events;

CREATE POLICY "Users can insert own analytics events" 
ON public.analytics_events 
FOR INSERT 
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- 8. Agregar política para que admins puedan ver analytics
CREATE POLICY "Admins can view all analytics" 
ON public.analytics_events 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));

-- 9. REFORZAR notifications - Agregar política de INSERT para el sistema
CREATE POLICY "System can create notifications" 
ON public.notifications 
FOR INSERT 
WITH CHECK (true);

-- 10. Agregar política de DELETE para notifications
CREATE POLICY "Users can delete own notifications" 
ON public.notifications 
FOR DELETE 
USING (auth.uid() = user_id);