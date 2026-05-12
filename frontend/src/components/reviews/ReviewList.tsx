import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProductReviews, useCanReviewProduct, type ReviewSort } from '@/hooks/useReviews';
import { ReviewStars } from './ReviewStars';
import { ReviewCard } from './ReviewCard';
import { WriteReviewModal } from './WriteReviewModal';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Edit3, Loader2, MessageSquare } from 'lucide-react';

interface Props {
    productId:           string;
    productName:         string;
    productCategorySlug?: string;
    productAvgRating?:   number | null;
    productReviewsCount?: number;
    /** Si el viewer actual es vendor de este producto (para mostrar acciones de respuesta). */
    isVendor?:           boolean;
}

export function ReviewList({ productId, productName, productCategorySlug, productAvgRating, productReviewsCount, isVendor }: Props) {
    const { user } = useAuth();
    const [sort, setSort] = useState<ReviewSort>('recent');
    const [writeOpen, setWriteOpen] = useState(false);

    const { data, isLoading } = useProductReviews(productId, sort);
    const { data: canReview } = useCanReviewProduct(productId);

    return (
        <section className="space-y-4">
            {/* Header con resumen + CTA */}
            <Card>
                <CardContent className="p-5">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-4">
                            <div>
                                <p className="text-3xl font-bold">{productAvgRating?.toFixed(1) ?? '—'}</p>
                                <ReviewStars rating={productAvgRating || 0} size="md" />
                                <p className="text-xs text-muted-foreground mt-0.5">{productReviewsCount ?? 0} reviews</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Select value={sort} onValueChange={(v: ReviewSort) => setSort(v)}>
                                <SelectTrigger className="w-[160px] h-9 text-sm"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="recent">Más recientes</SelectItem>
                                    <SelectItem value="helpful">Más útiles</SelectItem>
                                    <SelectItem value="rating_desc">Mejor calificadas</SelectItem>
                                    <SelectItem value="rating_asc">Peor calificadas</SelectItem>
                                </SelectContent>
                            </Select>

                            {user && canReview?.can && (
                                <Button onClick={() => setWriteOpen(true)}>
                                    <Edit3 className="h-4 w-4 mr-1.5" /> Escribir review
                                </Button>
                            )}
                            {user && !canReview?.can && canReview?.reason === 'not_delivered' && (
                                <Button variant="outline" disabled title="Solo compradores con orden entregada pueden reseñar">
                                    <Edit3 className="h-4 w-4 mr-1.5" /> Compra para reseñar
                                </Button>
                            )}
                            {user && !canReview?.can && canReview?.reason === 'already_reviewed' && (
                                <span className="text-xs text-muted-foreground italic">Ya reseñaste este producto.</span>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Lista */}
            {isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : !data?.items?.length ? (
                <Card>
                    <CardContent className="py-10 text-center">
                        <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                        <p className="text-sm text-muted-foreground">Aún no hay reviews. Sé el primero.</p>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent className="p-5">
                        {data.items.map(r => (
                            <ReviewCard key={r.id} review={r} productId={productId} canRespond={isVendor} />
                        ))}
                    </CardContent>
                </Card>
            )}

            <WriteReviewModal
                open={writeOpen}
                onOpenChange={setWriteOpen}
                productId={productId}
                productName={productName}
                productCategorySlug={productCategorySlug}
            />
        </section>
    );
}
