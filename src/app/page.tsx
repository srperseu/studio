'use client';

import { useAuth } from '@/hooks/use-auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect, FormEvent } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

import { Button } from '@/components/ui/button';
import { Input } from "@/components/ui/input";
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Icons } from '@/components/icons';

export default function LoginPage() {
  const { user, loading, signInWithEmail, signInWithGoogle, sendVerificationEmail } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showVerificationLink, setShowVerificationLink] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
        if (!user.emailVerified) {
          setShowVerificationLink(true);
          setError("Por favor, verifique seu e-mail antes de continuar.");
        } else {
            // Se o usuário estiver logado e verificado, o AuthGuard nas páginas protegidas cuidará do redirecionamento.
            // Por padrão, podemos tentar enviá-lo para o dashboard. O AuthGuard fará a correção se necessário.
            router.push('/dashboard');
        }
    }
  }, [user, loading, router]);
  
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setShowVerificationLink(false);
    setIsSubmitting(true);
    try {
      const userCredential = await signInWithEmail(email, password);
      if (userCredential.user && !userCredential.user.emailVerified) {
        setShowVerificationLink(true);
        setError("Seu e-mail ainda não foi verificado. Clique no link abaixo para reenviar o e-mail de verificação.");
      }
      // O useEffect cuidará do redirecionamento
    } catch (err: any) {
        if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
            setError('Credenciais inválidas. Verifique seu e-mail e senha.');
        } else {
            setError('Falha ao fazer login. Tente novamente mais tarde.');
        }
        console.error(err);
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const handleResendVerification = async () => {
    if (!user) {
        toast({ title: 'Erro', description: 'Você precisa estar logado para reenviar o e-mail.', variant: 'destructive'});
        return;
    }
    try {
        await sendVerificationEmail();
        toast({ title: 'Sucesso', description: 'E-mail de verificação reenviado!'});
        setShowVerificationLink(false);
        setError("Um novo e-mail foi enviado. Verifique sua caixa de entrada.");
    } catch (error) {
        toast({ title: 'Erro', description: 'Não foi possível reenviar o e-mail. Tente novamente mais tarde.', variant: 'destructive'});
    }
  }

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    try {
        await signInWithGoogle();
        // O redirecionamento será tratado pelo useEffect.
    } catch (err: any) {
        setError('Falha ao fazer login com o Google.');
        console.error(err);
    } finally {
        setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-background text-foreground">
          <div className="flex flex-col items-center gap-4">
            <Icons.Spinner className="h-8 w-8" />
            <h1 className="text-2xl font-headline">Carregando...</h1>
          </div>
        </div>
    );
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
          {showVerificationLink && (
             <Alert variant="destructive" className="mb-4">
               <Icons.Mail className="h-4 w-4" />
               <AlertTitle>Verificação Necessária</AlertTitle>
               <AlertDescription>
                 Seu e-mail não foi verificado. 
                 <button onClick={handleResendVerification} className="underline font-bold ml-1">Reenviar e-mail</button>
               </AlertDescription>
             </Alert>
          )}
          {error && !showVerificationLink && <p className="text-red-500 text-sm mb-4">{error}</p>}
          
          <form onSubmit={handleLogin} className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="m@example.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input 
                id="password" 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Icons.Spinner /> : 'Login'}
            </Button>
            <Button variant="outline" className="w-full" type="button" onClick={handleGoogleSignIn} disabled={isSubmitting}>
              {isSubmitting ? <Icons.Spinner /> : 'Login com Google'}
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
        </CardContent>
      </Card>
    </div>
  );
}
