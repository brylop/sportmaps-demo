-- ============================================================
-- SPORTMAPS MARKETPLACE — R3 Reviews + Q&A
-- Trust layer: reviews con contexto deportivo, fotos en reviews,
-- votos helpful/unhelpful, Q&A producto, reviews de vendor.
--
-- Diferenciador: campos sport_used_for / level / usage_duration /
-- fit_feedback que dan contexto deportivo a cada review.
--
-- Verified purchase: solo quienes tienen una order delivered del
-- producto pueden dejar review (validado por RLS + check).
--
-- Defensivo: skip secciones que requieran products/orders/vendor_profiles
-- si no existen.
-- ============================================================


-- ============================================================
-- 1. Tabla product_reviews
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'products'
    ) THEN
        RAISE NOTICE 'Skip product_reviews: tabla products no existe.';
        RETURN;
    END IF;

    EXECUTE $sql$
        CREATE TABLE IF NOT EXISTS public.product_reviews (
            id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
            product_id            uuid        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
            variant_id            uuid        REFERENCES public.product_variants(id) ON DELETE SET NULL,
            order_id              uuid        REFERENCES public.orders(id) ON DELETE SET NULL,
            user_id               uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

            rating                integer     NOT NULL CHECK (rating BETWEEN 1 AND 5),
            title                 text,
            body                  text        NOT NULL CHECK (length(trim(body)) >= 20),

            -- CONTEXTO DEPORTIVO — el moat de las reviews
            sport_used_for        text,
            level                 text        CHECK (level IS NULL OR level IN ('principiante','intermedio','avanzado','profesional')),
            usage_duration        text        CHECK (usage_duration IS NULL OR usage_duration IN ('una_vez','1_semana','1_mes','3_meses','6_meses','1_anio','mas_de_1_anio')),
            fit_feedback          text        CHECK (fit_feedback IS NULL OR fit_feedback IN ('muy_pequeno','pequeno','justo','grande','muy_grande','no_aplica')),
            recommended           boolean,

            helpful_count         integer     NOT NULL DEFAULT 0,
            unhelpful_count       integer     NOT NULL DEFAULT 0,

            vendor_response       text,
            vendor_responded_at   timestamptz,
            vendor_responded_by   uuid        REFERENCES auth.users(id),

            status                text        NOT NULL DEFAULT 'published'
                                              CHECK (status IN ('pending','published','flagged','hidden','removed')),
            is_verified_purchase  boolean     NOT NULL DEFAULT false,
            flags_count           integer     NOT NULL DEFAULT 0,

            created_at            timestamptz NOT NULL DEFAULT now(),
            updated_at            timestamptz NOT NULL DEFAULT now(),

            -- 1 review por user por producto
            CONSTRAINT product_reviews_user_product_unique UNIQUE (product_id, user_id)
        );
    $sql$;

    EXECUTE $sql$ CREATE INDEX IF NOT EXISTS idx_product_reviews_product   ON public.product_reviews(product_id) $sql$;
    EXECUTE $sql$ CREATE INDEX IF NOT EXISTS idx_product_reviews_user      ON public.product_reviews(user_id) $sql$;
    EXECUTE $sql$ CREATE INDEX IF NOT EXISTS idx_product_reviews_rating    ON public.product_reviews(product_id, rating DESC, created_at DESC) WHERE status = 'published' $sql$;
    EXECUTE $sql$ CREATE INDEX IF NOT EXISTS idx_product_reviews_status    ON public.product_reviews(status) $sql$;
    EXECUTE $sql$ CREATE INDEX IF NOT EXISTS idx_product_reviews_verified  ON public.product_reviews(product_id) WHERE is_verified_purchase = true AND status = 'published' $sql$;
    EXECUTE $sql$ CREATE INDEX IF NOT EXISTS idx_product_reviews_sport     ON public.product_reviews(sport_used_for) WHERE sport_used_for IS NOT NULL $sql$;

    -- Trigger updated_at
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'set_updated_at') THEN
        EXECUTE $tr$ DROP TRIGGER IF EXISTS trg_product_reviews_updated_at ON public.product_reviews $tr$;
        EXECUTE $tr$
            CREATE TRIGGER trg_product_reviews_updated_at
            BEFORE UPDATE ON public.product_reviews
            FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()
        $tr$;
    END IF;
END $$;


-- ============================================================
-- 2. Tabla product_review_media (fotos / videos en reviews)
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'product_reviews'
    ) THEN
        RAISE NOTICE 'Skip product_review_media: product_reviews no existe.';
        RETURN;
    END IF;

    EXECUTE $sql$
        CREATE TABLE IF NOT EXISTS public.product_review_media (
            id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
            review_id   uuid        NOT NULL REFERENCES public.product_reviews(id) ON DELETE CASCADE,
            type        text        NOT NULL CHECK (type IN ('image','video')),
            url         text        NOT NULL,
            thumbnail_url text,
            sort_order  integer     NOT NULL DEFAULT 0,
            created_at  timestamptz NOT NULL DEFAULT now()
        );
    $sql$;
    EXECUTE $sql$ CREATE INDEX IF NOT EXISTS idx_review_media_review ON public.product_review_media(review_id, sort_order) $sql$;
END $$;


-- ============================================================
-- 3. Tabla product_review_votes (helpful / unhelpful)
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'product_reviews'
    ) THEN
        RETURN;
    END IF;

    EXECUTE $sql$
        CREATE TABLE IF NOT EXISTS public.product_review_votes (
            review_id   uuid        NOT NULL REFERENCES public.product_reviews(id) ON DELETE CASCADE,
            user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            vote        text        NOT NULL CHECK (vote IN ('helpful','unhelpful')),
            created_at  timestamptz NOT NULL DEFAULT now(),
            PRIMARY KEY (review_id, user_id)
        );
    $sql$;
    EXECUTE $sql$ CREATE INDEX IF NOT EXISTS idx_review_votes_user ON public.product_review_votes(user_id) $sql$;
END $$;


-- ============================================================
-- 4. Tabla product_questions (Q&A)
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'products'
    ) THEN
        RETURN;
    END IF;

    EXECUTE $sql$
        CREATE TABLE IF NOT EXISTS public.product_questions (
            id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
            product_id          uuid        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
            user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            question            text        NOT NULL CHECK (length(trim(question)) >= 5),
            vendor_answer       text,
            vendor_answered_at  timestamptz,
            vendor_answered_by  uuid        REFERENCES auth.users(id),
            helpful_count       integer     NOT NULL DEFAULT 0,
            status              text        NOT NULL DEFAULT 'published'
                                            CHECK (status IN ('pending','published','hidden','removed')),
            created_at          timestamptz NOT NULL DEFAULT now(),
            updated_at          timestamptz NOT NULL DEFAULT now()
        );
    $sql$;

    EXECUTE $sql$ CREATE INDEX IF NOT EXISTS idx_product_questions_product ON public.product_questions(product_id, created_at DESC) WHERE status = 'published' $sql$;
    EXECUTE $sql$ CREATE INDEX IF NOT EXISTS idx_product_questions_pending_answer ON public.product_questions(product_id) WHERE vendor_answered_at IS NULL AND status = 'published' $sql$;

    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'set_updated_at') THEN
        EXECUTE $tr$ DROP TRIGGER IF EXISTS trg_product_questions_updated_at ON public.product_questions $tr$;
        EXECUTE $tr$
            CREATE TRIGGER trg_product_questions_updated_at
            BEFORE UPDATE ON public.product_questions
            FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()
        $tr$;
    END IF;
END $$;


-- ============================================================
-- 5. Tabla vendor_reviews (reputación del vendedor)
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'vendor_profiles'
    ) THEN
        RAISE NOTICE 'Skip vendor_reviews: vendor_profiles no existe.';
        RETURN;
    END IF;

    EXECUTE $sql$
        CREATE TABLE IF NOT EXISTS public.vendor_reviews (
            id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_profile_id   uuid        NOT NULL REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,
            order_id            uuid        REFERENCES public.orders(id) ON DELETE SET NULL,
            user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

            rating              integer     NOT NULL CHECK (rating BETWEEN 1 AND 5),
            shipping_rating     integer     CHECK (shipping_rating IS NULL OR shipping_rating BETWEEN 1 AND 5),
            service_rating      integer     CHECK (service_rating IS NULL OR service_rating BETWEEN 1 AND 5),
            body                text,

            is_verified         boolean     NOT NULL DEFAULT false,
            status              text        NOT NULL DEFAULT 'published'
                                            CHECK (status IN ('published','flagged','hidden','removed')),

            created_at          timestamptz NOT NULL DEFAULT now(),
            updated_at          timestamptz NOT NULL DEFAULT now(),

            CONSTRAINT vendor_reviews_user_order_unique UNIQUE (vendor_profile_id, order_id, user_id)
        );
    $sql$;

    EXECUTE $sql$ CREATE INDEX IF NOT EXISTS idx_vendor_reviews_vendor ON public.vendor_reviews(vendor_profile_id, created_at DESC) WHERE status = 'published' $sql$;
    EXECUTE $sql$ CREATE INDEX IF NOT EXISTS idx_vendor_reviews_user   ON public.vendor_reviews(user_id) $sql$;
END $$;


-- ============================================================
-- 6. Agregados materializados en products + vendor_profiles
-- ============================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'products'
    ) THEN
        EXECUTE $sql$
            ALTER TABLE public.products
                ADD COLUMN IF NOT EXISTS avg_rating numeric(2,1),
                ADD COLUMN IF NOT EXISTS reviews_count integer NOT NULL DEFAULT 0;
        $sql$;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'vendor_profiles'
    ) THEN
        EXECUTE $sql$
            ALTER TABLE public.vendor_profiles
                ADD COLUMN IF NOT EXISTS avg_rating numeric(2,1),
                ADD COLUMN IF NOT EXISTS reviews_count integer NOT NULL DEFAULT 0,
                ADD COLUMN IF NOT EXISTS response_rate numeric(3,2),
                ADD COLUMN IF NOT EXISTS avg_response_hours numeric(8,1);
        $sql$;
    END IF;
END $$;


-- ============================================================
-- 7. Funcion: recalcular agregados de product
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'product_reviews'
    ) THEN
        RETURN;
    END IF;

    EXECUTE $func$
        CREATE OR REPLACE FUNCTION public.recalc_product_review_aggregates(p_product_id uuid)
        RETURNS void
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public
        AS $body$
        BEGIN
            UPDATE public.products
            SET avg_rating    = sub.avg_rating,
                reviews_count = sub.cnt
            FROM (
                SELECT
                    ROUND(AVG(rating)::numeric, 1)        AS avg_rating,
                    COUNT(*)::integer                    AS cnt
                FROM public.product_reviews
                WHERE product_id = p_product_id
                  AND status     = 'published'
            ) sub
            WHERE id = p_product_id;
        END;
        $body$;
    $func$;

    EXECUTE $func$
        CREATE OR REPLACE FUNCTION public.trg_recalc_product_review_aggregates()
        RETURNS trigger
        LANGUAGE plpgsql
        SET search_path = pg_catalog, public, pg_temp
        AS $body$
        BEGIN
            IF TG_OP = 'DELETE' THEN
                PERFORM public.recalc_product_review_aggregates(OLD.product_id);
                RETURN OLD;
            ELSE
                PERFORM public.recalc_product_review_aggregates(NEW.product_id);
                RETURN NEW;
            END IF;
        END;
        $body$;
    $func$;

    EXECUTE $tr$ DROP TRIGGER IF EXISTS trg_aggregate_product_reviews ON public.product_reviews $tr$;
    EXECUTE $tr$
        CREATE TRIGGER trg_aggregate_product_reviews
            AFTER INSERT OR UPDATE OF rating, status OR DELETE ON public.product_reviews
            FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_product_review_aggregates();
    $tr$;
END $$;


-- ============================================================
-- 8. Funcion: recalcular agregados de vendor_profile
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'vendor_reviews'
    ) THEN
        RETURN;
    END IF;

    EXECUTE $func$
        CREATE OR REPLACE FUNCTION public.recalc_vendor_review_aggregates(p_vendor_profile_id uuid)
        RETURNS void
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public
        AS $body$
        BEGIN
            UPDATE public.vendor_profiles
            SET avg_rating    = sub.avg_rating,
                reviews_count = sub.cnt
            FROM (
                SELECT
                    ROUND(AVG(rating)::numeric, 1)  AS avg_rating,
                    COUNT(*)::integer               AS cnt
                FROM public.vendor_reviews
                WHERE vendor_profile_id = p_vendor_profile_id
                  AND status            = 'published'
            ) sub
            WHERE id = p_vendor_profile_id;
        END;
        $body$;
    $func$;

    EXECUTE $func$
        CREATE OR REPLACE FUNCTION public.trg_recalc_vendor_review_aggregates()
        RETURNS trigger
        LANGUAGE plpgsql
        SET search_path = pg_catalog, public, pg_temp
        AS $body$
        BEGIN
            IF TG_OP = 'DELETE' THEN
                PERFORM public.recalc_vendor_review_aggregates(OLD.vendor_profile_id);
                RETURN OLD;
            ELSE
                PERFORM public.recalc_vendor_review_aggregates(NEW.vendor_profile_id);
                RETURN NEW;
            END IF;
        END;
        $body$;
    $func$;

    EXECUTE $tr$ DROP TRIGGER IF EXISTS trg_aggregate_vendor_reviews ON public.vendor_reviews $tr$;
    EXECUTE $tr$
        CREATE TRIGGER trg_aggregate_vendor_reviews
            AFTER INSERT OR UPDATE OF rating, status OR DELETE ON public.vendor_reviews
            FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_vendor_review_aggregates();
    $tr$;
END $$;


-- ============================================================
-- 9. Trigger: recalcular helpful/unhelpful counts en review
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'product_review_votes'
    ) THEN
        RETURN;
    END IF;

    EXECUTE $func$
        CREATE OR REPLACE FUNCTION public.trg_recalc_review_votes()
        RETURNS trigger
        LANGUAGE plpgsql
        SET search_path = pg_catalog, public, pg_temp
        AS $body$
        DECLARE
            v_review_id uuid;
        BEGIN
            v_review_id := COALESCE(NEW.review_id, OLD.review_id);
            UPDATE public.product_reviews
            SET helpful_count   = (SELECT COUNT(*) FROM public.product_review_votes WHERE review_id = v_review_id AND vote = 'helpful'),
                unhelpful_count = (SELECT COUNT(*) FROM public.product_review_votes WHERE review_id = v_review_id AND vote = 'unhelpful')
            WHERE id = v_review_id;
            RETURN COALESCE(NEW, OLD);
        END;
        $body$;
    $func$;

    EXECUTE $tr$ DROP TRIGGER IF EXISTS trg_recalc_votes ON public.product_review_votes $tr$;
    EXECUTE $tr$
        CREATE TRIGGER trg_recalc_votes
            AFTER INSERT OR UPDATE OR DELETE ON public.product_review_votes
            FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_review_votes();
    $tr$;
END $$;


-- ============================================================
-- 10. Trigger: validar verified purchase al crear review
--     Marca is_verified_purchase = true si existe una order
--     delivered del producto para este user.
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'product_reviews'
    ) OR NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'order_items'
    ) THEN
        RETURN;
    END IF;

    EXECUTE $func$
        CREATE OR REPLACE FUNCTION public.set_review_verified_purchase()
        RETURNS trigger
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public
        AS $body$
        BEGIN
            IF NEW.is_verified_purchase IS TRUE THEN
                RETURN NEW;
            END IF;

            IF EXISTS (
                SELECT 1
                FROM public.orders o
                JOIN public.order_items oi ON oi.order_id = o.id
                WHERE oi.product_id = NEW.product_id
                  AND o.user_id     = NEW.user_id
                  AND o.status      = 'delivered'
            ) THEN
                NEW.is_verified_purchase := true;
                IF NEW.order_id IS NULL THEN
                    SELECT o.id INTO NEW.order_id
                    FROM public.orders o
                    JOIN public.order_items oi ON oi.order_id = o.id
                    WHERE oi.product_id = NEW.product_id
                      AND o.user_id     = NEW.user_id
                      AND o.status      = 'delivered'
                    ORDER BY o.created_at DESC
                    LIMIT 1;
                END IF;
            END IF;

            RETURN NEW;
        END;
        $body$;
    $func$;

    EXECUTE $tr$ DROP TRIGGER IF EXISTS trg_set_review_verified_purchase ON public.product_reviews $tr$;
    EXECUTE $tr$
        CREATE TRIGGER trg_set_review_verified_purchase
            BEFORE INSERT ON public.product_reviews
            FOR EACH ROW EXECUTE FUNCTION public.set_review_verified_purchase();
    $tr$;
END $$;


-- ============================================================
-- 11. RLS policies
-- ============================================================

DO $$
BEGIN
    -- product_reviews
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='product_reviews') THEN
        EXECUTE $sql$ ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY $sql$;

        EXECUTE $sql$ DROP POLICY IF EXISTS "Reviews publicadas son visibles para todos" ON public.product_reviews $sql$;
        EXECUTE $sql$
            CREATE POLICY "Reviews publicadas son visibles para todos"
                ON public.product_reviews FOR SELECT
                USING (status = 'published')
        $sql$;

        EXECUTE $sql$ DROP POLICY IF EXISTS "Autor ve sus reviews (cualquier status)" ON public.product_reviews $sql$;
        EXECUTE $sql$
            CREATE POLICY "Autor ve sus reviews (cualquier status)"
                ON public.product_reviews FOR SELECT
                USING (user_id = auth.uid())
        $sql$;

        -- Crear review: solo si verified purchase O admin
        EXECUTE $sql$ DROP POLICY IF EXISTS "Solo verified purchasers crean reviews" ON public.product_reviews $sql$;
        EXECUTE $sql$
            CREATE POLICY "Solo verified purchasers crean reviews"
                ON public.product_reviews FOR INSERT
                WITH CHECK (
                    user_id = auth.uid()
                    AND (
                        EXISTS (
                            SELECT 1 FROM public.orders o
                            JOIN public.order_items oi ON oi.order_id = o.id
                            WHERE oi.product_id = product_reviews.product_id
                              AND o.user_id     = auth.uid()
                              AND o.status      = 'delivered'
                        )
                        OR EXISTS (
                            SELECT 1 FROM public.profiles p
                            WHERE p.id = auth.uid() AND p.role::text IN ('admin','super_admin')
                        )
                    )
                )
        $sql$;

        EXECUTE $sql$ DROP POLICY IF EXISTS "Autor edita su review en 24h" ON public.product_reviews $sql$;
        EXECUTE $sql$
            CREATE POLICY "Autor edita su review en 24h"
                ON public.product_reviews FOR UPDATE
                USING (user_id = auth.uid() AND created_at > now() - interval '24 hours')
                WITH CHECK (user_id = auth.uid())
        $sql$;

        -- Vendor puede actualizar SOLO vendor_response (controlado por la api)
        EXECUTE $sql$ DROP POLICY IF EXISTS "Vendor responde a sus reviews" ON public.product_reviews $sql$;
        EXECUTE $sql$
            CREATE POLICY "Vendor responde a sus reviews"
                ON public.product_reviews FOR UPDATE
                USING (
                    EXISTS (
                        SELECT 1 FROM public.products p
                        WHERE p.id = product_reviews.product_id
                          AND p.vendor_id = auth.uid()
                    )
                )
        $sql$;

        EXECUTE $sql$ DROP POLICY IF EXISTS "Admin modera reviews" ON public.product_reviews $sql$;
        EXECUTE $sql$
            CREATE POLICY "Admin modera reviews"
                ON public.product_reviews FOR ALL
                USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role::text IN ('admin','super_admin')))
        $sql$;
    END IF;

    -- product_review_votes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='product_review_votes') THEN
        EXECUTE $sql$ ALTER TABLE public.product_review_votes ENABLE ROW LEVEL SECURITY $sql$;

        EXECUTE $sql$ DROP POLICY IF EXISTS "Votos visibles para todos los autenticados" ON public.product_review_votes $sql$;
        EXECUTE $sql$
            CREATE POLICY "Votos visibles para todos los autenticados"
                ON public.product_review_votes FOR SELECT
                USING (auth.role() = 'authenticated')
        $sql$;

        EXECUTE $sql$ DROP POLICY IF EXISTS "Usuario crea/cambia su voto" ON public.product_review_votes $sql$;
        EXECUTE $sql$
            CREATE POLICY "Usuario crea/cambia su voto"
                ON public.product_review_votes FOR ALL
                USING (user_id = auth.uid())
                WITH CHECK (user_id = auth.uid())
        $sql$;
    END IF;

    -- product_review_media
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='product_review_media') THEN
        EXECUTE $sql$ ALTER TABLE public.product_review_media ENABLE ROW LEVEL SECURITY $sql$;
        EXECUTE $sql$ DROP POLICY IF EXISTS "Media de review publica" ON public.product_review_media $sql$;
        EXECUTE $sql$
            CREATE POLICY "Media de review publica"
                ON public.product_review_media FOR SELECT
                USING (
                    EXISTS (
                        SELECT 1 FROM public.product_reviews r
                        WHERE r.id = product_review_media.review_id AND r.status = 'published'
                    )
                )
        $sql$;
        EXECUTE $sql$ DROP POLICY IF EXISTS "Autor maneja media de su review" ON public.product_review_media $sql$;
        EXECUTE $sql$
            CREATE POLICY "Autor maneja media de su review"
                ON public.product_review_media FOR ALL
                USING (EXISTS (SELECT 1 FROM public.product_reviews r WHERE r.id = product_review_media.review_id AND r.user_id = auth.uid()))
                WITH CHECK (EXISTS (SELECT 1 FROM public.product_reviews r WHERE r.id = product_review_media.review_id AND r.user_id = auth.uid()))
        $sql$;
    END IF;

    -- product_questions
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='product_questions') THEN
        EXECUTE $sql$ ALTER TABLE public.product_questions ENABLE ROW LEVEL SECURITY $sql$;

        EXECUTE $sql$ DROP POLICY IF EXISTS "Preguntas publicadas visibles" ON public.product_questions $sql$;
        EXECUTE $sql$
            CREATE POLICY "Preguntas publicadas visibles"
                ON public.product_questions FOR SELECT
                USING (status = 'published')
        $sql$;

        EXECUTE $sql$ DROP POLICY IF EXISTS "Usuario crea pregunta" ON public.product_questions $sql$;
        EXECUTE $sql$
            CREATE POLICY "Usuario crea pregunta"
                ON public.product_questions FOR INSERT
                WITH CHECK (user_id = auth.uid())
        $sql$;

        EXECUTE $sql$ DROP POLICY IF EXISTS "Vendor responde su producto" ON public.product_questions $sql$;
        EXECUTE $sql$
            CREATE POLICY "Vendor responde su producto"
                ON public.product_questions FOR UPDATE
                USING (
                    EXISTS (
                        SELECT 1 FROM public.products p
                        WHERE p.id = product_questions.product_id AND p.vendor_id = auth.uid()
                    )
                )
        $sql$;
    END IF;

    -- vendor_reviews
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='vendor_reviews') THEN
        EXECUTE $sql$ ALTER TABLE public.vendor_reviews ENABLE ROW LEVEL SECURITY $sql$;

        EXECUTE $sql$ DROP POLICY IF EXISTS "Vendor reviews publicas" ON public.vendor_reviews $sql$;
        EXECUTE $sql$
            CREATE POLICY "Vendor reviews publicas"
                ON public.vendor_reviews FOR SELECT
                USING (status = 'published')
        $sql$;

        EXECUTE $sql$ DROP POLICY IF EXISTS "Compradores crean vendor review" ON public.vendor_reviews $sql$;
        EXECUTE $sql$
            CREATE POLICY "Compradores crean vendor review"
                ON public.vendor_reviews FOR INSERT
                WITH CHECK (
                    user_id = auth.uid()
                    AND EXISTS (
                        SELECT 1 FROM public.orders o
                        JOIN public.order_items oi ON oi.order_id = o.id
                        JOIN public.products p ON p.id = oi.product_id
                        WHERE p.vendor_profile_id = vendor_reviews.vendor_profile_id
                          AND o.user_id           = auth.uid()
                          AND o.status            = 'delivered'
                    )
                )
        $sql$;
    END IF;
END $$;


-- ============================================================
-- 12. Funcion publica: puede_resenar(product_id) — usado por frontend
--     para mostrar/ocultar el boton "Escribir review"
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'order_items'
    ) THEN
        RETURN;
    END IF;

    EXECUTE $func$
        CREATE OR REPLACE FUNCTION public.can_review_product(p_product_id uuid)
        RETURNS jsonb
        LANGUAGE plpgsql
        STABLE
        SECURITY DEFINER
        SET search_path = public
        AS $body$
        DECLARE
            v_user_id      uuid := auth.uid();
            v_delivered    boolean;
            v_existing     uuid;
        BEGIN
            IF v_user_id IS NULL THEN
                RETURN jsonb_build_object('can', false, 'reason', 'not_authenticated');
            END IF;

            SELECT id INTO v_existing
            FROM public.product_reviews
            WHERE product_id = p_product_id AND user_id = v_user_id;

            IF v_existing IS NOT NULL THEN
                RETURN jsonb_build_object('can', false, 'reason', 'already_reviewed', 'review_id', v_existing);
            END IF;

            SELECT EXISTS (
                SELECT 1
                FROM public.orders o
                JOIN public.order_items oi ON oi.order_id = o.id
                WHERE oi.product_id = p_product_id
                  AND o.user_id     = v_user_id
                  AND o.status      = 'delivered'
            ) INTO v_delivered;

            IF NOT v_delivered THEN
                RETURN jsonb_build_object('can', false, 'reason', 'not_delivered');
            END IF;

            RETURN jsonb_build_object('can', true);
        END;
        $body$;
    $func$;

    EXECUTE $sql$ GRANT EXECUTE ON FUNCTION public.can_review_product(uuid) TO authenticated $sql$;
END $$;


-- ============================================================
-- 13. Comentarios
-- ============================================================

COMMENT ON COLUMN public.product_reviews.sport_used_for IS
    'Deporte para el que el comprador usa el producto. Diferenciador clave vs reviews genericas.';
COMMENT ON COLUMN public.product_reviews.level IS
    'Nivel del comprador (principiante/intermedio/avanzado/profesional). Da contexto a la review.';
COMMENT ON COLUMN public.product_reviews.fit_feedback IS
    'Feedback sobre talla (muy_pequeno..muy_grande). Crucial para calzado y ropa.';
COMMENT ON COLUMN public.product_reviews.is_verified_purchase IS
    'true si el user tiene una order delivered del producto. Set automatico por trigger set_review_verified_purchase.';
