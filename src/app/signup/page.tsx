
'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-background p-4 font-body">
      <Card className="mx-auto max-w-md w-full border-none shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Junte-se ao BarberFlow</CardTitle>
          <CardDescription>Você é um barbeiro ou um cliente?</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Link href="/signup/barber">
            <Button variant="outline" className="w-full h-20 text-lg transition-colors hover:border-primary hover:bg-primary/5">
              <Icons.Scissors className="mr-4 h-8 w-8" />
              Sou Barbeiro
            </Button>
          </Link>
          <Link href="/signup/client">
            <Button variant="outline" className="w-full h-20 text-lg transition-colors hover:border-primary hover:bg-primary/5">
              <Icons.User className="mr-4 h-8 w-8" />
              Sou Cliente
            </Button>
          </Link>
          <div className="mt-4 text-center text-sm">
            Já tem uma conta?{" "}
            <Link href="/" className="underline hover:text-primary">
              Login
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
