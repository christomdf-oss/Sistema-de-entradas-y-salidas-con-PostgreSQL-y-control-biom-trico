'use client';
import {
  GoogleAuthProvider,
  signInWithPopup,
  User,
} from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/firebase';

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 48 48"
        width="24px"
        height="24px"
        {...props}
      >
        <path
          fill="#FFC107"
          d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"
        />
        <path
          fill="#FF3D00"
          d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"
        />
        <path
          fill="#4CAF50"
          d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.223,0-9.651-3.356-11.303-8H4.389c2.834,7.832,10.608,12,19.611,12z"
        />
        <path
          fill="#1976D2"
          d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C39.998,36.983,44,31.1,44,24C44,22.659,43.862,21.35,43.611,20.083z"
        />
      </svg>
    );
}

export default function LoginPage() {
  const auth = useAuth();
  const router = useRouter();

  const handleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      router.push('/');
    } catch (error) {
      console.error('Error signing in with Google', error);
    }
  };

  return (
    <div className="cobacam-login-shell flex min-h-[calc(100vh-4rem)] items-center justify-center p-5">
      <Card className="cobacam-login-card w-full max-w-md overflow-hidden border-0">
        <div className="flex justify-center bg-gradient-to-r from-[#3e061a] to-[#890c35] px-6 py-7">
          <img className="h-36 w-36 rounded-2xl object-cover" src="/branding/cobacam-plantel10.jpg" alt="COBACAM Plantel 10 Chicbul" />
        </div>
        <CardHeader className="text-center space-y-3 pt-8">
          <p className="text-xs font-bold uppercase tracking-[.17em] text-primary">COBACAM · Plantel 10 Chicbul</p>
          <CardTitle className="text-3xl font-extrabold tracking-tight">Sistema de Entradas y Salidas</CardTitle>
          <CardDescription>Control escolar y asistencia biométrica. Acceso exclusivo para personal autorizado.</CardDescription>
        </CardHeader>
        <CardContent className="pb-9 pt-3">
          <Button onClick={handleSignIn} className="h-12 w-full rounded-xl font-semibold">
            <GoogleIcon className="mr-3" /> Continuar con Google
          </Button>
          <p className="mt-5 text-center text-xs text-muted-foreground">Plantel 10 Chicbul · Carmen, Campeche</p>
        </CardContent>
      </Card>
    </div>
  );
}
