import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProductQuestions, useQuestionMutations } from '@/hooks/useReviews';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { HelpCircle, MessageSquareReply, Loader2 } from 'lucide-react';

interface Props {
    productId: string;
    isVendor?: boolean;
}

export function QuestionsList({ productId, isVendor }: Props) {
    const { user } = useAuth();
    const { toast } = useToast();
    const { data, isLoading } = useProductQuestions(productId);
    const { askQuestion, answerQuestion } = useQuestionMutations(productId);

    const [question, setQuestion] = useState('');
    const [answeringId, setAnsweringId] = useState<string | null>(null);
    const [answerText, setAnswerText]   = useState('');

    const submitQuestion = async () => {
        if (question.length < 5) return;
        try {
            await askQuestion.mutateAsync({ question });
            toast({ title: 'Pregunta enviada', description: 'El vendor responderá pronto.' });
            setQuestion('');
        } catch (e: any) {
            toast({ title: 'Error', description: e?.message || 'No se pudo enviar.', variant: 'destructive' });
        }
    };

    const submitAnswer = async (qid: string) => {
        if (answerText.length < 2) return;
        try {
            await answerQuestion.mutateAsync({ questionId: qid, answer: answerText });
            setAnsweringId(null);
            setAnswerText('');
        } catch (e: any) {
            toast({ title: 'Error', description: e?.message || 'No se pudo responder.', variant: 'destructive' });
        }
    };

    return (
        <section className="space-y-4">
            <Card>
                <CardContent className="p-5">
                    <h3 className="font-semibold flex items-center gap-2 mb-3">
                        <HelpCircle className="h-5 w-5 text-primary" />
                        Preguntas y respuestas
                    </h3>

                    {/* Form de pregunta */}
                    {user && !isVendor && (
                        <div className="space-y-2 mb-4 pb-4 border-b">
                            <Textarea
                                rows={2}
                                value={question}
                                onChange={e => setQuestion(e.target.value)}
                                placeholder="¿Tienes una pregunta sobre este producto?"
                                maxLength={500}
                            />
                            <div className="flex justify-end">
                                <Button size="sm" onClick={submitQuestion} disabled={question.length < 5 || askQuestion.isPending}>
                                    {askQuestion.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                                    Publicar pregunta
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Lista */}
                    {isLoading ? (
                        <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                    ) : !data?.items?.length ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Aún no hay preguntas.</p>
                    ) : (
                        <div className="divide-y">
                            {data.items.map(q => {
                                const initials = (q.profiles?.full_name || 'U').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();
                                return (
                                    <div key={q.id} className="py-3 first:pt-0">
                                        <div className="flex gap-3">
                                            <Avatar className="h-7 w-7 shrink-0">
                                                <AvatarImage src={q.profiles?.avatar_url || ''} />
                                                <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                                                    <span className="font-medium text-foreground">{q.profiles?.full_name || 'Usuario'}</span>
                                                    <span>·</span>
                                                    <span>{new Date(q.created_at).toLocaleDateString('es-CO')}</span>
                                                </div>
                                                <p className="text-sm mt-0.5">{q.question}</p>

                                                {q.vendor_answer ? (
                                                    <div className="mt-2 ml-2 pl-3 border-l-2 border-primary/40 bg-primary/5 rounded-r p-2">
                                                        <div className="flex items-center gap-1 text-[11px] text-primary font-medium mb-0.5">
                                                            <Badge variant="default" className="text-[9px] h-4">Vendedor</Badge>
                                                            <span className="text-muted-foreground">{q.vendor_answered_at && new Date(q.vendor_answered_at).toLocaleDateString('es-CO')}</span>
                                                        </div>
                                                        <p className="text-xs">{q.vendor_answer}</p>
                                                    </div>
                                                ) : isVendor ? (
                                                    answeringId === q.id ? (
                                                        <div className="mt-2 space-y-1.5">
                                                            <Textarea rows={2} value={answerText} onChange={e => setAnswerText(e.target.value)} placeholder="Tu respuesta..." />
                                                            <div className="flex justify-end gap-2">
                                                                <Button size="sm" variant="ghost" onClick={() => setAnsweringId(null)}>Cancelar</Button>
                                                                <Button size="sm" onClick={() => submitAnswer(q.id)} disabled={answerText.length < 2 || answerQuestion.isPending}>
                                                                    {answerQuestion.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                                                                    Responder
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <Button variant="link" size="sm" className="h-6 px-0 text-xs" onClick={() => { setAnsweringId(q.id); setAnswerText(''); }}>
                                                            <MessageSquareReply className="h-3.5 w-3.5 mr-1" /> Responder
                                                        </Button>
                                                    )
                                                ) : (
                                                    <p className="text-[11px] text-muted-foreground italic mt-1">Pendiente de respuesta del vendor.</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </section>
    );
}
