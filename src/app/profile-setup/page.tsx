
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { generateBioAction } from '@/app/actions';


import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Icons } from '@/components/icons';
import type { Barber, GeoPoint, Address, Service } from '@/lib/types';
import { Header } from '@/components/header';
import { Switch } from '@/components/ui/switch';

const defaultAvailability = {
  'Segunda': { active: false, start: '09:00', end: '18:00' },
  'Terça': { active: true, start: '09:00', end: '18:00' },
  'Quarta': { active: true, start: '09:00', end: '18:00' },
  'Quinta': { active: true, start: '09:00', end: '18:00' },
  'Sexta': { active: true, start: '09:00', end: '18:00' },
  'Sábado': { active: true, start: '10:00', end: '20:00' },
  'Domingo': { active: false, start: '09:00', end: '18:00' },
};

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

const initialService: Service = { id: '', name: '', price: 0, atHomeFee: 0 };


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


export default function ProfileSetupPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<Partial<Barber>>({
    photoURL: '',
    description: '',
    address: initialAddress,
    availability: defaultAvailability,
    services: [],
  });
  const [newService, setNewService] = useState<Service>(initialService);
  const [address, setAddress] = useState<Address>(initialAddress);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isCepLoading, setIsCepLoading] = useState(false);

  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const fullAddressString = address.street ? `${address.street}, ${address.number}, ${address.neighborhood}, ${address.city} - ${address.state}` : '';


  useEffect(() => {
    if (user) {
      const fetchProfile = async () => {
        setIsPageLoading(true);
        const barberRef = doc(db, 'barbers', user.uid);
        const docSnap = await getDoc(barberRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as Barber;
          const { services, ...restOfData } = data;
          setProfile(prev => ({
             ...prev, 
             ...restOfData,
             availability: data.availability || defaultAvailability,
             services: data.services || [],
            }));
          if (data.address) {
            setAddress(prev => ({ ...prev, ...data.address }));
          }
          if (data.photoURL) setPreviewImage(data.photoURL);
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

  const handleGenerateDescription = async () => {
    if (!profile.description) {
      toast({ title: 'Aviso', description: 'Insira palavras-chave sobre você na caixa de descrição.', variant: 'default' });
      return;
    }
    setIsGeneratingDesc(true);
    const result = await generateBioAction(profile.description);
    if (result.success && result.bio) {
      setProfile(prev => ({ ...prev, description: result.bio }));
      toast({ title: 'Sucesso', description: 'Descrição gerada com IA!' });
    } else {
      toast({ title: 'Erro', description: result.message, variant: 'destructive' });
    }
    setIsGeneratingDesc(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setProfile(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleAvailabilityChange = (day: string, field: string, value: any) => {
    setProfile(prev => ({ ...prev, availability: { ...prev.availability, [day]: { ...prev.availability![day], [field]: value } } }));
  };
  
  const handleNewServiceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewService(prev => ({ ...prev, [name]: name === 'price' || name === 'atHomeFee' ? parseFloat(value) || 0 : value }));
  };

  const handleAddService = () => {
    if (!newService.name || newService.price <= 0) {
      toast({ title: 'Erro', description: 'Por favor, preencha o nome do serviço e um preço válido.', variant: 'destructive' });
      return;
    }
    const serviceToAdd = { ...newService, id: newService.name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now() };
    setProfile(prev => ({ ...prev, services: [...(prev.services || []), serviceToAdd] }));
    setNewService(initialService); // Reset form
  };

  const handleRemoveService = (serviceId: string) => {
    setProfile(prev => ({ ...prev, services: prev.services?.filter(s => s.id !== serviceId) }));
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPreviewImage(URL.createObjectURL(file));
      // TODO: Implement actual file upload
      setProfile(prev => ({ ...prev, photoURL: 'https://placehold.co/128x128.png' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({ title: 'Erro', description: 'Usuário não autenticado. Por favor, faça login novamente.', variant: 'destructive' });
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
      const barberRef = doc(db, 'barbers', user.uid);
      const finalAddress = { ...address, fullAddress: completeAddress };
      const dataToSave = { 
        ...profile, 
        address: finalAddress,
        coordinates: coordinates,
        profileComplete: true 
      };
      await setDoc(barberRef, dataToSave, { merge: true });

      toast({ title: 'Sucesso!', description: 'Perfil salvo com sucesso!' });
      router.push('/dashboard');
    } catch (error: any) {
      console.error("Erro ao salvar o perfil: ", error);
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
        <Header title="Configuração do Perfil de Barbeiro" showBackButton />
        <Card className="bg-card border-none shadow-lg mt-8">
          <CardHeader>
            <CardDescription>Complete seu perfil para que os clientes possam encontrá-lo.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-8">
              
              <Card className="p-6 bg-card border-none shadow-md">
                <CardTitle className="text-xl font-semibold text-primary mb-4">Informações Básicas</CardTitle>
                <div className="flex flex-col sm:flex-row items-start gap-6">
                  <div className="flex flex-col items-center flex-shrink-0">
                    <Image 
                      src={previewImage || 'https://placehold.co/128x128.png'} 
                      alt="Preview" 
                      width={128} height={128} 
                      className="w-32 h-32 rounded-full bg-muted mb-4 object-cover border-2 border-border"
                      data-ai-hint="barber portrait"
                    />
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                    <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                      <Icons.Upload className="mr-2 h-4 w-4" /> Enviar Foto
                    </Button>
                  </div>
                  <div className="flex-grow w-full space-y-2">
                    <Label htmlFor="description">Descrição / Biografia</Label>
                    <Textarea id="description" name="description" rows={4} value={profile.description || ''} onChange={handleChange} placeholder="Ex: Especialista em cortes clássicos e barba lenhador." />
                    <Button type="button" onClick={handleGenerateDescription} disabled={isGeneratingDesc} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                      {isGeneratingDesc ? <Icons.Spinner className="mr-2" /> : <Icons.Sparkles className="mr-2 h-4 w-4" />}
                      {isGeneratingDesc ? 'Gerando...' : 'Gerar Bio com IA'}
                    </Button>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-card border-none shadow-md">
                <CardTitle className="text-xl font-semibold text-primary mb-4">Localização</CardTitle>
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

              <Card className="p-6 bg-card border-none shadow-md">
                <CardTitle className="text-xl font-semibold text-primary mb-4 flex items-center gap-2"><Icons.Calendar /> Horários de Atendimento</CardTitle>
                <div className="space-y-4">
                  {profile.availability && Object.keys(profile.availability).map(day => (
                    <div key={day} className="grid grid-cols-1 sm:grid-cols-[1fr,2fr] gap-4 items-center p-3 bg-muted/50 rounded-md">
                      <div className="flex items-center">
                        <Switch id={`check-${day}`} checked={profile.availability![day].active} onCheckedChange={(checked) => handleAvailabilityChange(day, 'active', checked)} />
                        <Label htmlFor={`check-${day}`} className="ml-3 font-medium text-lg">{day}</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`start-${day}`} className="text-sm">De</Label>
                        <Input type="time" id={`start-${day}`} value={profile.availability![day].start} onChange={(e) => handleAvailabilityChange(day, 'start', e.target.value)} disabled={!profile.availability![day].active} className="w-full disabled:opacity-50" />
                        <Label htmlFor={`end-${day}`} className="text-sm">Até</Label>
                        <Input type="time" id={`end-${day}`} value={profile.availability![day].end} onChange={(e) => handleAvailabilityChange(day, 'end', e.target.value)} disabled={!profile.availability![day].active} className="w-full disabled:opacity-50" />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
              
              <Card className="p-6 bg-card border-none shadow-md">
                <CardTitle className="text-xl font-semibold text-primary mb-4 flex items-center gap-2"><Icons.Scissors /> Meu Catálogo de Serviços</CardTitle>
                
                <div className="space-y-4">
                    {profile.services?.map((service) => (
                        <div key={service.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
                            <div>
                                <p className="font-semibold">{service.name}</p>
                                <p className="text-sm text-muted-foreground">
                                    Preço: R$ {service.price.toFixed(2)} | Taxa Domicílio: R$ {service.atHomeFee.toFixed(2)}
                                </p>
                            </div>
                            <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveService(service.id)}>
                                <Icons.X className="h-4 w-4 text-destructive" />
                            </Button>
                        </div>
                    ))}
                </div>
                
                <div className="mt-6 pt-6 border-t border-border">
                    <p className="font-medium mb-2">Adicionar Novo Serviço</p>
                    <div className="grid grid-cols-1 sm:grid-cols-[2fr,1fr,1fr,auto] gap-4 items-end">
                        <div className='space-y-1'>
                            <Label htmlFor="service-name">Nome</Label>
                            <Input id="service-name" name="name" value={newService.name} onChange={handleNewServiceChange} placeholder="Corte de Cabelo" />
                        </div>
                         <div className='space-y-1'>
                            <Label htmlFor="service-price">Preço (R$)</Label>
                            <Input id="service-price" name="price" type="number" value={newService.price} onChange={handleNewServiceChange} placeholder="50.00" />
                        </div>
                         <div className='space-y-1'>
                            <Label htmlFor="service-fee">Taxa Domicílio (R$)</Label>
                            <Input id="service-fee" name="atHomeFee" type="number" value={newService.atHomeFee} onChange={handleNewServiceChange} placeholder="10.00" />
                        </div>
                        <Button type="button" onClick={handleAddService}>Adicionar</Button>
                    </div>
                </div>
              </Card>
              
              <Button type="submit" disabled={isLoading} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 text-base">
                 {isLoading && <Icons.Spinner className="mr-2 h-4 w-4" />}
                {isLoading ? 'Salvando...' : 'Salvar Perfil e Concluir'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

    