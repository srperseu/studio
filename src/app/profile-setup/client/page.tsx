'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Icons } from '@/components/icons';
import type { Client } from '@/lib/types';
import { Header } from '@/components/header';

export default function ProfileSetupClientPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [profile, setProfile] = useState<Partial<Client>>({ address: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);

  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (user) {
      const fetchProfile = async () => {
        setIsPageLoading(true);
        const clientRef = doc(db, 'clients', user.uid);
        const docSnap = await getDoc(clientRef);
        if (docSnap.exists()) {
          setProfile(docSnap.data() as Client);
        }
        setIsPageLoading(false);
      };
      fetchProfile();
    } else if (!authLoading) {
        router.push('/login');
    }
  }, [user, authLoading, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfile(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({ title: 'Erro', description: 'Usuário não autenticado.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      const clientRef = doc(db, 'clients', user.uid);
      await setDoc(clientRef, { ...profile, profileComplete: true }, { merge: true });
      toast({ title: 'Sucesso!', description: 'Perfil salvo com sucesso!' });
      router.push('/');
    } catch (error: any) {
      console.error("Erro ao salvar o perfil do cliente: ", error);
      toast({ title: 'Erro', description: `Erro ao salvar: ${error.message}`, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || isPageLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-4">
          <Icons.Spinner className="h-8 w-8" />
          <h1 className="text-2xl font-headline">Carregando Perfil...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <Header title="Configurar seu Perfil" showBackButton />
        <Card className="bg-card border-border mt-8">
          <CardHeader>
            <CardDescription>Complete seu perfil para facilitar seus agendamentos.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-8">
              <Card className="p-6 bg-muted/50 border-border">
                <CardTitle className="text-xl font-semibold text-primary mb-4">Seu Endereço</CardTitle>
                <Label htmlFor="address">Endereço Principal</Label>
                <div className="relative mt-2">
                  <Icons.MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input 
                    type="text" 
                    id="address" 
                    name="address" 
                    value={profile.address || ''} 
                    onChange={handleChange} 
                    placeholder="Rua, Número, Bairro, Cidade - Estado" 
                    className="w-full pl-10" 
                    required
                  />
                </div>
                <div className="mt-4 h-64 bg-muted rounded-lg flex items-center justify-center text-muted-foreground border border-border overflow-hidden">
                  {mapsApiKey && profile.address ? (
                     <iframe
                        width="100%"
                        height="100%"
                        style={{ border: 0 }}
                        loading="lazy"
                        allowFullScreen
                        src={`https://www.google.com/maps/embed/v1/place?key=${mapsApiKey}&q=${encodeURIComponent(profile.address)}`}>
                      </iframe>
                  ) : (
                    <p className="text-center p-4">
                      {profile.address ? 'Chave da API do Google Maps não configurada.' : 'Digite um endereço para ver o mapa.'}
                    </p>
                  )}
                </div>
              </Card>
              
              <Button type="submit" disabled={isLoading} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 text-base">
                 {isLoading && <Icons.Spinner className="mr-2 h-4 w-4" />}
                {isLoading ? 'Salvando...' : 'Salvar Endereço e Concluir'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
