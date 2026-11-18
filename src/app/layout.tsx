import type { Metadata } from 'next';
import './globals.css';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/toaster';
import { SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from '@/components/layout/sidebar';
import Header from '@/components/layout/header';
import AuthProvider from '@/components/auth/AuthProvider';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { StudentsProvider } from '@/components/data/students-provider';
import { TodayAttendanceProvider } from '@/components/data/today-attendance-provider';

export const metadata: Metadata = {
  title: 'Sistema de Entradas y Salidas | COBACAM Plantel 10 Chicbul',
  description: 'Sistema de Entradas y Salidas del COBACAM Plantel 10 Chicbul',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/branding/cobacam-plantel10.jpg" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={cn('font-body antialiased', 'min-h-screen bg-background font-sans')}>
        <FirebaseClientProvider>
          <AuthProvider><StudentsProvider><TodayAttendanceProvider><SidebarProvider>
            <AppSidebar />
            <div className="flex-1 flex flex-col">
              <Header />
              <main className="flex-1 p-4 md:p-8 pt-6">
                {children}
              </main>
            </div>
            <Toaster />
          </SidebarProvider></TodayAttendanceProvider></StudentsProvider></AuthProvider>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
