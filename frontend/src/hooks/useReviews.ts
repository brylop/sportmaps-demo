import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────
export type ReviewLevel = 'principiante' | 'intermedio' | 'avanzado' | 'profesional';
export type ReviewUsageDuration = 'una_vez' | '1_semana' | '1_mes' | '3_meses' | '6_meses' | '1_anio' | 'mas_de_1_anio';
export type ReviewFitFeedback = 'muy_pequeno' | 'pequeno' | 'justo' | 'grande' | 'muy_grande' | 'no_aplica';

export interface ProductReview {
    id:                     string;
    rating:                 number;
    title:                  string | null;
    body:                   string;
    sport_used_for:         string | null;
    level:                  ReviewLevel | null;
    usage_duration:         ReviewUsageDuration | null;
    fit_feedback:           ReviewFitFeedback | null;
    recommended:            boolean | null;
    helpful_count:          number;
    unhelpful_count:        number;
    vendor_response:        string | null;
    vendor_responded_at:    string | null;
    is_verified_purchase:   boolean;
    created_at:             string;
    user_id:                string;
    my_vote:                'helpful' | 'unhelpful' | null;
    profiles?:              { full_name: string; avatar_url: string | null };
    product_review_media?:  Array<{ id: string; type: 'image' | 'video'; url: string; thumbnail_url: string | null }>;
}

export interface ProductQuestion {
    id:                  string;
    question:            string;
    vendor_answer:       string | null;
    vendor_answered_at:  string | null;
    helpful_count:       number;
    created_at:          string;
    user_id:             string;
    profiles?:           { full_name: string; avatar_url: string | null };
}

export interface VendorReview {
    id:               string;
    rating:           number;
    shipping_rating:  number | null;
    service_rating:   number | null;
    body:             string | null;
    is_verified:      boolean;
    created_at:       string;
    user_id:          string;
    profiles?:        { full_name: string; avatar_url: string | null };
}

export type ReviewSort = 'recent' | 'helpful' | 'rating_desc' | 'rating_asc';

// ─────────────────────────────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────────────────────────────

export function useProductReviews(productId: string | undefined, sort: ReviewSort = 'recent', page = 1) {
    const { session } = useAuth();
    return useQuery({
        queryKey: ['product-reviews', productId, sort, page, session?.user.id],
        enabled: !!productId,
        queryFn: async () => {
            const url = `${API_URL}/api/v1/marketplace/products/${productId}/reviews?sort=${sort}&page=${page}`;
            const headers: Record<string, string> = {};
            if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
            const res = await fetch(url, { headers });
            if (!res.ok) throw new Error('Error cargando reviews.');
            const json = await res.json();
            return { items: (json.data as ProductReview[]) || [], total: json.total as number };
        },
    });
}

export function useProductQuestions(productId: string | undefined) {
    return useQuery({
        queryKey: ['product-questions', productId],
        enabled: !!productId,
        queryFn: async () => {
            const res = await fetch(`${API_URL}/api/v1/marketplace/products/${productId}/questions`);
            if (!res.ok) throw new Error('Error cargando preguntas.');
            const json = await res.json();
            return { items: (json.data as ProductQuestion[]) || [], total: json.total as number };
        },
    });
}

export function useVendorReviews(vendorProfileId: string | undefined) {
    return useQuery({
        queryKey: ['vendor-reviews', vendorProfileId],
        enabled: !!vendorProfileId,
        queryFn: async () => {
            const res = await fetch(`${API_URL}/api/v1/marketplace/vendors/${vendorProfileId}/reviews`);
            if (!res.ok) throw new Error('Error cargando reviews del vendor.');
            const json = await res.json();
            return { items: (json.data as VendorReview[]) || [], total: json.total as number };
        },
    });
}

export function useCanReviewProduct(productId: string | undefined) {
    const { session } = useAuth();
    return useQuery({
        queryKey: ['can-review-product', productId, session?.user.id],
        enabled: !!productId && !!session?.access_token,
        queryFn: async () => {
            const res = await fetch(`${API_URL}/api/v1/reviews/products/${productId}/can-review`, {
                headers: { 'Authorization': `Bearer ${session?.access_token}` },
            });
            if (!res.ok) throw new Error('Error verificando elegibilidad.');
            const json = await res.json();
            return json as { can: boolean; reason?: string; review_id?: string };
        },
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateReviewInput {
    productId:        string;
    rating:           number;
    title?:           string;
    body:             string;
    sport_used_for?:  string;
    level?:           ReviewLevel;
    usage_duration?:  ReviewUsageDuration;
    fit_feedback?:    ReviewFitFeedback;
    recommended?:     boolean;
    media_urls?:      string[];
}

export function useReviewMutations(productId?: string) {
    const { session } = useAuth();
    const qc = useQueryClient();

    const authHeaders = () => ({
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
    });

    const createReview = useMutation({
        mutationFn: async (input: CreateReviewInput) => {
            const { productId: pid, ...body } = input;
            const res = await fetch(`${API_URL}/api/v1/reviews/products/${pid}`, {
                method:  'POST',
                headers: authHeaders(),
                body:    JSON.stringify(body),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || 'Error creando review.');
            return json.data as ProductReview;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['product-reviews', productId] });
            qc.invalidateQueries({ queryKey: ['can-review-product', productId] });
            qc.invalidateQueries({ queryKey: ['marketplace', 'product', productId] });
        },
    });

    const voteReview = useMutation({
        mutationFn: async ({ reviewId, vote }: { reviewId: string; vote: 'helpful' | 'unhelpful' }) => {
            const res = await fetch(`${API_URL}/api/v1/reviews/${reviewId}/vote`, {
                method:  'POST',
                headers: authHeaders(),
                body:    JSON.stringify({ vote }),
            });
            if (!res.ok) throw new Error('Error votando.');
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['product-reviews', productId] });
        },
    });

    const flagReview = useMutation({
        mutationFn: async ({ reviewId, reason }: { reviewId: string; reason: string }) => {
            const res = await fetch(`${API_URL}/api/v1/reviews/${reviewId}/flag`, {
                method:  'POST',
                headers: authHeaders(),
                body:    JSON.stringify({ reason }),
            });
            if (!res.ok) throw new Error('Error reportando.');
        },
    });

    const respondReview = useMutation({
        mutationFn: async ({ reviewId, response }: { reviewId: string; response: string }) => {
            const res = await fetch(`${API_URL}/api/v1/reviews/${reviewId}/respond`, {
                method:  'POST',
                headers: authHeaders(),
                body:    JSON.stringify({ response }),
            });
            if (!res.ok) throw new Error('Error respondiendo.');
            return res.json();
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['product-reviews', productId] });
            qc.invalidateQueries({ queryKey: ['vendor-inbox'] });
        },
    });

    return { createReview, voteReview, flagReview, respondReview };
}

export function useQuestionMutations(productId?: string) {
    const { session } = useAuth();
    const qc = useQueryClient();

    const authHeaders = () => ({
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
    });

    const askQuestion = useMutation({
        mutationFn: async ({ question }: { question: string }) => {
            const res = await fetch(`${API_URL}/api/v1/questions/products/${productId}`, {
                method:  'POST',
                headers: authHeaders(),
                body:    JSON.stringify({ question }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || 'Error publicando pregunta.');
            return json.data as ProductQuestion;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['product-questions', productId] });
        },
    });

    const answerQuestion = useMutation({
        mutationFn: async ({ questionId, answer }: { questionId: string; answer: string }) => {
            const res = await fetch(`${API_URL}/api/v1/questions/${questionId}/answer`, {
                method:  'POST',
                headers: authHeaders(),
                body:    JSON.stringify({ answer }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || 'Error respondiendo.');
            return json.data as ProductQuestion;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['product-questions', productId] });
            qc.invalidateQueries({ queryKey: ['vendor-inbox'] });
        },
    });

    return { askQuestion, answerQuestion };
}

export function useVendorInbox() {
    const { session } = useAuth();
    return useQuery({
        queryKey: ['vendor-inbox', session?.user.id],
        enabled: !!session?.access_token,
        queryFn: async () => {
            const res = await fetch(`${API_URL}/api/v1/vendor/inbox`, {
                headers: { 'Authorization': `Bearer ${session?.access_token}` },
            });
            if (!res.ok) throw new Error('Error cargando inbox.');
            const json = await res.json();
            return json.data as {
                pending_reviews:   any[];
                pending_questions: any[];
                counts:            { reviews: number; questions: number };
            };
        },
    });
}
