'use client';

import { SidebarTrigger } from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useAuth, useUser } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useRole } from '@/components/auth/use-role';
import { LogOut, ShieldCheck } from 'lucide-react';

const Header = () => {
  const auth = useAuth();
  const { user } = useUser();
  const { role } = useRole();
  return (
    <header className="cobacam-topbar sticky top-0 z-30 flex h-16 items-center gap-4 px-5 sm:px-8">
      <SidebarTrigger className="md:hidden" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">COBACAM · Plantel 10 Chicbul</p>
        <p className="hidden sm:block text-sm text-muted-foreground">Sistema de Entradas y Salidas</p>
      </div>
      <div className="hidden md:flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-xs text-slate-600"><ShieldCheck className="h-4 w-4 text-green-600" /> Acceso autorizado</div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="overflow-hidden rounded-full"
          >
            <Avatar>
              <AvatarImage src={user?.photoURL || undefined} />
              <AvatarFallback>
                A
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{user?.email || (role === "admin" ? "Administrador" : "Personal")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => signOut(auth)}>
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar Sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
};

export default Header;
