'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { signIn } from '@/app/actions';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icons } from '@/components/icons';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    const result = await signIn({ email, password });
    
    if (result.success) {
      toast({
        title: 'Sucesso!',
        description: result.message,
      });
      if (result.profileComplete) {
        router.push('/dashboard');
      } else {
        router.push('/profile-setup');
      }
    } else {
      toast({
        title: 'Erro de Login',
        description: result.message,
        variant: 'destructive',
      });
      setError(result.message ?? 'Ocorreu um erro.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-center items-center p-4">
      <Card className="w-full max-w-md bg-card border-border">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold font-headline">Login do Barbeiro</CardTitle>
          <CardDescription>Acesse seu painel de controle</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
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
              {isLoading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
          <div className="text-center mt-6 space-y-2">
            <p>
              Não tem uma conta?{' '}
              <Link href="/signup" className="text-primary hover:underline font-semibold">
                Cadastre-se
              </Link>
            </p>
            <p>
              <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
                Ver como cliente
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
