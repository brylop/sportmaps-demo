import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Star, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Review {
  id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

interface SchoolReviewsProps {
  schoolId: string;
  schoolName: string;
  showInline?: boolean;
}

export function SchoolReviews({ schoolId, schoolName, showInline = false }: SchoolReviewsProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    loadReviews();
  }, [schoolId]);

  const loadReviews = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setReviews(data || []);
    } catch (error) {
      console.error('Error loading reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!user) {
      toast.error('Debes iniciar sesión para dejar una reseña');
      return;
    }

    if (rating === 0) {
      toast.error('Por favor selecciona una calificación');
      return;
    }

    try {
      setSubmitting(true);
      const { error } = await supabase
        .from('reviews')
        .insert({
          school_id: schoolId,
          user_id: user.id,
          rating,
          comment: comment.trim() || null
        });

      if (error) throw error;

      toast.success('Reseña publicada exitosamente');
      setRating(0);
      setComment('');
      loadReviews();
    } catch (error: any) {
      console.error('Error submitting review:', error);
      toast.error(error.message || 'Error al publicar la reseña');
    } finally {
      setSubmitting(false);
    }
  };

  const averageRating = reviews.length > 0
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
    : '0.0';

  const ReviewContent = () => (
    <div className="space-y-6">
      {/* Average Rating */}
      <div className="text-center p-6 bg-muted/50 rounded-lg">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Star className="h-8 w-8 fill-yellow-500 text-yellow-500" />
          <span className="text-4xl font-bold">{averageRating}</span>
        </div>
        <p className="text-muted-foreground">
          Basado en {reviews.length} {reviews.length === 1 ? 'reseña' : 'reseñas'}
        </p>
      </div>

      {/* Write Review */}
      {user && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Escribe una reseña</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Star Rating */}
            <div>
              <p className="text-sm font-medium mb-2">Tu calificación</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    className="transition-transform hover:scale-110"
                  >
                    <Star
                      className={`h-8 w-8 ${
                        star <= rating
                          ? 'fill-yellow-500 text-yellow-500'
                          : 'text-muted-foreground'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Comment */}
            <div>
              <p className="text-sm font-medium mb-2">Tu comentario (opcional)</p>
              <Textarea
                placeholder="Comparte tu experiencia con esta escuela..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
              />
            </div>

            <Button 
              onClick={handleSubmitReview} 
              disabled={submitting || rating === 0}
              className="w-full"
            >
              {submitting ? 'Publicando...' : 'Publicar Reseña'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Reviews List */}
      <div className="space-y-4">
        <h3 className="font-semibold">Reseñas de la comunidad</h3>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Cargando reseñas...</div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No hay reseñas aún. ¡Sé el primero en dejar una!
          </div>
        ) : (
          reviews.map((review) => (
            <Card key={review.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar>
                    <AvatarFallback>
                      {review.user_id.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-4 w-4 ${
                              star <= review.rating
                                ? 'fill-yellow-500 text-yellow-500'
                                : 'text-muted-foreground'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {new Date(review.created_at).toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                    {review.comment && (
                      <p className="text-sm">{review.comment}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );

  if (showInline) {
    return <ReviewContent />;
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <MessageSquare className="h-4 w-4" />
          Ver Reseñas ({reviews.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reseñas de {schoolName}</DialogTitle>
        </DialogHeader>
        <ReviewContent />
      </DialogContent>
    </Dialog>
  );
}
