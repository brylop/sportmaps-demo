CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  role_text text;
  v_role user_role;
BEGIN
  role_text := NEW.raw_user_meta_data->>'role';

  IF role_text = ANY (ARRAY['athlete','parent','coach','school','wellness_professional','store_owner','admin']) THEN
    v_role := role_text::user_role;
  ELSE
    v_role := 'athlete'::user_role;
  END IF;

  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuario'),
    v_role
  );
  RETURN NEW;
END;
$$;