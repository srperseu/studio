
'use client';

import { useRouter } from 'next/navigation';
import { useState, FormEvent } from 'react';
import { useAuth } from '@/hooks/use-auth';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function SignUpClientPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'form' | 'verify'>('form');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { signUpClientWithEmail } = useAuth();

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
     if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setIsSubmitting(true);
    try {
      await signUpClientWithEmail(email, password, fullName, phone);
      setStep('verify');
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('Este e-mail já está em uso.');
      } else {
        setError('Falha ao criar a conta. Tente novamente.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (step === 'verify') {
    return (
       <main className="flex min-h-screen w-full items-center justify-center bg-background p-4 font-body">
         <Card className="w-full max-w-sm text-center border-none shadow-lg">
            <CardHeader>
                <CardTitle className="text-2xl">Verifique seu E-mail</CardTitle>
            </CardHeader>
            <CardContent>
                <Icons.Mail className="mx-auto h-12 w-12 text-primary mb-4" />
                <AlertDescription>
                    Enviamos um link de verificação para <strong>{email}</strong>. Por favor, clique no link para ativar sua conta de cliente.
                </AlertDescription>
                <Button onClick={() => router.push('/')} className="w-full mt-6">
                    Ir para o Login
                </Button>
            </CardContent>
         </Card>
       </main>
    )
  }

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-background p-4 font-body">
      <Card className="w-full max-w-sm border-none shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl">Cadastro de Cliente</CardTitle>
          <CardDescription>Crie sua conta para agendar seu horário.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="fullName">Nome Completo</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Seu nome"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
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
            <div className="grid gap-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input 
                id="phone" 
                type="tel" 
                placeholder="(00) 00000-0000" 
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required 
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm-password">Confirmar Senha</Label>
              <Input
                id="confirm-password"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            {error && (
              <Alert variant="destructive" className="text-sm">
                <AlertDescription>{error}</AlertDescription>
                {error.includes('em uso') && (
                  <div className='mt-2'>
                    <Link href="/" className="underline font-semibold hover:text-primary">
                      Fazer login?
                    </Link>
                  </div>
                )}
              </Alert>
            )}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Icons.Spinner /> : 'Criar conta'}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            Já tem uma conta?{" "}
            <Link href="/" className="underline">
              Login
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
