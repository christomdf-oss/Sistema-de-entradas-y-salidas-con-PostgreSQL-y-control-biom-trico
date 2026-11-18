'use client';

import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  Users,
  History,
  FileText,
  PenSquare,
  Settings, Fingerprint,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useRole } from '@/components/auth/use-role';
import { Separator } from '../ui/separator';

const AppSidebar = () => {
  const pathname = usePathname();
  const { isAdmin } = useRole();

  const menuItems = [
    { href: '/', label: 'Panel de Control', icon: LayoutDashboard },
    ...(isAdmin ? [{ href: '/students', label: 'Alumnos', icon: Users }] : []),
    { href: '/attendance', label: 'Asistencia', icon: History },
    { href: '/biometrics', label: 'Control Biométrico', icon: Fingerprint },
    { href: '/reports', label: 'Reportes', icon: FileText },
    { href: '/manual-entry', label: 'Asistencia manual', icon: PenSquare },
    ...(isAdmin ? [{ href: '/settings', label: 'Configuración', icon: Settings }] : []),
  ];

  return (
    <Sidebar
      className="cobacam-sidebar border-r"
      collapsible="icon"
      variant="sidebar"
    >
      <SidebarHeader className="cobacam-brand-area">
        <Link href="/" className="brand-link" aria-label="Sistema de Entradas y Salidas, inicio">
          <img src="/branding/cobacam-plantel10.jpg" alt="Logo COBACAM Plantel 10 Chicbul" className="brand-logo" />
          <span className="brand-system-name">Sistema de Entradas y Salidas</span>
        </Link>
      </SidebarHeader>
      <SidebarContent className="cobacam-menu-content">
        <SidebarMenu className="px-3 py-5 gap-1.5">
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={pathname === item.href}
                className="cobacam-menu-button"
                tooltip={{ children: item.label, side: 'right' }}
              >
                <Link href={item.href}>
                  <item.icon />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
        <div className="brand-sidebar-footer group-data-[collapsible=icon]:hidden">
          <div className="font-semibold">COBACAM · Plantel 10 Chicbul</div>
          <div>Sistema de Entradas y Salidas</div>
        </div>
      </SidebarContent>
    </Sidebar>
  );
};

export default AppSidebar;
