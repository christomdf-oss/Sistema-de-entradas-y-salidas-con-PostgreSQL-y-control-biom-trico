'use client';
import { useEffect,useState } from 'react';
import { dataApi } from '@/lib/api';
import { SCHOOL_ID } from '@/lib/school';
import { useToast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/page-header';
import { Card,CardContent,CardHeader,CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from '@/components/ui/select';
export default function SettingsPage() {
  const {toast}=useToast();
  const [schoolName,setSchoolName]=useState('COBACAM');
  const [entry,setEntry]=useState('07:00');const [exit,setExit]=useState('14:00');
  const [sender,setSender]=useState('Control de Asistencia');
  const [uid,setUid]=useState('');const [role,setRole]=useState<'admin'|'staff'>('staff');
  const [busy,setBusy]=useState(false);
  useEffect(()=>{void dataApi<{settings:any}>('settings').then(({settings:v})=>{
    setSchoolName(v.schoolName||'COBACAM');setEntry(v.entryTime||'07:00');
    setExit(v.exitTime||'14:00');setSender(v.mailFromName||'Control de Asistencia');
  }).catch(()=>toast({variant:'destructive',title:'No se pudo cargar configuración PostgreSQL'}));},[toast]);
  async function save(){setBusy(true);try{
    await dataApi('settings',{method:'PUT',body:JSON.stringify({schoolName,entryTime:entry,exitTime:exit,mailFromName:sender})});
    toast({title:'Configuración guardada en PostgreSQL'});
  }catch(e){toast({variant:'destructive',title:'Error',description:e instanceof Error?e.message:'Error'});}finally{setBusy(false);}}
  async function addUser(){if(!uid.trim())return;
    if(!confirm(`Asignar rol ${role} al UID ${uid.trim()} de ${SCHOOL_ID}?`))return;
    try{
      await dataApi('users',{method:'POST',body:JSON.stringify({uid:uid.trim(),role})});
      setUid('');toast({title:'Permisos asignados en PostgreSQL'});
    }catch(e){toast({variant:'destructive',title:'Error',description:e instanceof Error?e.message:'Error'});}}
  return <main className="container mx-auto space-y-6 pb-10">
    <PageHeader title="Configuración del plantel" description={`Administración de ${SCHOOL_ID}. Solo administrador.`}/>
    <Card><CardHeader><CardTitle>Datos de la escuela</CardTitle></CardHeader><CardContent className="space-y-4">
      <div><Label>Nombre del plantel</Label><Input value={schoolName} onChange={e=>setSchoolName(e.target.value)}/></div>
      <div className="grid grid-cols-2 gap-4"><div><Label>Horario de entrada</Label><Input type="time" value={entry} onChange={e=>setEntry(e.target.value)}/></div>
        <div><Label>Horario de salida</Label><Input type="time" value={exit} onChange={e=>setExit(e.target.value)}/></div></div>
      <div><Label>Nombre del remitente de correos</Label><Input value={sender} onChange={e=>setSender(e.target.value)}/></div>
      <Button disabled={busy} onClick={()=>void save()}>Guardar configuración</Button>
      <p className="text-xs text-muted-foreground">Los horarios son informativos; no se aplican restricciones automáticas. El remitente efectivo del servicio Python se configura en docs/.env.</p>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Permisos de usuarios</CardTitle></CardHeader><CardContent className="space-y-3">
      <p className="text-sm">El usuario debe existir en Firebase Authentication (Google). Sus roles y permisos se almacenan en PostgreSQL.</p>
      <Label>UID de Firebase Authentication</Label><Input value={uid} onChange={e=>setUid(e.target.value)} placeholder="UID de la cuenta autorizada"/>
      <Label>Rol</Label><Select value={role} onValueChange={v=>setRole(v as 'admin'|'staff')}><SelectTrigger><SelectValue/></SelectTrigger>
        <SelectContent><SelectItem value="staff">Personal · asistencia</SelectItem><SelectItem value="admin">Administrador</SelectItem></SelectContent></Select>
      <Button onClick={()=>void addUser()}>Asignar permisos</Button>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Seguridad y respaldos</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
      <p>Firebase permanece solamente para iniciar sesión con Google. PostgreSQL local conserva el resto de los datos.</p>
      <p>Protege los respaldos y la clave BIOMETRIC_FERNET_KEY: sin ella no se recuperan las huellas.</p>
      <p>Antes de usar datos reales, sigue MIGRACION_POSTGRESQL.md. Nunca expongas PostgreSQL ni sus contraseñas en la página web.</p>
    </CardContent></Card>
  </main>;
}
