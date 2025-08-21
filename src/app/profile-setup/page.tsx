
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { generateBioAction, updateBarberSection } from '@/app/actions';


import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Icons } from '@/components/icons';
import type { Barber, GeoPoint, Address, Service, Availability } from '@/lib/types';
import { Header } from '@/components/header';
import { Switch } from '@/components/ui/switch';
import { Accordion } from '@/components/ui/accordion';
import { isEqual } from 'lodash';
import { ProfileAccordionItem } from '@/components/profile-accordion-item';

const defaultAvailability: Availability = {
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

const initialService: Service = { id: '', name: '', price: 0, atHomePrice: 0, duration: 60 };


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
  const barbershopFileInputRef = useRef<HTMLInputElement>(null);

  // States for data saved in DB
  const [savedProfile, setSavedProfile] = useState<Partial<Barber>>({});
  
  // States for current edits
  const [basicInfo, setBasicInfo] = useState({ description: '', photoURL: '' });
  const [address, setAddress] = useState<Address>(initialAddress);
  const [barbershopPhotos, setBarbershopPhotos] = useState<string[]>([]);
  const [availability, setAvailability] = useState<Availability>(defaultAvailability);
  const [services, setServices] = useState<Service[]>([]);

  const [newService, setNewService] = useState<Service>(initialService);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [barbershopPreviews, setBarbershopPreviews] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isCepLoading, setIsCepLoading] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);

  const [dirtySections, setDirtySections] = useState<Record<string, boolean>>({});

  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const fullAddressString = address.street ? `${address.street}, ${address.number}, ${address.neighborhood}, ${address.city} - ${address.state}` : '';


  const checkDirty = useCallback(() => {
    const dirty = {
      info: !isEqual(basicInfo, { description: savedProfile.description || '', photoURL: savedProfile.photoURL || '' }),
      address: !isEqual(address, savedProfile.address || initialAddress),
      photos: !isEqual(barbershopPhotos, savedProfile.barbershopPhotos || []),
      availability: !isEqual(availability, savedProfile.availability || defaultAvailability),
      services: !isEqual(services, savedProfile.services || []),
    };
    setDirtySections(dirty);
  }, [basicInfo, address, barbershopPhotos, availability, services, savedProfile]);

  useEffect(() => {
    checkDirty();
  }, [checkDirty]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (Object.values(dirtySections).some(d => d)) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirtySections]);

  useEffect(() => {
    if (user) {
      const fetchProfile = async () => {
        setIsPageLoading(true);
        const barberRef = doc(db, 'barbers', user.uid);
        const docSnap = await getDoc(barberRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as Barber;
          setSavedProfile(data); // Store the initial state
          setBasicInfo({ description: data.description || '', photoURL: data.photoURL || '' });
          setAddress(data.address || initialAddress);
          setBarbershopPhotos(data.barbershopPhotos || []);
          setAvailability(data.availability || defaultAvailability);
          setServices(data.services || []);

          if (data.photoURL) setPreviewImage(data.photoURL);
          if (data.barbershopPhotos) setBarbershopPreviews(data.barbershopPhotos);
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
  
  const handleSectionSave = async (section: string) => {
    if (!user) return;
    setIsLoading(true);
    let dataToSave: Partial<Barber> = {};
    let success = false;

    try {
        if (section === 'info') {
            dataToSave = basicInfo;
        } else if (section === 'address') {
            const completeAddress = `${address.street}, ${address.number}, ${address.neighborhood}, ${address.city} - ${address.state}`;
            const coordinates = await getCoordinatesForAddress(completeAddress, mapsApiKey);
            if (!coordinates) {
                 toast({ title: 'Aviso', description: 'Não foi possível encontrar as coordenadas. Verifique o endereço.', variant: 'destructive' });
            }
            dataToSave = { address: { ...address, fullAddress: completeAddress }, coordinates };
        } else if (section === 'photos') {
            dataToSave = { barbershopPhotos };
        } else if (section === 'availability') {
            dataToSave = { availability };
        } else if (section === 'services') {
            dataToSave = { services };
        }

        const result = await updateBarberSection(user.uid, dataToSave);

        if (result.success) {
            toast({ title: 'Sucesso!', description: 'Seção salva com sucesso!' });
            // Update savedProfile state to match new saved data
            setSavedProfile(prev => ({...prev, ...dataToSave}));
            success = true;
        } else {
            toast({ title: 'Erro', description: result.message, variant: 'destructive' });
        }
    } catch(error: any) {
        toast({ title: 'Erro', description: `Erro ao salvar: ${error.message}`, variant: 'destructive' });
    } finally {
        setIsLoading(false);
    }
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
                cep: e.target.value,
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
    if (!basicInfo.description) {
      toast({ title: 'Aviso', description: 'Insira palavras-chave sobre você na caixa de descrição.', variant: 'default' });
      return;
    }
    setIsGeneratingDesc(true);
    const result = await generateBioAction(basicInfo.description);
    if (result.success && result.bio) {
      setBasicInfo(prev => ({ ...prev, description: result.bio || '' }));
      toast({ title: 'Sucesso', description: 'Descrição gerada com IA!' });
    } else {
      toast({ title: 'Erro', description: result.message, variant: 'destructive' });
    }
    setIsGeneratingDesc(false);
  };
  
  const handleAvailabilityChange = (day: string, field: string, value: any) => {
    setAvailability(prev => ({ ...prev, [day]: { ...prev[day as keyof Availability], [field]: value } }));
  };
  
  const handleNewServiceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewService(prev => ({ ...prev, [name]: name === 'price' || name === 'atHomePrice' || name === 'duration' ? parseFloat(value) || 0 : value }));
  };

  const handleAddOrUpdateService = () => {
    if (!newService.name || newService.price <= 0) {
      toast({ title: 'Erro', description: 'Por favor, preencha o nome do serviço e um preço válido.', variant: 'destructive' });
      return;
    }
    
    if (editingServiceId) {
      // Update existing service
      setServices(prev => prev.map(s => s.id === editingServiceId ? { ...s, ...newService, id: editingServiceId } : s));
      toast({ title: 'Sucesso', description: 'Serviço atualizado!' });
    } else {
      // Add new service
      const serviceToAdd = { ...newService, id: newService.name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now() };
      setServices(prev => [...prev, serviceToAdd]);
    }
    
    setNewService(initialService); // Reset form
    setEditingServiceId(null); // Exit editing mode
  };

  const handleEditService = (service: Service) => {
    setEditingServiceId(service.id);
    setNewService({
        ...service,
        atHomePrice: service.atHomePrice || 0,
        duration: service.duration || 60,
    });
  };
  
  const handleCancelEdit = () => {
    setEditingServiceId(null);
    setNewService(initialService);
  };

  const handleRemoveService = (serviceId: string) => {
    setServices(prev => prev.filter(s => s.id !== serviceId));
    if(editingServiceId === serviceId) {
        handleCancelEdit();
    }
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPreviewImage(URL.createObjectURL(file));
      // TODO: Implement actual file upload
      setBasicInfo(prev => ({ ...prev, photoURL: 'https://placehold.co/128x128.png' }));
    }
  };

  const handleBarbershopFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const newPreviews = files.map(file => URL.createObjectURL(file));
      const newPhotoUrls = files.map((_, i) => `https://placehold.co/600x400.png?i=${Date.now() + i}`);
      
      setBarbershopPreviews(prev => [...prev, ...newPreviews]);
      // TODO: Implement actual file uploads
      setBarbershopPhotos(prev => ([...(prev || []), ...newPhotoUrls]));
    }
  };

  const removeBarbershopPhoto = (index: number) => {
    setBarbershopPreviews(prev => prev.filter((_, i) => i !== index));
    setBarbershopPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Object.values(dirtySections).some(d => d)) {
        toast({ title: 'Atenção', description: 'Você tem alterações não salvas. Salve cada seção antes de concluir.', variant: 'destructive'});
        return;
    }
    if (!user) return;
    
    setIsLoading(true);
    try {
        const barberRef = doc(db, 'barbers', user.uid);
        await setDoc(barberRef, { profileComplete: true }, { merge: true });
        toast({ title: 'Sucesso!', description: 'Perfil concluído!' });
        router.push('/dashboard');
    } catch(error: any) {
        toast({ title: 'Erro', description: `Erro ao finalizar perfil: ${error.message}`, variant: 'destructive' });
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
            <form onSubmit={handleFinalSubmit} className="space-y-4">
              
            <Accordion type="multiple" defaultValue={['item-1']} className="w-full space-y-4">
                
                <ProfileAccordionItem
                    value="item-1"
                    title="Informações Básicas"
                    icon={<Icons.User />}
                    isDirty={dirtySections.info}
                    onSave={() => handleSectionSave('info')}
                    isSaving={isLoading}
                >
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
                            <Textarea id="description" name="description" rows={4} value={basicInfo.description} onChange={(e) => setBasicInfo(p => ({...p, description: e.target.value}))} placeholder="Ex: Especialista em cortes clássicos e barba lenhador." />
                            <Button type="button" onClick={handleGenerateDescription} disabled={isGeneratingDesc} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                            {isGeneratingDesc ? <Icons.Spinner className="mr-2" /> : <Icons.Sparkles className="mr-2 h-4 w-4" />}
                            {isGeneratingDesc ? 'Gerando...' : 'Gerar Bio com IA'}
                            </Button>
                        </div>
                    </div>
                </ProfileAccordionItem>

                <ProfileAccordionItem
                    value="item-2"
                    title="Endereço"
                    icon={<Icons.MapPin />}
                    isDirty={dirtySections.address}
                    onSave={() => handleSectionSave('address')}
                    isSaving={isLoading}
                >
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
                </ProfileAccordionItem>

                <ProfileAccordionItem
                    value="item-3"
                    title="Minha Barbearia"
                    icon={<Icons.Home />}
                    isDirty={dirtySections.photos}
                    onSave={() => handleSectionSave('photos')}
                    isSaving={isLoading}
                >
                    <Label>Fotos do Estabelecimento</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-2">
                        {barbershopPreviews.map((src, index) => (
                            <div key={index} className="relative group">
                                <Image 
                                    src={src} 
                                    alt={`Foto da barbearia ${index + 1}`} 
                                    width={200} 
                                    height={150}
                                    className="w-full h-32 object-cover rounded-md border-2 border-border"
                                    data-ai-hint="barbershop interior"
                                />
                                <Button 
                                    type="button" 
                                    variant="destructive"
                                    size="icon" 
                                    className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => removeBarbershopPhoto(index)}>
                                    <Icons.X className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                            <Button 
                            type="button" 
                            variant="outline" 
                            className="w-full h-32 flex flex-col items-center justify-center border-dashed"
                            onClick={() => barbershopFileInputRef.current?.click()}>
                            <Icons.Upload className="h-6 w-6 mb-2" />
                            Adicionar Fotos
                        </Button>
                    </div>
                    <input type="file" ref={barbershopFileInputRef} onChange={handleBarbershopFileChange} multiple className="hidden" accept="image/*" />
                </ProfileAccordionItem>

                <ProfileAccordionItem
                    value="item-4"
                    title="Horários de Atendimento"
                    icon={<Icons.Calendar />}
                    isDirty={dirtySections.availability}
                    onSave={() => handleSectionSave('availability')}
                    isSaving={isLoading}
                >
                    <div className="space-y-4">
                    {Object.keys(availability).map(day => (
                        <div key={day} className="grid grid-cols-1 sm:grid-cols-[1fr,2fr] gap-4 items-center p-3 bg-muted/50 rounded-md">
                        <div className="flex items-center">
                            <Switch id={`check-${day}`} checked={availability[day as keyof Availability].active} onCheckedChange={(checked) => handleAvailabilityChange(day, 'active', checked)} />
                            <Label htmlFor={`check-${day}`} className="ml-3 font-medium text-lg">{day}</Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <Label htmlFor={`start-${day}`} className="text-sm">De</Label>
                            <Input type="time" id={`start-${day}`} value={availability[day as keyof Availability].start} onChange={(e) => handleAvailabilityChange(day, 'start', e.target.value)} disabled={!availability[day as keyof Availability].active} className="w-full disabled:opacity-50" />
                            <Label htmlFor={`end-${day}`} className="text-sm">Até</Label>
                            <Input type="time" id={`end-${day}`} value={availability[day as keyof Availability].end} onChange={(e) => handleAvailabilityChange(day, 'end', e.target.value)} disabled={!availability[day as keyof Availability].active} className="w-full disabled:opacity-50" />
                        </div>
                        </div>
                    ))}
                    </div>
                </ProfileAccordionItem>
                
                <ProfileAccordionItem
                    value="item-5"
                    title="Meu Catálogo de Serviços"
                    icon={<Icons.Scissors />}
                    isDirty={dirtySections.services}
                    onSave={() => handleSectionSave('services')}
                    isSaving={isLoading}
                >
                    <div className="space-y-4">
                        {Array.isArray(services) && services.map((service) => (
                            <div key={service.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
                                <div>
                                    <p className="font-semibold">{service.name} ({service.duration || 60} min)</p>
                                    <p className="text-sm text-muted-foreground">
                                        Preço: R$ {service.price.toFixed(2)} | Preço Domicílio: R$ {(service.atHomePrice || 0).toFixed(2)}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button type="button" variant="ghost" size="icon" onClick={() => handleEditService(service)}>
                                        <Icons.Pencil className="h-4 w-4 text-primary" />
                                    </Button>
                                    <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveService(service.id)}>
                                        <Icons.X className="h-4 w-4 text-destructive" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    <div className="mt-6 pt-6 border-t border-border">
                        <p className="font-medium mb-2">{editingServiceId ? 'Editando Serviço' : 'Adicionar Novo Serviço'}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-[2fr,1fr,1fr,1fr,auto] gap-4 items-end">
                            <div className='space-y-1'>
                                <Label htmlFor="service-name">Nome</Label>
                                <Input id="service-name" name="name" value={newService.name} onChange={handleNewServiceChange} placeholder="Corte de Cabelo" />
                            </div>
                            <div className='space-y-1'>
                                <Label htmlFor="service-price">Preço (R$)</Label>
                                <Input id="service-price" name="price" type="number" value={newService.price} onChange={handleNewServiceChange} placeholder="50.00" />
                            </div>
                            <div className='space-y-1'>
                                <Label htmlFor="service-atHomePrice">Preço Domicílio (R$)</Label>
                                <Input id="service-atHomePrice" name="atHomePrice" type="number" value={newService.atHomePrice || 0} onChange={handleNewServiceChange} placeholder="70.00" />
                            </div>
                            <div className='space-y-1'>
                                <Label htmlFor="service-duration">Duração (min)</Label>
                                <Input id="service-duration" name="duration" type="number" value={newService.duration || 60} onChange={handleNewServiceChange} placeholder="60" />
                            </div>
                            <Button type="button" onClick={handleAddOrUpdateService}>{editingServiceId ? 'Salvar' : 'Adicionar'}</Button>
                            {editingServiceId && (
                            <Button type="button" variant="ghost" onClick={handleCancelEdit}>Cancelar</Button>
                            )}
                        </div>
                    </div>
                </ProfileAccordionItem>
            </Accordion>
              
            <Button type="submit" disabled={isLoading} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 text-base mt-8">
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
