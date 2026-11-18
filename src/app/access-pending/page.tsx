'use client';
import { useAuth, useUser } from '@/firebase';
import { signOut } from 'firebase/auth';
import { Button } from '@/components/ui/button';
export default function AccessPendingPage() {
 const { user } = useUser(); const auth = useAuth();
 return <main className="mx-auto max-w-xl py-16 space-y-5"><h1 className="text-2xl font-bold">Cuenta sin autorización</h1>
 <p>Tu cuenta {user?.email} inició sesión, pero el administrador del plantel todavía no te asignó un rol activo.</p>
 <p>Solicita al administrador que registre tu UID en la colección de usuarios del sistema. Por seguridad nadie obtiene permisos automáticamente.</p>
 <p className="text-xs break-all">UID: {user?.uid}</p><Button onClick={()=>signOut(auth)}>Cerrar sesión</Button></main>;
}
