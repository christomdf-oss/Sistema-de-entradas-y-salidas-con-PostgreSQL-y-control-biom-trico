'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useRole } from './use-role';
export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useRole();
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (loading) return;
    if (!user && pathname !== '/login') router.replace('/login');
    else if (user && !role && pathname !== '/access-pending') router.replace('/access-pending');
    else if (user && role && (pathname === '/login' || pathname === '/access-pending')) router.replace('/');
    else if (role !== 'admin' && (pathname === '/students' || pathname === '/settings' || pathname === '/communities')) router.replace('/');
  }, [user, role, loading, pathname, router]);
  if (loading) return <div className="p-10 text-center">Verificando acceso…</div>;
  if (pathname === '/login' && !user) return <>{children}</>;
  if (pathname === '/access-pending' && user && !role) return <>{children}</>;
  if (!user || !role || (role !== 'admin' && ['/students','/settings','/communities'].includes(pathname))) return null;
  return <>{children}</>;
}
