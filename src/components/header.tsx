import Link from 'next/link';
import { Button } from './ui/button';
import { UserNav } from './user-nav';
import { Icons } from './icons';

interface HeaderProps {
  title: string;
  showBackButton?: boolean;
}

export function Header({ title, showBackButton = false }: HeaderProps) {
  return (
    <header className="flex justify-between items-center mb-8">
      <div className="flex items-center gap-4">
        {showBackButton && (
          <Link href="/dashboard" passHref>
            <Button variant="outline" size="icon" aria-label="Voltar para o Dashboard">
              <Icons.ChevronLeft />
            </Button>
          </Link>
        )}
        <h1 className="text-3xl font-bold font-headline">{title}</h1>
      </div>
      <UserNav />
    </header>
  );
}
