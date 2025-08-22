
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuthGuard } from '@/hooks/use-auth-guard';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Review } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Header } from '@/components/header';
import { Icons } from '@/components/icons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StarRating } from '@/components/star-rating';


export default function BarberReviewsPage() {
  const { user, loading } = useAuthGuard('barber');
  const { toast } = useToast();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [starFilter, setStarFilter] = useState<number | 'all'>('all');

  useEffect(() => {
    const fetchReviews = async () => {
      if (user) {
        setIsLoading(true);
        try {
          const q = query(
            collection(db, `barbers/${user.uid}/reviews`),
            orderBy('createdAt', 'desc')
          );
          const reviewsSnapshot = await getDocs(q);
          const allReviews: Review[] = [];
          reviewsSnapshot.forEach((doc) =>
            allReviews.push({ id: doc.id, ...doc.data() } as Review)
          );
          setReviews(allReviews);
        } catch (error) {
          console.error('Error fetching reviews:', error);
          toast({
            title: 'Erro',
            description: 'Não foi possível carregar as avaliações.',
            variant: 'destructive',
          });
        } finally {
          setIsLoading(false);
        }
      }
    };

    if (!user || loading) return;
    fetchReviews();
  }, [user, loading, toast]);

  const { averageRating, totalReviews, praiseCounts } = useMemo(() => {
    if (reviews.length === 0) {
      return { averageRating: 0, totalReviews: 0, praiseCounts: {} };
    }
    const totalRating = reviews.reduce((acc, review) => acc + review.rating, 0);
    const praiseCounts = reviews
      .flatMap((review) => review.praises || [])
      .reduce((acc, praise) => {
        acc[praise] = (acc[praise] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    return {
      averageRating: totalRating / reviews.length,
      totalReviews: reviews.length,
      praiseCounts: Object.entries(praiseCounts).sort((a,b) => b[1] - a[1]),
    };
  }, [reviews]);
  
  const filteredReviews = useMemo(() => {
      if (starFilter === 'all') return reviews;
      return reviews.filter(r => r.rating === starFilter);
  }, [reviews, starFilter]);

  if (loading || isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-4">
          <Icons.Spinner className="h-8 w-8" />
          <h1 className="text-2xl font-headline">Carregando Avaliações...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <Header title="Minhas Avaliações" showBackButton />
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <Card className="bg-card border-border shadow-lg">
                <CardHeader>
                    <CardTitle>Filtrar Avaliações</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-2">
                        <Button variant={starFilter === 'all' ? 'default' : 'outline'} onClick={() => setStarFilter('all')}>
                            Todas ({totalReviews})
                        </Button>
                        {[5, 4, 3, 2, 1].map(star => (
                             <Button key={star} variant={starFilter === star ? 'default' : 'outline'} onClick={() => setStarFilter(star)}>
                                {star} <Icons.Star className="ml-1 h-4 w-4 fill-current"/>
                            </Button>
                        ))}
                    </div>
                    <div className="mt-6 space-y-4">
                        {filteredReviews.length > 0 ? (
                            filteredReviews.map(review => (
                                <div key={review.id} className="p-4 bg-muted/50 rounded-lg border border-border">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-semibold">{review.clientName}</p>
                                            <StarRating rating={review.rating} />
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            {review.createdAt ? new Date(review.createdAt.seconds * 1000).toLocaleDateString('pt-BR') : ''}
                                        </p>
                                    </div>
                                    {review.comment && <p className="mt-2 text-foreground">{review.comment}</p>}
                                    {review.praises && review.praises.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {review.praises.map(praise => <Badge key={praise} variant="secondary">{praise}</Badge>)}
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <p className="text-muted-foreground text-center py-8">Nenhuma avaliação encontrada para este filtro.</p>
                        )}
                    </div>
                </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="h-fit sticky top-8">
            <Card className="bg-card border-border shadow-lg">
              <CardHeader>
                <CardTitle>Resumo Geral</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-center gap-2 text-4xl font-bold text-primary">
                    <Icons.Star className="h-8 w-8 fill-current" />
                    <span>{averageRating.toFixed(1)}</span>
                </div>
                <p className="text-center text-muted-foreground">Baseado em {totalReviews} avaliações</p>

                <div className="pt-4 border-t border-border">
                  <h3 className="font-semibold text-primary mb-2">Elogios Mais Recebidos</h3>
                  {praiseCounts.length > 0 ? (
                    <div className="space-y-1">
                        {praiseCounts.map(([praise, count]) => (
                            <div key={praise} className="flex justify-between text-muted-foreground">
                                <span>{praise}</span>
                                <span>{count}</span>
                            </div>
                        ))}
                    </div>
                  ) : (
                      <p className="text-muted-foreground text-sm">Nenhum elogio recebido ainda.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
