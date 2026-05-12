import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ProductReview, useReviewMutations } from '@/hooks/useReviews';
import { ReviewStars } from './ReviewStars';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ThumbsUp, ThumbsDown, ShieldCheck, Flag, MessageSquareReply, Loader2 } from 'lucide-react';

interface Props {
    review:        ProductReview;
    /** Si true, muestra acciones de vendor (responder) */
    canRespond?:   boolean;
    /** product_id se necesita para invalidar queries en mutations */
    productId:     string;
}

const LEVEL_LABEL: Record<string, string> = {
    principiante: 'Principiante',
    intermedio:   'Intermedio',
    avanzado:     'Avanzado',
    profesional:  'Profesional',
};
const FIT_LABEL: Record<string, string> = {
    muy_pequeno: 'Muy pequeño',
    pequeno:     'Pequeño',
    justo:       'Justo',
    grande:      'Grande',
    muy_grande:  'Muy grande',
    no_aplica:   'No aplica',
};
const USAGE_LABEL: Record<string, string> = {
    una_vez:        'Una vez',
    '1_semana':     '1 semana',
    '1_mes':        '1 mes',
    '3_meses':      '3 meses',
    '6_meses':      '6 meses',
    '1_anio':       '1 año',
    mas_de_1_anio:  'Más de 1 año',
};

export function ReviewCard({ review, canRespond, productId }: Props) {
    const { user } = useAuth();
    const { voteReview, flagReview, respondReview } = useReviewMutations(productId);
    const [respondOpen, setRespondOpen] = useState(false);
    const [responseText, setResponseText] = useState('');

    const reviewerName = review.profiles?.full_name || 'Usuario';
    const initials = reviewerName.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();

    const onVote = (vote: 'helpful' | 'unhelpful') => {
        if (!user) return;
        voteReview.mutate({ reviewId: review.id, vote });
    };

    const onFlag = () => {
        if (!user) return;
        const reason = prompt('¿Por qué reportas esta review? (spam, ofensivo, falso...)');
        if (!reason) return;
        flagReview.mutate({ reviewId: review.id, reason });
    };

    const submitResponse = async () => {
        if (responseText.length < 5) return;
        await respondReview.mutateAsync({ reviewId: review.id, response: responseText });
        setRespondOpen(false);
        setResponseText('');
    };

    return (
        <article className="border-b border-border py-4 first:pt-0 last:border-b-0">
            {/* Header */}
            <header className="flex items-start gap-3">
                <Avatar className="h-9 w-9 shrink-0">
                    <AvatarImage src={review.profiles?.avatar_url || ''} />
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{reviewerName}</span>
                        {review.is_verified_purchase && (
                            <Badge variant="outline" className="text-[10px] gap-1 border-emerald-300 text-emerald-700 bg-emerald-50">
                                <ShieldCheck className="h-3 w-3" /> Compra verificada
                            </Badge>
                        )}
                        <span className="text-[11px] text-muted-foreground">
                            {new Date(review.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                    </div>
                    <ReviewStars rating={review.rating} size="sm" />
                </div>
            </header>

            {/* Title + body */}
            {review.title && <h4 className="font-semibold mt-2">{review.title}</h4>}
            <p className="text-sm mt-1 whitespace-pre-wrap leading-relaxed">{review.body}</p>

            {/* Contexto deportivo */}
            {(review.sport_used_for || review.level || review.usage_duration || review.fit_feedback || review.recommended !== null) && (
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {review.sport_used_for && <Badge variant="secondary" className="text-[10px]">⚽ {review.sport_used_for}</Badge>}
                    {review.level && <Badge variant="secondary" className="text-[10px]">🎯 {LEVEL_LABEL[review.level]}</Badge>}
                    {review.usage_duration && <Badge variant="secondary" className="text-[10px]">⏱️ {USAGE_LABEL[review.usage_duration]}</Badge>}
                    {review.fit_feedback && review.fit_feedback !== 'no_aplica' && (
                        <Badge variant="secondary" className="text-[10px]">📏 Talla: {FIT_LABEL[review.fit_feedback]}</Badge>
                    )}
                    {review.recommended === true && <Badge variant="secondary" className="text-[10px] border-emerald-200 bg-emerald-50 text-emerald-700">✓ Lo recomienda</Badge>}
                    {review.recommended === false && <Badge variant="secondary" className="text-[10px] border-red-200 bg-red-50 text-red-700">✗ No lo recomienda</Badge>}
                </div>
            )}

            {/* Media */}
            {review.product_review_media && review.product_review_media.length > 0 && (
                <div className="flex gap-2 mt-3 overflow-x-auto">
                    {review.product_review_media.map(m => (
                        <img key={m.id} src={m.thumbnail_url || m.url} alt="" className="h-20 w-20 rounded-md object-cover shrink-0" />
                    ))}
                </div>
            )}

            {/* Vendor response */}
            {review.vendor_response && (
                <div className="mt-3 ml-2 pl-3 border-l-2 border-primary/40 bg-primary/5 rounded-r-md p-2.5">
                    <p className="text-xs font-medium text-primary mb-0.5">Respuesta del vendedor</p>
                    <p className="text-xs whitespace-pre-wrap">{review.vendor_response}</p>
                </div>
            )}

            {/* Actions */}
            <footer className="flex items-center gap-1 mt-3">
                <Button
                    variant={review.my_vote === 'helpful' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-7 px-2 text-xs gap-1.5"
                    onClick={() => onVote('helpful')}
                    disabled={!user}
                >
                    <ThumbsUp className="h-3.5 w-3.5" /> {review.helpful_count > 0 && review.helpful_count} Útil
                </Button>
                <Button
                    variant={review.my_vote === 'unhelpful' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-7 px-2 text-xs gap-1.5"
                    onClick={() => onVote('unhelpful')}
                    disabled={!user}
                >
                    <ThumbsDown className="h-3.5 w-3.5" /> {review.unhelpful_count > 0 && review.unhelpful_count}
                </Button>
                {user && user.id !== review.user_id && (
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground" onClick={onFlag}>
                        <Flag className="h-3.5 w-3.5" />
                    </Button>
                )}
                {canRespond && !review.vendor_response && !respondOpen && (
                    <Button variant="outline" size="sm" className="h-7 px-2 text-xs ml-auto" onClick={() => setRespondOpen(true)}>
                        <MessageSquareReply className="h-3.5 w-3.5 mr-1" /> Responder
                    </Button>
                )}
            </footer>

            {/* Form de respuesta del vendor */}
            {respondOpen && (
                <div className="mt-3 space-y-2">
                    <Textarea
                        rows={3}
                        value={responseText}
                        onChange={e => setResponseText(e.target.value)}
                        placeholder="Responde de forma profesional. Esta respuesta es pública."
                    />
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setRespondOpen(false)}>Cancelar</Button>
                        <Button size="sm" onClick={submitResponse} disabled={responseText.length < 5 || respondReview.isPending}>
                            {respondReview.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                            Publicar respuesta
                        </Button>
                    </div>
                </div>
            )}
        </article>
    );
}
