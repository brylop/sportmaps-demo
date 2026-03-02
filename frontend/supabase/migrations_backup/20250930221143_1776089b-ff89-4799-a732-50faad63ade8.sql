-- Fix security warnings by adding search_path to functions

-- Update handle_updated_at function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- Update update_school_rating function
CREATE OR REPLACE FUNCTION public.update_school_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE public.schools
  SET 
    rating = (SELECT COALESCE(AVG(rating), 0) FROM public.reviews WHERE school_id = COALESCE(NEW.school_id, OLD.school_id)),
    total_reviews = (SELECT COUNT(*) FROM public.reviews WHERE school_id = COALESCE(NEW.school_id, OLD.school_id))
  WHERE id = COALESCE(NEW.school_id, OLD.school_id);
  RETURN COALESCE(NEW, OLD);
END;
$function$;