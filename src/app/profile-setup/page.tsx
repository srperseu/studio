'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { updateProfile, generateBioAction, getBarberProfile } from '@/app/actions';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Icons } from '@/components/icons';
import type { Barber } from '@/lib/types';

const defaultAvailability = {
  'Segunda': { active: false, start: '09:00', end: '18:00' },
  'Terça': { active: true, start: '09:00', end: '18:00' },
  'Quarta': { active: true, start: '09:00', end: '18:00' },
  'Quinta': { active: true, start: '09:00', end: '18:00' },
  'Sexta': { active: true, start: '09:00', end: '18:00' },
  'Sábado': { active: true, start: '10:00', end: '20:00' },
  'Domingo': { active: false, start: '09:00', end: '18:00' },
};

export default function ProfileSetupPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<Partial<Barber>>({
    photoURL: '',
    description: '',
    address: '',
    availability: defaultAvailability,
    services: {
      inShop: { active: true, price: '' },
      atHome: { active: false, price: '' },
    },
  });
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
        router.replace('/login');
        return;
    }
    if (user) {
      const fetchProfile = async () => {
        setIsPageLoading(true);
        const result = await getBarberProfile(user.uid);
        if (result.success && result.data) {
          const data = result.data as Barber;
          setProfile(prev => ({
             ...prev, 
             ...data,
             availability: data.availability || defaultAvailability,
             services: data.services || { inShop: { active: true, price: '' }, atHome: { active: false, price: '' } }
            }));
          if (data.photoURL) setPreviewImage(data.photoURL);
        }
        setIsPageLoading(false);
      };
      fetchProfile();
    }
  }, [user, authLoading, router]);

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
  const handleServiceChange = (type: 'inShop' | 'atHome', field: string, value: any) => {
    setProfile(prev => ({ ...prev, services: { ...prev.services, [type]: { ...prev.services![type], [field]: value } } }));
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPreviewImage(URL.createObjectURL(file));
      // In a real app, you would upload the file to Firebase Storage and get a URL.
      // For this demo, we'll use a placeholder URL.
      setProfile(prev => ({ ...prev, photoURL: 'https://placehold.co/128x128.png' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsLoading(true);
    const result = await updateProfile(user.uid, profile);
    if (result.success) {
      toast({ title: 'Sucesso!', description: result.message });
      router.push('/dashboard');
    } else {
      toast({ title: 'Erro', description: result.message, variant: 'destructive' });
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
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-3xl font-bold font-headline">Configuração do Perfil</CardTitle>
            <CardDescription>Complete seu perfil para que os clientes possam encontrá-lo.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-8">
              
              <Card className="p-6 bg-muted/50 border-border">
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
                    <Button type="button" onClick={handleGenerateDescription} disabled={isGeneratingDesc} className="w-full bg-accent hover:bg-accent/90">
                      {isGeneratingDesc ? <Icons.Spinner className="mr-2" /> : <Icons.Sparkles className="mr-2 h-4 w-4" />}
                      {isGeneratingDesc ? 'Gerando...' : 'Gerar Bio com IA'}
                    </Button>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-muted/50 border-border">
                <CardTitle className="text-xl font-semibold text-primary mb-4">Localização</CardTitle>
                <Label htmlFor="address">Endereço da Barbearia</Label>
                <div className="relative mt-2">
                  <Icons.MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input type="text" id="address" name="address" value={profile.address || ''} onChange={handleChange} placeholder="Rua, Número, Bairro, Cidade - Estado" className="w-full pl-10" />
                </div>
                <div className="mt-4 h-48 bg-muted rounded-lg flex items-center justify-center text-muted-foreground border border-border">
                  Simulação do Mapa (API do Google Maps)
                </div>
              </Card>

              <Card className="p-6 bg-muted/50 border-border">
                <CardTitle className="text-xl font-semibold text-primary mb-4 flex items-center gap-2"><Icons.Calendar /> Horários de Atendimento</CardTitle>
                <div className="space-y-4">
                  {Object.keys(profile.availability!).map(day => (
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
              
              <Card className="p-6 bg-muted/50 border-border">
                <CardTitle className="text-xl font-semibold text-primary mb-4 flex items-center gap-2"><Icons.Scissors /> Serviços e Preços</CardTitle>
                <div className="space-y-4">
                  <div className="p-3 bg-muted/50 rounded-md">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center">
                        <Switch id="inShop" checked={profile.services!.inShop.active} onCheckedChange={(checked) => handleServiceChange('inShop', 'active', checked)} />
                        <Label htmlFor="inShop" className="ml-3 font-medium flex items-center gap-2"><Icons.User /> Atendimento na Barbearia</Label>
                      </div>
                      <div className="relative w-36">
                        <Icons.DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input type="number" placeholder="Preço" value={profile.services!.inShop.price} onChange={(e) => handleServiceChange('inShop', 'price', e.target.value)} disabled={!profile.services!.inShop.active} className="w-full pl-10 disabled:opacity-50" />
                      </div>
                    </div>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-md">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center">
                        <Switch id="atHome" checked={profile.services!.atHome.active} onCheckedChange={(checked) => handleServiceChange('atHome', 'active', checked)} />
                        <Label htmlFor="atHome" className="ml-3 font-medium flex items-center gap-2"><Icons.Home /> Atendimento em Domicílio</Label>
                      </div>
                      <div className="relative w-36">
                        <Icons.DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input type="number" placeholder="Preço" value={profile.services!.atHome.price} onChange={(e) => handleServiceChange('atHome', 'price', e.target.value)} disabled={!profile.services!.atHome.active} className="w-full pl-10 disabled:opacity-50" />
                      </div>
                    </div>
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
