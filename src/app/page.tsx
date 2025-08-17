
'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showVerificationLink, setShowVerificationLink] = useState(false);
  const { user, loading, signInWithEmail, signInWithGoogle, sendVerificationEmail } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (user && user.emailVerified) {
        router.replace('/dashboard');
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
        setIsSubmitting(false);
        return;
      }
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential') {
        setError('Credenciais inválidas. Verifique seu e-mail e senha.');
      } else {
        setError('Ocorreu um erro inesperado. Tente novamente.');
      }
    } finally {
      if (!showVerificationLink) {
        setIsSubmitting(false);
      }
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error: any) {
      setError(`Erro ao logar com Google: ${error.message}`);
    }
  };

  const handleResendVerification = async () => {
    try {
        await sendVerificationEmail();
        setError("E-mail de verificação reenviado. Verifique sua caixa de entrada.");
    } catch (error: any) {
        setError("Falha ao reenviar o e-mail de verificação.");
    }
  };
  
  if (loading || (user && user.emailVerified)) {
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
    <main className="flex min-h-screen w-full items-center justify-center bg-background p-4 font-body">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
            <h1 className="text-5xl font-bold font-headline text-primary">BarberFlow</h1>
            <p className="text-muted-foreground mt-2">Faça login ou cadastre-se para continuar</p>
        </div>
        <Card className="bg-card border-none shadow-lg">
          <CardHeader>
            <CardTitle>Login</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
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
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              
              {error && (
                 <Alert variant="destructive" className="text-sm">
                    <AlertDescription>{error}</AlertDescription>
                    {showVerificationLink && (
                        <button onClick={handleResendVerification} className="underline font-bold mt-2 block">
                            Reenviar e-mail
                        </button>
                    )}
                 </Alert>
              )}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? <Icons.Spinner /> : 'Login'}
              </Button>
            </form>
            
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Ou continue com</span>
              </div>
            </div>

            <Button variant="outline" className="w-full" onClick={handleGoogleSignIn}>
              <Icons.Mail className="mr-2 h-4 w-4" /> {/* Using Mail as placeholder for Google icon */}
              Login com Google
            </Button>
            
            <div className="mt-4 text-center text-sm">
              Não tem uma conta?{' '}
              <Link href="/signup" className="underline hover:text-primary">
                Cadastre-se
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
