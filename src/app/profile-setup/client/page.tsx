
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
import type { Client, GeoPoint, Address } from '@/lib/types';
import { Header } from '@/components/header';

const initialAddress: Address = {
    cep: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    fullAddress: '',
};

async function getCoordinatesForAddress(address: string, apiKey: string): Promise<GeoPoint | null> {
    if (!address || !apiKey) return null;
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.status === 'OK' && data.results[0]) {
            return data.results[0].geometry.location; // { lat, lng }
        }
        console.warn('Geocoding API warning:', data.status, data.error_message);
        return null;
    } catch (error) {
        console.error('Error fetching geocoding data:', error);
        return null;
    }
}

export default function ProfileSetupClientPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [address, setAddress] = useState<Address>(initialAddress);
  const [isLoading, setIsLoading] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isCepLoading, setIsCepLoading] = useState(false);

  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  const fullAddressString = address.street ? `${address.street}, ${address.number}, ${address.neighborhood}, ${address.city} - ${address.state}` : '';


  useEffect(() => {
    if (user) {
      const fetchProfile = async () => {
        setIsPageLoading(true);
        const clientRef = doc(db, 'clients', user.uid);
        const docSnap = await getDoc(clientRef);
        if (docSnap.exists()) {
          const clientData = docSnap.data() as Client;
          if (clientData.address) {
            setAddress(clientData.address);
          }
        }
        setIsPageLoading(false);
      };
      fetchProfile();
    } else if (!authLoading) {
        router.push('/');
    }
  }, [user, authLoading, router]);

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAddress(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };
  
  const handleCepBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const cep = e.target.value.replace(/\D/g, '');
    if (cep.length !== 8) return;

    setIsCepLoading(true);
    try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();
        if (!data.erro) {
            setAddress(prev => ({
                ...prev,
                street: data.logradouro,
                neighborhood: data.bairro,
                city: data.localidade,
                state: data.uf,
            }));
            toast({ title: 'Sucesso', description: 'Endereço encontrado!' });
        } else {
            toast({ title: 'Erro', description: 'CEP não encontrado.', variant: 'destructive' });
        }
    } catch (error) {
        toast({ title: 'Erro', description: 'Não foi possível buscar o CEP.', variant: 'destructive' });
    } finally {
        setIsCepLoading(false);
    }
  }


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({ title: 'Erro', description: 'Usuário não autenticado.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    
    const completeAddress = `${address.street}, ${address.number}, ${address.neighborhood}, ${address.city} - ${address.state}`;
    let coordinates = null;
    if (address.street && address.number) {
        coordinates = await getCoordinatesForAddress(completeAddress, mapsApiKey);
        if (!coordinates) {
            toast({ title: 'Aviso', description: 'Não foi possível encontrar as coordenadas para o endereço fornecido. Verifique o endereço e tente novamente.', variant: 'destructive' });
        }
    }

    try {
      const clientRef = doc(db, 'clients', user.uid);
      const finalAddress = { ...address, fullAddress: completeAddress };
      const dataToSave = { 
          address: finalAddress, 
          coordinates: coordinates,
          profileComplete: true 
      };
      await setDoc(clientRef, dataToSave, { merge: true });
      toast({ title: 'Sucesso!', description: 'Perfil salvo com sucesso!' });
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
        <Card className="bg-card border-none shadow-lg mt-8">
          <CardHeader>
            <CardDescription>Atualize seu endereço principal para facilitar o atendimento em domicílio.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-8">
              <Card className="p-6 bg-card border-none shadow-md">
                <CardTitle className="text-xl font-semibold text-primary mb-4">Seu Endereço</CardTitle>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-1">
                        <Label htmlFor="cep">CEP</Label>
                        <div className="relative">
                            <Input type="text" id="cep" name="cep" value={address.cep} onChange={handleAddressChange} onBlur={handleCepBlur} placeholder="00000-000" maxLength={9} required />
                            {isCepLoading && <Icons.Spinner className="absolute right-3 top-1/2 -translate-y-1/2" />}
                        </div>
                    </div>
                    <div className="sm:col-span-2">
                        <Label htmlFor="street">Rua</Label>
                        <Input type="text" id="street" name="street" value={address.street} onChange={handleAddressChange} placeholder="Rua dos Pinheiros" required disabled={isCepLoading} />
                    </div>
                     <div className="sm:col-span-1">
                        <Label htmlFor="number">Número</Label>
                        <Input type="text" id="number" name="number" value={address.number} onChange={handleAddressChange} placeholder="123" required />
                    </div>
                     <div className="sm:col-span-2">
                        <Label htmlFor="complement">Complemento (Opcional)</Label>
                        <Input type="text" id="complement" name="complement" value={address.complement || ''} onChange={handleAddressChange} placeholder="Apto 45" />
                    </div>
                     <div>
                        <Label htmlFor="neighborhood">Bairro</Label>
                        <Input type="text" id="neighborhood" name="neighborhood" value={address.neighborhood} onChange={handleAddressChange} placeholder="Jardim Paulista" required disabled={isCepLoading}/>
                    </div>
                     <div>
                        <Label htmlFor="city">Cidade</Label>
                        <Input type="text" id="city" name="city" value={address.city} onChange={handleAddressChange} placeholder="São Paulo" required disabled={isCepLoading}/>
                    </div>
                     <div>
                        <Label htmlFor="state">Estado</Label>
                        <Input type="text" id="state" name="state" value={address.state} onChange={handleAddressChange} placeholder="SP" required disabled={isCepLoading}/>
                    </div>
                </div>

                <div className="mt-4 h-64 bg-muted rounded-lg flex items-center justify-center text-muted-foreground border border-border overflow-hidden">
                  {mapsApiKey && fullAddressString ? (
                     <iframe
                        width="100%"
                        height="100%"
                        style={{ border: 0 }}
                        loading="lazy"
                        allowFullScreen
                        src={`https://www.google.com/maps/embed/v1/place?key=${mapsApiKey}&q=${encodeURIComponent(fullAddressString)}`}>
                      </iframe>
                  ) : (
                    <p className="text-center p-4">
                      {fullAddressString ? 'Chave da API do Google Maps não configurada.' : 'Preencha o endereço para ver o mapa.'}
                    </p>
                  )}
                </div>
              </Card>
              
              <Button type="submit" disabled={isLoading} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 text-base">
                 {isLoading && <Icons.Spinner className="mr-2 h-4 w-4" />}
                {isLoading ? 'Salvando...' : 'Salvar Endereço'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
