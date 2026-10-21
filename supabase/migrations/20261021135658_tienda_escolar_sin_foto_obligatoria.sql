-- La tienda de una escuela (vendor_profiles.school_id) puede publicar productos sin foto:
-- la vitrina pública ya dibuja las iniciales como fallback. El resto de vendedores
-- del marketplace conserva la regla de al menos una imagen.
-- Solo cambia el chequeo `no_image`; todo lo demás queda idéntico.

CREATE OR REPLACE FUNCTION public.validate_product_quality_row(p products)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
    v_issues      jsonb := '[]'::jsonb;
    v_image_count integer := 0;
BEGIN
    IF p.name IS NULL OR length(trim(p.name)) < 5 THEN
        v_issues := v_issues || jsonb_build_object('code', 'name_too_short', 'message', 'Nombre debe tener al menos 5 caracteres.');
    END IF;
    IF p.description IS NULL OR length(trim(p.description)) < 30 THEN
        v_issues := v_issues || jsonb_build_object('code', 'description_too_short', 'message', 'Descripcion debe tener al menos 30 caracteres.');
    END IF;
    IF p.price IS NULL OR p.price <= 0 THEN
        v_issues := v_issues || jsonb_build_object('code', 'price_invalid', 'message', 'Precio debe ser mayor a 0.');
    END IF;
    IF p.category_id IS NULL THEN
        v_issues := v_issues || jsonb_build_object('code', 'category_required', 'message', 'Categoria es requerida.');
    END IF;

    IF to_regclass('public.product_media') IS NOT NULL AND p.id IS NOT NULL THEN
        EXECUTE $q$ SELECT count(*) FROM public.product_media WHERE product_id = $1 AND type IN ('image', 'image_360') $q$
           INTO v_image_count USING p.id;
    END IF;
    IF v_image_count = 0 AND (p.image_url IS NULL OR length(p.image_url) = 0)
       AND NOT EXISTS (
            SELECT 1 FROM public.vendor_profiles vp
             WHERE vp.id = p.vendor_profile_id AND vp.school_id IS NOT NULL
       ) THEN
        v_issues := v_issues || jsonb_build_object('code', 'no_image', 'message', 'Al menos una imagen es requerida.');
    END IF;

    IF p.vendor_profile_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.vendor_profiles vp
         WHERE vp.id = p.vendor_profile_id AND vp.verification_status::text <> 'verified'
    ) THEN
        v_issues := v_issues || jsonb_build_object('code', 'vendor_unverified', 'message', 'Vendor no verificado — producto requerira revision admin.', 'severity', 'warning');
    END IF;

    RETURN v_issues;
END;
$function$;
