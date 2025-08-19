
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const signUpSchema = z.object({
  fullName: z.string().min(3, { message: "O nome deve ter pelo menos 3 caracteres." }),
  email: z.string().email({ message: "Por favor, insira um e-mail válido." }),
  phone: z.string().min(10, { message: "Por favor, insira um telefone válido." }),
  password: z.string().min(6, { message: "A senha deve ter pelo menos 6 caracteres." }),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: "As senhas não coincidem.",
  path: ["confirmPassword"],
});

type SignUpFormValues = z.infer<typeof signUpSchema>;


export default function SignUpClientPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'form' | 'verify'>('form');
  const { signUpClientWithEmail } = useAuth();
  
  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: ''
    }
  });

  const { isSubmitting } = form.formState;

  const handleSignup = async (data: SignUpFormValues) => {
    setError(null);
    try {
      await signUpClientWithEmail(data.email, data.password, data.fullName, data.phone);
      setStep('verify');
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        form.setError('email', { type: 'manual', message: 'Este e-mail já está em uso.' });
      } else {
        setError('Falha ao criar a conta. Tente novamente.');
      }
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
                    Enviamos um link de verificação para <strong>{form.getValues('email')}</strong>. Por favor, clique no link para ativar sua conta de cliente.
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
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSignup)} className="grid gap-4">
               <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome Completo</FormLabel>
                    <FormControl>
                      <Input placeholder="Seu nome" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="seu@email.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="(00) 00000-0000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Senha</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmar Senha</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
          </Form>
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
