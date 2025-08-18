
import Link from 'next/link';
import { Button } from './ui/button';
import { UserNav } from './user-nav';
import { Icons } from './icons';

interface HeaderProps {
  title: string;
  showBackButton?: boolean;
  onBackClick?: () => void;
}

export function Header({ title, showBackButton = false, onBackClick }: HeaderProps) {
  const BackButton = () => (
    <Button 
      variant="outline" 
      size="icon" 
      aria-label="Voltar" 
      onClick={onBackClick}
      className="border-primary/50 text-primary hover:bg-primary/10 hover:text-primary"
    >
      <Icons.ChevronLeft />
    </Button>
  );

  return (
    <header className="flex justify-between items-center mb-8">
      <div className="flex items-center gap-4">
        {showBackButton && (
          onBackClick ? (
            <BackButton />
          ) : (
            <Link href="/dashboard" passHref>
              <BackButton />
            </Link>
          )
        )}
        <h1 className="text-3xl font-bold font-headline">{title}</h1>
      </div>
      <UserNav />
    </header>
  );
}
