import { useState } from 'react';
import { useReviewMutations, type CreateReviewInput, type ReviewLevel, type ReviewUsageDuration, type ReviewFitFeedback } from '@/hooks/useReviews';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ReviewStars } from './ReviewStars';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, ThumbsUp, ThumbsDown } from 'lucide-react';

interface Props {
    open:           boolean;
    onOpenChange:   (open: boolean) => void;
    productId:      string;
    productName:    string;
    productCategorySlug?: string;
}

/**
 * Modal de creación de review con contexto deportivo obligatorio (el moat).
 * Campos: rating, title, body + sport/level/usage_duration/fit/recommended.
 */
export function WriteReviewModal({ open, onOpenChange, productId, productName, productCategorySlug }: Props) {
    const { toast } = useToast();
    const { createReview } = useReviewMutations(productId);

    const [rating,      setRating]      = useState(0);
    const [title,       setTitle]       = useState('');
    const [body,        setBody]        = useState('');
    const [sport,       setSport]       = useState('');
    const [level,       setLevel]       = useState<ReviewLevel | ''>('');
    const [duration,    setDuration]    = useState<ReviewUsageDuration | ''>('');
    const [fit,         setFit]         = useState<ReviewFitFeedback | ''>('');
    const [recommended, setRecommended] = useState<boolean | null>(null);

    // Mostrar talla solo si la categoría tiene fit relevante
    const showFit = productCategorySlug === 'calzado' || productCategorySlug === 'ropa-deportiva';

    const reset = () => {
        setRating(0); setTitle(''); setBody('');
        setSport(''); setLevel(''); setDuration(''); setFit(''); setRecommended(null);
    };

    const canSubmit = rating >= 1 && body.length >= 20;

    const submit = async () => {
        if (!canSubmit) return;
        const input: CreateReviewInput = {
            productId,
            rating,
            title:           title || undefined,
            body,
            sport_used_for:  sport || undefined,
            level:           (level || undefined) as ReviewLevel | undefined,
            usage_duration:  (duration || undefined) as ReviewUsageDuration | undefined,
            fit_feedback:    (showFit ? (fit || undefined) : undefined) as ReviewFitFeedback | undefined,
            recommended:     recommended ?? undefined,
        };
        try {
            await createReview.mutateAsync(input);
            toast({ title: '¡Gracias por tu review!', description: 'Tu opinión ayuda a otros deportistas.' });
            reset();
            onOpenChange(false);
        } catch (e: any) {
            toast({ title: 'No se pudo publicar', description: e?.message || 'Intenta de nuevo.', variant: 'destructive' });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-amber-500" />
                        Escribe tu review de {productName}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Rating */}
                    <div>
                        <Label className="mb-1.5 block">Tu calificación *</Label>
                        <ReviewStars rating={rating} size="lg" onChange={setRating} />
                    </div>

                    {/* Title */}
                    <div>
                        <Label>Título (opcional)</Label>
                        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Resumen en una frase" maxLength={120} />
                    </div>

                    {/* Body */}
                    <div>
                        <Label>Tu experiencia *</Label>
                        <Textarea
                            rows={4}
                            value={body}
                            onChange={e => setBody(e.target.value)}
                            placeholder="Cuéntale a otros deportistas cómo te fue: qué te gustó, qué no, durabilidad, comodidad..."
                            maxLength={4000}
                        />
                        <p className="text-[11px] text-muted-foreground mt-1">Mínimo 20 caracteres ({body.length}/20).</p>
                    </div>

                    {/* CONTEXTO DEPORTIVO — esto es lo que nos diferencia */}
                    <div className="rounded-lg border bg-amber-50/40 border-amber-200 p-3 space-y-3">
                        <p className="text-xs font-semibold text-amber-900">📊 Contexto deportivo (ayuda a otros a decidir)</p>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs">Lo usé para</Label>
                                <Input value={sport} onChange={e => setSport(e.target.value)} placeholder="Ej: maratón, fútbol sala..." maxLength={40} />
                            </div>
                            <div>
                                <Label className="text-xs">Mi nivel</Label>
                                <Select value={level || ''} onValueChange={(v: ReviewLevel) => setLevel(v)}>
                                    <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="principiante">Principiante</SelectItem>
                                        <SelectItem value="intermedio">Intermedio</SelectItem>
                                        <SelectItem value="avanzado">Avanzado</SelectItem>
                                        <SelectItem value="profesional">Profesional</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs">Tiempo de uso</Label>
                                <Select value={duration || ''} onValueChange={(v: ReviewUsageDuration) => setDuration(v)}>
                                    <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="una_vez">Una sola vez</SelectItem>
                                        <SelectItem value="1_semana">1 semana</SelectItem>
                                        <SelectItem value="1_mes">1 mes</SelectItem>
                                        <SelectItem value="3_meses">3 meses</SelectItem>
                                        <SelectItem value="6_meses">6 meses</SelectItem>
                                        <SelectItem value="1_anio">1 año</SelectItem>
                                        <SelectItem value="mas_de_1_anio">Más de 1 año</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {showFit && (
                                <div>
                                    <Label className="text-xs">Talla</Label>
                                    <Select value={fit || ''} onValueChange={(v: ReviewFitFeedback) => setFit(v)}>
                                        <SelectTrigger className="h-9"><SelectValue placeholder="¿Cómo te quedó?" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="muy_pequeno">Muy pequeño</SelectItem>
                                            <SelectItem value="pequeno">Pequeño</SelectItem>
                                            <SelectItem value="justo">Justo</SelectItem>
                                            <SelectItem value="grande">Grande</SelectItem>
                                            <SelectItem value="muy_grande">Muy grande</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>

                        <div>
                            <Label className="text-xs">¿Lo recomiendas?</Label>
                            <div className="flex gap-2 mt-1">
                                <Button
                                    type="button"
                                    variant={recommended === true ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setRecommended(true)}
                                    className="gap-1"
                                >
                                    <ThumbsUp className="h-3.5 w-3.5" /> Sí
                                </Button>
                                <Button
                                    type="button"
                                    variant={recommended === false ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setRecommended(false)}
                                    className="gap-1"
                                >
                                    <ThumbsDown className="h-3.5 w-3.5" /> No
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={submit} disabled={!canSubmit || createReview.isPending}>
                        {createReview.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                        Publicar review
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
