'use client';

import { useAuth } from '@/hooks/use-auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect, FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from "@/components/ui/input";
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';


export default function LoginPage() {
  // Obtém o usuário, o estado de carregamento e as funções do hook de autenticação
  const { user, loading, signInWithEmail, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Efeito que redireciona o usuário se ele já estiver logado
  useEffect(() => {
    // A condição !loading garante que o redirecionamento só ocorra
    // após a verificação inicial do estado de autenticação.
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await signInWithEmail(email, password);
      // O redirecionamento agora é tratado pelo useEffect.
      // A linha router.push('/dashboard') foi removida daqui.
    } catch (err: any) {
      setError('Falha ao fazer login. Verifique suas credenciais.');
      console.error(err);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
        await signInWithGoogle();
        // O redirecionamento também será tratado pelo useEffect.
    } catch (err: any) {
        setError('Falha ao fazer login com o Google.');
        console.error(err);
    }
  };

  // Exibe um estado de carregamento enquanto o status de autenticação é verificado
  if (loading) {
    return <div className="flex justify-center items-center h-screen">Carregando...</div>;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="mx-auto max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>
            Entre com seu email e senha para acessar sua conta
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="m@example.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required 
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="flex items-center">
              </div>
                <Input 
                  id="password" 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <Button type="submit" className="w-full">
              Login
            </Button>
            <Button variant="outline" className="w-full" type="button" onClick={handleGoogleSignIn}>
              Login com Google
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            <p>
              Não tem uma conta?{" "}
              <Link href="/signup" className="text-primary hover:underline font-semibold">
                Cadastre-se
              </Link>
            </p>
          </div>
          <div className="text-center mt-6 space-y-2">

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
