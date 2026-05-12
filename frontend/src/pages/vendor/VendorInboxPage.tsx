import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useVendorInbox, useReviewMutations, useQuestionMutations } from '@/hooks/useReviews';
import { ReviewStars } from '@/components/reviews/ReviewStars';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Inbox, MessageSquare, HelpCircle, AlertTriangle, Loader2, ExternalLink } from 'lucide-react';

export default function VendorInboxPage() {
    const { data, isLoading } = useVendorInbox();
    const { respondReview } = useReviewMutations();
    const { answerQuestion } = useQuestionMutations();
    const { toast } = useToast();

    const [respondingId, setRespondingId] = useState<string | null>(null);
    const [responseText, setResponseText] = useState('');
    const [answeringId, setAnsweringId]   = useState<string | null>(null);
    const [answerText, setAnswerText]     = useState('');

    const submitResponse = async (reviewId: string) => {
        if (responseText.length < 5) return;
        try {
            await respondReview.mutateAsync({ reviewId, response: responseText });
            toast({ title: 'Respuesta publicada' });
            setRespondingId(null);
            setResponseText('');
        } catch (e: any) {
            toast({ title: 'Error', description: e?.message, variant: 'destructive' });
        }
    };

    const submitAnswer = async (questionId: string) => {
        if (answerText.length < 2) return;
        try {
            await answerQuestion.mutateAsync({ questionId, answer: answerText });
            toast({ title: 'Pregunta respondida' });
            setAnsweringId(null);
            setAnswerText('');
        } catch (e: any) {
            toast({ title: 'Error', description: e?.message, variant: 'destructive' });
        }
    };

    if (isLoading) {
        return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    const reviewsCount = data?.counts.reviews ?? 0;
    const questionsCount = data?.counts.questions ?? 0;

    return (
        <div className="container mx-auto p-4 space-y-6 max-w-4xl">
            <header>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Inbox className="h-6 w-6 text-primary" />
                    Bandeja de entrada
                </h1>
                <p className="text-sm text-muted-foreground">
                    Reviews y preguntas pendientes de tus productos. Respondé rápido — sube tu reputación y conversión.
                </p>
            </header>

            <Tabs defaultValue="reviews">
                <TabsList>
                    <TabsTrigger value="reviews" className="gap-1.5">
                        <MessageSquare className="h-4 w-4" />
                        Reviews {reviewsCount > 0 && <Badge variant="destructive" className="h-4 text-[10px] px-1.5">{reviewsCount}</Badge>}
                    </TabsTrigger>
                    <TabsTrigger value="questions" className="gap-1.5">
                        <HelpCircle className="h-4 w-4" />
                        Preguntas {questionsCount > 0 && <Badge variant="destructive" className="h-4 text-[10px] px-1.5">{questionsCount}</Badge>}
                    </TabsTrigger>
                </TabsList>

                {/* Reviews tab */}
                <TabsContent value="reviews" className="space-y-3 mt-4">
                    {data?.pending_reviews.length === 0 ? (
                        <EmptyState icon={MessageSquare} text="No tienes reviews pendientes de responder." />
                    ) : (
                        data?.pending_reviews.map((r: any) => (
                            <Card key={r.id}>
                                <CardHeader className="pb-2 flex flex-row items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        {r.products?.image_url && (
                                            <img src={r.products.image_url} alt="" className="h-12 w-12 rounded object-cover bg-muted" />
                                        )}
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <ReviewStars rating={r.rating} size="sm" />
                                                {r.rating <= 2 && (
                                                    <Badge variant="destructive" className="text-[10px] gap-1">
                                                        <AlertTriangle className="h-3 w-3" /> Urgente
                                                    </Badge>
                                                )}
                                            </div>
                                            <CardTitle className="text-sm mt-0.5">
                                                <Link to={`/marketplace/product/${r.product_id}`} className="hover:underline">
                                                    {r.products?.name}
                                                </Link>
                                            </CardTitle>
                                            <p className="text-[11px] text-muted-foreground">
                                                {new Date(r.created_at).toLocaleDateString('es-CO')} · {r.sport_used_for || 'sin contexto deportivo'}
                                            </p>
                                        </div>
                                    </div>
                                    <Link to={`/marketplace/product/${r.product_id}`} className="text-muted-foreground hover:text-foreground">
                                        <ExternalLink className="h-4 w-4" />
                                    </Link>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {r.title && <p className="text-sm font-medium">{r.title}</p>}
                                    <p className="text-sm whitespace-pre-wrap">{r.body}</p>

                                    {respondingId === r.id ? (
                                        <div className="space-y-2 pt-2 border-t">
                                            <Textarea
                                                rows={3}
                                                value={responseText}
                                                onChange={e => setResponseText(e.target.value)}
                                                placeholder="Responde de forma profesional. Esta respuesta es pública."
                                            />
                                            <div className="flex justify-end gap-2">
                                                <Button variant="outline" size="sm" onClick={() => setRespondingId(null)}>Cancelar</Button>
                                                <Button size="sm" onClick={() => submitResponse(r.id)} disabled={responseText.length < 5 || respondReview.isPending}>
                                                    {respondReview.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                                                    Publicar
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <Button size="sm" onClick={() => { setRespondingId(r.id); setResponseText(''); }}>
                                            Responder
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>
                        ))
                    )}
                </TabsContent>

                {/* Questions tab */}
                <TabsContent value="questions" className="space-y-3 mt-4">
                    {data?.pending_questions.length === 0 ? (
                        <EmptyState icon={HelpCircle} text="No tienes preguntas pendientes." />
                    ) : (
                        data?.pending_questions.map((q: any) => (
                            <Card key={q.id}>
                                <CardHeader className="pb-2 flex flex-row items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        {q.products?.image_url && (
                                            <img src={q.products.image_url} alt="" className="h-12 w-12 rounded object-cover bg-muted" />
                                        )}
                                        <div>
                                            <CardTitle className="text-sm">
                                                <Link to={`/marketplace/product/${q.product_id}`} className="hover:underline">
                                                    {q.products?.name}
                                                </Link>
                                            </CardTitle>
                                            <p className="text-[11px] text-muted-foreground">{new Date(q.created_at).toLocaleDateString('es-CO')}</p>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <p className="text-sm">{q.question}</p>

                                    {answeringId === q.id ? (
                                        <div className="space-y-2 pt-2 border-t">
                                            <Textarea rows={3} value={answerText} onChange={e => setAnswerText(e.target.value)} placeholder="Tu respuesta..." />
                                            <div className="flex justify-end gap-2">
                                                <Button variant="outline" size="sm" onClick={() => setAnsweringId(null)}>Cancelar</Button>
                                                <Button size="sm" onClick={() => submitAnswer(q.id)} disabled={answerText.length < 2 || answerQuestion.isPending}>
                                                    {answerQuestion.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                                                    Publicar
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <Button size="sm" onClick={() => { setAnsweringId(q.id); setAnswerText(''); }}>
                                            Responder
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>
                        ))
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}

function EmptyState({ icon: Icon, text }: { icon: any; text: string }) {
    return (
        <Card>
            <CardContent className="py-12 text-center">
                <Icon className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">{text}</p>
            </CardContent>
        </Card>
    );
}
