'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Fingerprint } from 'lucide-react';
import type { Student } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/firebase';
import { SCHOOL_ID } from '@/lib/school';
export function EnrollFingerprintDialog({ student, onClose }: {student: Student; onClose: ()=>void}) {
 const [waiting,setWaiting]=useState(false);
 const [status,setStatus]=useState('');
 const auth=useAuth(); const { toast }=useToast();
 const enroll=async()=>{
   const user=auth.currentUser;
   if (!user) { toast({ variant:'destructive',title:'Inicia sesión' }); return; }
   setWaiting(true); setStatus('Coloca el mismo dedo cuatro veces y retíralo completamente entre capturas (máximo 90 segundos)…');
   try {
     const token=await user.getIdToken();
     const response=await fetch(`${(process.env.NEXT_PUBLIC_KIOSK_URL || 'http://127.0.0.1:5000').replace(/\/+$/, '')}/api/enroll`, {
       method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
       body:JSON.stringify({studentId:student.id,schoolId:SCHOOL_ID})
     });
     const result=await response.json();
     if (!response.ok || !result.success) throw new Error(result.error||'No fue posible registrar la huella');
     toast({title:'Huella guardada',description:result.warning || 'Cuatro capturas completadas. Se guardó una plantilla y se actualizó el lector.'});
     onClose();
   } catch(e:any){toast({variant:'destructive',title:'Error biométrico',description:e.message});}
   finally {setWaiting(false);setStatus('');}
 };
 return <Dialog open onOpenChange={(open)=>{if(!open&&!waiting)onClose();}}><DialogContent>
   <DialogHeader><DialogTitle className="flex items-center gap-2"><Fingerprint/>{student.enrollmentStatus === 'done'?'Reemplazar huella':'Registrar huella'}</DialogTitle>
   <DialogDescription>{student.nombre || student.matricula || student.id}. El servidor biométrico debe estar funcionando en esta misma computadora. Tres capturas crean una plantilla y la cuarta comprueba que coincide.</DialogDescription></DialogHeader>
   <p className="text-sm">No necesitas borrar el perfil ni copiar la matrícula. La huella nueva reemplazará la anterior cuando el registro termine exitosamente.</p>
   {waiting&&<p className="text-sm">{status}</p>}
   <DialogFooter><Button variant="outline" onClick={onClose} disabled={waiting}>Cancelar</Button><Button disabled={waiting} onClick={enroll}>{waiting?'Registrando…':student.enrollmentStatus === 'done'?'Reemplazar huella':'Iniciar registro'}</Button></DialogFooter>
 </DialogContent></Dialog>;
}
