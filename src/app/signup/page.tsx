'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { signUp } from '@/app/actions';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icons } from '@/components/icons';

export default function SignUpPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      setIsLoading(false);
      return;
    }
    
    const result = await signUp({ fullName, email, phone, password });
    if (result.success) {
      toast({
        title: 'Sucesso!',
        description: result.message,
      });
      router.push('/login');
    } else {
      toast({
        title: 'Erro no Cadastro',
        description: result.message,
        variant: 'destructive',
      });
      setError(result.message ?? 'Ocorreu um erro.');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-center items-center p-4">
      <Card className="w-full max-w-md bg-card border-border">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold font-headline">Cadastro de Barbeiro</CardTitle>
          <CardDescription>Crie sua conta para começar</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome Completo</Label>
              <div className="relative">
                <Icons.User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input 
                  id="fullName" 
                  placeholder="Seu nome" 
                  className="pl-10" 
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
            </div>
             <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                    <Icons.Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input 
                      id="email" 
                      type="email" 
                      placeholder="seu@email.com" 
                      className="pl-10" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required 
                    />
                </div>
            </div>
             <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <div className="relative">
                    <Icons.Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input 
                      id="phone" 
                      type="tel" 
                      placeholder="(00) 00000-0000" 
                      className="pl-10" 
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required 
                    />
                </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Icons.Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input 
                  id="password" 
                  type="password" 
                  placeholder="••••••••" 
                  className="pl-10" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
                />
              </div>
            </div>
            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
            <Button type="submit" disabled={isLoading} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 text-base">
              {isLoading && <Icons.Spinner className="mr-2 h-4 w-4" />}
              {isLoading ? 'Cadastrando...' : 'Cadastrar'}
            </Button>
          </form>
          <p className="text-center mt-6">
            Já tem uma conta?{' '}
            <Link href="/login" className="text-primary hover:underline font-semibold">
              Faça Login
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
