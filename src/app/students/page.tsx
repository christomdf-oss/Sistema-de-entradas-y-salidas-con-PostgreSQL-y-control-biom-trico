'use client';
import * as React from 'react';
import * as XLSX from 'xlsx';
import { PlusCircle, RefreshCw, Upload, MapPin, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog,DialogContent,DialogTitle,DialogDescription,DialogTrigger } from '@/components/ui/dialog';
import { DataTable } from './data-table';
import { getColumns } from './columns';
import { StudentForm } from './student-form';
import { EnrollFingerprintDialog } from './enroll-fingerprint-dialog';
import { PageHeader } from '@/components/page-header';
import { useStudents } from '@/components/data/students-provider';
import { useRole } from '@/components/auth/use-role';
import { useAuth } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { dataApi } from '@/lib/api';
import { SCHOOL_ID } from '@/lib/school';
import type { Student } from '@/lib/types';

type StudentFormValues = Parameters<typeof StudentForm>[0]['onSubmit'] extends (data: infer T) => void ? T : never;
const initialComunidades=['CHICBUL','PLAN DE AYALA','JOBAL','CHECKOBUL'];

export default function StudentsPage() {
  const auth=useAuth();
  const {students,loading,refreshStudents}=useStudents();
  const {isAdmin}=useRole();
  const {toast}=useToast();
  const fileInput=React.useRef<HTMLInputElement>(null);
  const [isFormOpen,setIsFormOpen]=React.useState(false);
  const [editingStudent,setEditingStudent]=React.useState<Student|null>(null);
  const [studentToDelete,setStudentToDelete]=React.useState<Student|null>(null);
  const [enrollmentStudent,setEnrollmentStudent]=React.useState<Student|null>(null);
  const [pendingRows,setPendingRows]=React.useState<StudentFormValues[]>([]);
  const [isImporting,setIsImporting]=React.useState(false);
  const [comunidades,setComunidades]=React.useState(initialComunidades);
  const [communitiesOpen,setCommunitiesOpen]=React.useState(false);
  const [newCommunityName,setNewCommunityName]=React.useState('');

  const refresh=React.useCallback(async()=>{
    try{await refreshStudents();}catch(e){toast({variant:'destructive',title:'No se pudieron actualizar alumnos',description:e instanceof Error?e.message:'Error'});}
  },[refreshStudents,toast]);
  const loadCommunities=React.useCallback(async()=>{
    try{const result=await dataApi<{communities:string[]}>('communities');
      setComunidades([...new Set([...initialComunidades,...result.communities])].sort());}
    catch(e){console.error('Error cargando comunidades',e);}
  },[]);
  React.useEffect(()=>{void loadCommunities();},[loadCommunities]);
  const closeForm=()=>{setIsFormOpen(false);setEditingStudent(null);};
  const handleFormSubmit=async(data:StudentFormValues)=>{
    try{
      await dataApi(editingStudent?`students/${encodeURIComponent(editingStudent.id)}`:'students',{
        method:editingStudent?'PATCH':'POST',body:JSON.stringify(data)});
      closeForm();await refresh();
      toast({title:editingStudent?'Alumno actualizado':'Alumno registrado',description:data.nombre});
    }catch(e){toast({variant:'destructive',title:'No se guardó el alumno',description:e instanceof Error?e.message:'Error'});}
  };
  const handleDeleteStudent=async()=>{
    if(!studentToDelete||!isAdmin)return;
    try{
      await dataApi(`students/${encodeURIComponent(studentToDelete.id)}`,{method:'DELETE'});
      toast({title:'Alumno desactivado',description:'Asistencias históricas conservadas. Sincroniza el lector antes de usarlo.'});
      await refresh();
    }catch(e){toast({variant:'destructive',title:'Error',description:e instanceof Error?e.message:'Error'});}
    finally{setStudentToDelete(null);}
  };
  const handleRemoveFingerprint=async(student:Student)=>{
    if(!isAdmin||!confirm(`¿Borrar la plantilla biométrica de ${student.nombre}? Sus asistencias históricas se conservarán.`))return;
    try{
      const token=await auth.currentUser?.getIdToken();if(!token)throw new Error('Inicia sesión de nuevo');
      const url=(process.env.NEXT_PUBLIC_KIOSK_URL||'http://127.0.0.1:5000').replace(/\/+$/,'');
      const response=await fetch(`${url}/api/remove-fingerprint`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
        body:JSON.stringify({schoolId:SCHOOL_ID,studentId:student.id})});
      const result=await response.json();
      if(!response.ok||result.success!==true)throw new Error(result.error||'No se confirmó el borrado del sensor');
      await refresh();
      toast({title:'Huella eliminada del lector y PostgreSQL',description:'Ahora puedes registrar nuevamente el mismo dedo.'});
    }catch(e){toast({variant:'destructive',title:'La huella NO fue eliminada',description:e instanceof Error?e.message:'Error'});}
  };
  const addCommunity=async(name:string)=>{
    const value=name.toUpperCase().trim();if(!value)return false;
    try{await dataApi('communities',{method:'POST',body:JSON.stringify({name:value})});
      await loadCommunities();setNewCommunityName('');return true;
    }catch(e){toast({variant:'destructive',title:'No se pudo agregar comunidad',description:e instanceof Error?e.message:'Error'});return false;}
  };
  const removeCommunity=async(name:string)=>{
    if(!confirm(`Eliminar comunidad ${name}?`))return;
    try{await dataApi(`communities/${encodeURIComponent(name)}`,{method:'DELETE'});await loadCommunities();}
    catch(e){toast({variant:'destructive',title:'No se pudo eliminar comunidad',description:e instanceof Error?e.message:'Error'});}
  };
  const onImportFile=async(event:React.ChangeEvent<HTMLInputElement>)=>{
    const file=event.target.files?.[0];if(!file)return;
    try{
      const wb=XLSX.read(await file.arrayBuffer(),{type:'array'});
      const rows=XLSX.utils.sheet_to_json<Record<string,unknown>>(wb.Sheets[wb.SheetNames[0]],{defval:''});
      const normalized=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
      const get=(row:Record<string,unknown>,names:string[])=>{
        const key=Object.keys(row).find(k=>names.includes(normalized(k)));
        return key?String(row[key]??'').trim():'';};
      const parsed=rows.map(r=>({nombre:get(r,['nombre','nombrecompleto','alumno','nombredelalumno']),
        matricula:get(r,['matricula','numerodematricula','nocontrol','nocontrolalumno']),
        telefono_tutor:get(r,['telefono','telefonotutor','telefonodeltutor','celular']),
        correo_tutor:get(r,['correo','correotutor','email','correoelectronico']),
        grupo:get(r,['grupo']),comunidad:get(r,['comunidad','localidad'])
      })).filter(r=>r.nombre);
      setPendingRows(parsed as StudentFormValues[]);
      toast({title:'Excel leído',description:`${parsed.length} alumnos listos para revisar.`});
    }catch(e){toast({variant:'destructive',title:'Excel inválido',description:e instanceof Error?e.message:'Error'});}
    if(fileInput.current)fileInput.current.value='';
  };
  const confirmImport=async()=>{
    if(!pendingRows.length)return;
    setIsImporting(true);
    try{
      const result=await dataApi<{added:number;skipped:number}>('students/import',{method:'POST',body:JSON.stringify({students:pendingRows})});
      toast({title:'Importación completada',description:`${result.added} nuevos, ${result.skipped} matrículas duplicadas.`});
      setPendingRows([]);await refresh();
    }catch(e){toast({variant:'destructive',title:'No se completó la importación',description:e instanceof Error?e.message:'Error'});}
    finally{setIsImporting(false);}
  };
  const columns=getColumns({onEnroll:setEnrollmentStudent,onEdit:(s)=>{setEditingStudent(s);setIsFormOpen(true);},
    onDelete:setStudentToDelete,onRemoveFingerprint:handleRemoveFingerprint,
    onCopyMatricula:(m)=>{void navigator.clipboard.writeText(m);toast({title:'Matrícula copiada'});}});
  return <main className="container mx-auto py-2">
    <PageHeader title="Gestión de alumnos" description="Alumnos y huellas almacenados en PostgreSQL. El lector valida localmente.">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={()=>void refresh()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4"/>Actualizar</Button>
        <Dialog open={communitiesOpen} onOpenChange={setCommunitiesOpen}>
          <Button variant="outline" onClick={()=>setCommunitiesOpen(true)}><MapPin className="mr-2 h-4 w-4"/>Comunidades</Button>
          <DialogContent className="sm:max-w-lg"><DialogTitle>Comunidades</DialogTitle><DialogDescription>Gestiona las localidades del plantel.</DialogDescription>
            <div className="flex gap-2"><Input value={newCommunityName} onChange={e=>setNewCommunityName(e.target.value)} placeholder="Nombre de la comunidad"/>
              <Button onClick={()=>void addCommunity(newCommunityName)}>Agregar</Button></div>
            <div className="max-h-64 space-y-1 overflow-auto">{comunidades.map(c=><div key={c} className="flex items-center justify-between border-b p-2"><span>{c}</span>
              <Button size="icon" variant="ghost" onClick={()=>void removeCommunity(c)}><Trash2 className="h-4 w-4"/></Button></div>)}</div>
          </DialogContent>
        </Dialog>
        <input ref={fileInput} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onImportFile}/>
        <Button variant="outline" onClick={()=>fileInput.current?.click()}><Upload className="mr-2 h-4 w-4"/>Importar Excel</Button>
        <Dialog open={isFormOpen} onOpenChange={v=>!v&&closeForm()}>
          <DialogTrigger asChild><Button onClick={()=>setIsFormOpen(true)}><PlusCircle className="mr-2 h-4 w-4"/>Registrar alumno</Button></DialogTrigger>
          <DialogContent className="sm:max-w-[425px]"><StudentForm key={editingStudent?.id||'new'} onSubmit={handleFormSubmit}
            onClose={closeForm} comunidades={comunidades} onAddComunidad={addCommunity} onRemoveComunidad={removeCommunity}
            initialData={editingStudent}/></DialogContent>
        </Dialog>
      </div>
    </PageHeader>
    {pendingRows.length>0&&<Card className="mb-4"><CardContent className="space-y-3 pt-5">
      <h3 className="font-semibold">Revisar importación: {pendingRows.length} alumnos</h3>
      <div className="max-h-48 overflow-auto text-sm">{pendingRows.slice(0,20).map((r,i)=><p key={i}>{r.nombre} · {r.matricula}</p>)}</div>
      <div className="flex gap-2"><Button disabled={isImporting} onClick={()=>void confirmImport()}>{isImporting?'Importando…':'Confirmar importación'}</Button>
        <Button variant="outline" onClick={()=>setPendingRows([])}>Cancelar</Button></div>
    </CardContent></Card>}
    <Card><CardContent className="pt-6"><DataTable columns={columns} data={students} isLoading={loading}/></CardContent></Card>
    {enrollmentStudent&&<EnrollFingerprintDialog student={enrollmentStudent} onClose={()=>{setEnrollmentStudent(null);void refresh();}}/>}
    {studentToDelete&&<Dialog open onOpenChange={open=>!open&&setStudentToDelete(null)}><DialogContent>
      <DialogTitle>¿Desactivar a {studentToDelete.nombre}?</DialogTitle><DialogDescription>
        El alumno dejará de marcar asistencia. Se revocará su plantilla en PostgreSQL, pero el historial escolar se conserva.
        Sincroniza el lector para retirar cualquier copia local.</DialogDescription>
      <div className="flex justify-end gap-2"><Button variant="outline" onClick={()=>setStudentToDelete(null)}>Cancelar</Button>
        <Button variant="destructive" onClick={()=>void handleDeleteStudent()}>Desactivar alumno</Button></div>
    </DialogContent></Dialog>}
  </main>;
}
