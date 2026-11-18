'use client';

import * as React from 'react';
import { useStudents } from '@/components/data/students-provider';
import { useTodayAttendance } from '@/components/data/today-attendance-provider';
import { useRole } from '@/components/auth/use-role';
import { dataApi } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Search, LogIn, LogOut, Trash2, Users, CheckSquare2, Clock3, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import type { Attendance, Student } from '@/lib/types';

const ALL = '__all__';
const INITIAL_PAGE_SIZE = 50;
const MAX_BATCH_SIZE = 150;
const sorter = new Intl.Collator('es-MX', { numeric: true, sensitivity: 'base' });
const norm = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-MX').trim();
const hhmm = (date: Date) => date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
const isMovement = (item: Attendance) => item.type === 'entrada' || item.type === 'salida';

export default function ManualEntryPage() {
  const { students, loading, error: studentsError } = useStudents();
  const { attendance, refreshAttendance, loading: loadingAttendance } = useTodayAttendance();
  const { isAdmin } = useRole();
  const { toast } = useToast();

  const [group, setGroup] = React.useState(ALL);
  const [community, setCommunity] = React.useState(ALL);
  const [search, setSearch] = React.useState('');
  const [limit, setLimit] = React.useState(INITIAL_PAGE_SIZE);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(() => new Set());
  const [busy, setBusy] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [showPermits, setShowPermits] = React.useState(false);
  const [reason, setReason] = React.useState('');

  const groups = React.useMemo(() => [...new Set(students.map(s => s.grupo.trim()).filter(Boolean))].sort(sorter.compare), [students]);
  const communities = React.useMemo(() => [...new Set(students.map(s => s.comunidad.trim()).filter(Boolean))].sort(sorter.compare), [students]);

  const filtered = React.useMemo(() => {
    const query = norm(search);
    return students.filter(student =>
      (group === ALL || student.grupo.trim() === group) &&
      (community === ALL || student.comunidad.trim() === community) &&
      (!query || norm(`${student.nombre} ${student.matricula}`).includes(query))
    ).sort((a, b) => sorter.compare(a.nombre, b.nombre));
  }, [students, group, community, search]);

  React.useEffect(() => {
    setSelectedIds(new Set());
    setLimit(INITIAL_PAGE_SIZE);
  }, [group, community, search]);

  const visible = filtered.slice(0, limit);
  const visibleIds = React.useMemo(() => new Set(visible.map(student => student.id)), [visible]);
  const allVisibleSelected = visible.length > 0 && visible.every(student => selectedIds.has(student.id));
  const selectedCount = selectedIds.size;

  const latestByStudent = React.useMemo(() => {
    const result = new Map<string, Attendance>();
    for (const item of attendance) {
      if (!item.voided && isMovement(item) && !result.has(item.studentId)) result.set(item.studentId, item);
    }
    return result;
  }, [attendance]);

  const filteredIds = React.useMemo(() => new Set(filtered.map(student => student.id)), [filtered]);
  const manualMovements = React.useMemo(() => attendance.filter(item =>
    item.isManual && !item.voided && isMovement(item) && filteredIds.has(item.studentId)
  ).slice(0, 60), [attendance, filteredIds]);

  function toggleStudent(id: string, checked: boolean) {
    setSelectedIds(previous => {
      const next = new Set(previous);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  }

  function toggleVisible(checked: boolean) {
    setSelectedIds(previous => {
      const next = new Set(previous);
      visibleIds.forEach(id => checked ? next.add(id) : next.delete(id));
      return next;
    });
  }

  async function registerOne(student: Student, type: 'entrada' | 'salida') {
    setBusy(true);
    setBusyId(student.id);
    try {
      await dataApi('attendance', {
        method: 'POST', body: JSON.stringify({ studentId: student.id, type }),
      });
      await refreshAttendance();
      toast({ title: `${type === 'entrada' ? 'Entrada' : 'Salida'} registrada`, description: student.nombre });
    } catch (err) {
      toast({ variant: 'destructive', title: 'No se pudo registrar', description: err instanceof Error ? err.message : 'Error de conexión' });
    } finally {
      setBusy(false);
      setBusyId(null);
    }
  }

  async function registerSelected(type: 'entrada' | 'salida') {
    const ids = filtered.filter(student => selectedIds.has(student.id)).map(student => student.id);
    if (!ids.length) return;
    if (ids.length > MAX_BATCH_SIZE) {
      toast({ variant: 'destructive', title: 'Demasiados alumnos', description: `Selecciona máximo ${MAX_BATCH_SIZE} alumnos por operación. Usa los filtros de grupo o comunidad.` });
      return;
    }
    if (!window.confirm(`Vas a registrar ${ids.length} ${ids.length === 1 ? 'movimiento' : 'movimientos'} de ${type.toUpperCase()}.\n\nLos tutores pueden recibir notificaciones por correo. ¿Confirmas el registro?`)) return;
    setBusy(true);
    try {
      const response = await dataApi<{ count: number }>('attendance/batch', {
        method: 'POST', body: JSON.stringify({ studentIds: ids, type }),
      });
      setSelectedIds(new Set());
      await refreshAttendance();
      toast({ title: `${response.count} ${response.count === 1 ? 'movimiento registrado' : 'movimientos registrados'}`, description: `Se guardaron las ${type === 'entrada' ? 'entradas' : 'salidas'} en PostgreSQL.` });
    } catch (err) {
      toast({ variant: 'destructive', title: 'No se completó el registro del grupo', description: err instanceof Error ? err.message : 'Error de conexión' });
    } finally {
      setBusy(false);
    }
  }

  async function voidSelectedMovements(type: 'entrada' | 'salida') {
    if (!isAdmin || busy || selectedIds.size === 0) return;
    const latestManual = new Map<string, Attendance>();
    for (const item of attendance) {
      if (item.isManual && !item.voided && item.type === type && selectedIds.has(item.studentId) && !latestManual.has(item.studentId)) {
        latestManual.set(item.studentId, item);
      }
    }
    const eventIds = Array.from(latestManual.values()).map(item => item.id);
    if (!eventIds.length) {
      toast({ title: 'Sin movimientos para anular', description: `No hay ${type === 'entrada' ? 'entradas' : 'salidas'} manuales activas de los alumnos seleccionados hoy.` });
      return;
    }
    if (eventIds.length > MAX_BATCH_SIZE) return;
    const enteredReason = window.prompt(`Se anulará la última ${type.toUpperCase()} MANUAL de ${eventIds.length} alumno(s) seleccionados.\n\nIndica el motivo. Estos registros se conservarán en el historial:`, 'Corrección de asistencia manual');
    if (enteredReason === null) return;
    const why = enteredReason.trim();
    if (!why) {
      toast({ variant: 'destructive', title: 'El motivo de anulación es obligatorio.' });
      return;
    }
    setBusy(true);
    try {
      const response = await dataApi<{ count: number }>('attendance/void-batch', {
        method: 'POST', body: JSON.stringify({ eventIds, type, reason: why }),
      });
      setSelectedIds(new Set());
      await refreshAttendance();
      toast({ title: `${response.count} ${response.count === 1 ? 'movimiento anulado' : 'movimientos anulados'}`, description: 'Se conserva el historial con el motivo y el administrador.' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'No se pudo anular el lote', description: err instanceof Error ? err.message : 'Error de conexión' });
    } finally {
      setBusy(false);
    }
  }

  async function voidMovement(record: Attendance) {
    if (!isAdmin || busy || !isMovement(record)) return;
    const enteredReason = window.prompt(`Motivo para anular la ${record.type} de ${record.studentName} (${hhmm(record.timestamp)}).\nEl movimiento seguirá en el historial.`, 'Corrección de asistencia manual');
    if (enteredReason === null) return;
    const reasonText = enteredReason.trim();
    if (!reasonText) {
      toast({ variant: 'destructive', title: 'Escribe el motivo de anulación.' });
      return;
    }
    setBusy(true);
    setBusyId(record.id);
    try {
      await dataApi(`attendance/${encodeURIComponent(record.id)}/void`, {
        method: 'POST', body: JSON.stringify({ reason: reasonText }),
      });
      await refreshAttendance();
      toast({ title: 'Movimiento anulado', description: 'Ya no cuenta en la asistencia, pero permanece en el historial.' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'No se pudo anular', description: err instanceof Error ? err.message : 'Error de conexión' });
    } finally {
      setBusy(false);
      setBusyId(null);
    }
  }

  async function registerPermit(student: Student, type: 'permiso' | 'justificacion') {
    if (!reason.trim()) return;
    setBusy(true);
    setBusyId(student.id);
    try {
      await dataApi('attendance', { method: 'POST', body: JSON.stringify({ studentId: student.id, type, reason: reason.trim() }) });
      await refreshAttendance();
      toast({ title: type === 'permiso' ? 'Permiso registrado' : 'Justificación registrada', description: student.nombre });
    } catch (err) {
      toast({ variant: 'destructive', title: 'No se pudo guardar', description: err instanceof Error ? err.message : 'Error de conexión' });
    } finally {
      setBusy(false);
      setBusyId(null);
    }
  }

  return (
    <main className="container mx-auto space-y-5 pb-10">
      <PageHeader title="Asistencia manual" description="Registra entradas y salidas sin el sensor: por grupo, comunidad, nombre o matrícula. Selecciona varios alumnos sin abrir formularios." />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Search className="h-5 w-5" /> Buscar alumnos</CardTitle>
          <CardDescription>Filtra primero y después registra una entrada, una salida o varias a la vez.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="space-y-1 text-sm font-medium">
              <span>Grupo</span>
              <select aria-label="Filtrar por grupo" value={group} onChange={event => setGroup(event.target.value)} className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value={ALL}>Todos los grupos</option>
                {groups.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium">
              <span>Comunidad</span>
              <select aria-label="Filtrar por comunidad" value={community} onChange={event => setCommunity(event.target.value)} className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value={ALL}>Todas las comunidades</option>
                {communities.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium">
              <span>Nombre o matrícula</span>
              <div className="relative">
                <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={event => setSearch(event.target.value)} aria-label="Buscar por nombre o matrícula" placeholder="Buscar (opcional)…" className="h-11 pl-9" />
              </div>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {filtered.length} alumnos encontrados</span>
            <span className="flex items-center gap-1"><CheckSquare2 className="h-4 w-4" /> {selectedCount} seleccionados</span>
            <span className="flex items-center gap-1"><Clock3 className="h-4 w-4" /> {attendance.filter(item => !item.voided && isMovement(item)).length} movimientos hoy</span>
          </div>
          {studentsError && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">No se pudieron cargar los alumnos: {studentsError}</p>}
          <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <Checkbox checked={allVisibleSelected} disabled={busy || !visible.length} onCheckedChange={checked => toggleVisible(checked === true)} aria-label="Seleccionar alumnos visibles" />
              Seleccionar {visible.length} alumnos visibles
            </label>
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy || selectedCount === 0 || selectedCount > MAX_BATCH_SIZE} onClick={() => void registerSelected('entrada')}>
                <LogIn className="mr-2 h-4 w-4" /> Entradas ({selectedCount})
              </Button>
              <Button variant="outline" disabled={busy || selectedCount === 0 || selectedCount > MAX_BATCH_SIZE} onClick={() => void registerSelected('salida')}>
                <LogOut className="mr-2 h-4 w-4" /> Salidas ({selectedCount})
              </Button>
              {selectedCount > 0 && <Button variant="ghost" disabled={busy} onClick={() => setSelectedIds(new Set())}>Limpiar selección</Button>}
            </div>
          </div>
          {selectedCount > MAX_BATCH_SIZE && <p className="text-sm text-destructive">Máximo {MAX_BATCH_SIZE} alumnos por lote. Filtra por un grupo o selecciona menos.</p>}
          {isAdmin && selectedCount > 0 && <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-3">
            <span className="text-xs text-muted-foreground">Corrección masiva (solo la última asistencia manual de cada tipo por alumno):</span>
            <Button size="sm" variant="outline" disabled={busy || selectedCount > MAX_BATCH_SIZE} onClick={() => void voidSelectedMovements('entrada')}>
              <Trash2 className="mr-1.5 h-4 w-4 text-destructive" /> Anular entradas
            </Button>
            <Button size="sm" variant="outline" disabled={busy || selectedCount > MAX_BATCH_SIZE} onClick={() => void voidSelectedMovements('salida')}>
              <Trash2 className="mr-1.5 h-4 w-4 text-destructive" /> Anular salidas
            </Button>
          </div>}
          <div className="space-y-2">
            {loading ? <p className="py-6 text-center text-sm text-muted-foreground">Cargando alumnos…</p> : visible.length === 0 ?
              <p className="py-8 text-center text-sm text-muted-foreground">No hay alumnos con esos filtros.</p> : visible.map(student => {
                const latest = latestByStudent.get(student.id);
                return <div key={student.id} className="flex flex-col gap-3 rounded-xl border p-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <Checkbox className="mt-1" checked={selectedIds.has(student.id)} disabled={busy} onCheckedChange={checked => toggleStudent(student.id, checked === true)} aria-label={`Seleccionar a ${student.nombre}`} />
                    <div className="min-w-0 space-y-1">
                      <p className="break-words font-semibold">{student.nombre}</p>
                      <p className="text-xs text-muted-foreground">{student.matricula || 'Sin matrícula'} · {student.grupo || 'Sin grupo'} · {student.comunidad || 'Sin comunidad'}</p>
                      {latest ? <Badge variant="secondary" className="font-normal">Última: {latest.type} · {hhmm(latest.timestamp)}{latest.isManual ? ' · manual' : ' · sensor'}</Badge> :
                        <span className="text-xs text-muted-foreground">Sin movimientos hoy</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pl-7 lg:shrink-0 lg:pl-0">
                    <Button size="sm" disabled={busy} onClick={() => void registerOne(student, 'entrada')}>
                      <LogIn className="mr-1.5 h-4 w-4" /> {busyId === student.id ? 'Guardando…' : 'Entrada'}
                    </Button>
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => void registerOne(student, 'salida')}>
                      <LogOut className="mr-1.5 h-4 w-4" /> Salida
                    </Button>
                    {isAdmin && latest?.isManual && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void voidMovement(latest)} title="Anular último movimiento manual">
                      <Trash2 className="mr-1 h-4 w-4 text-destructive" /> Anular último
                    </Button>}
                  </div>
                </div>;
              })}
          </div>
          {filtered.length > limit && <Button variant="outline" className="w-full" disabled={busy} onClick={() => setLimit(n => n + INITIAL_PAGE_SIZE)}>Mostrar más alumnos ({filtered.length - limit} restantes)</Button>}
          <p className="text-xs text-muted-foreground">Puedes registrar varios movimientos al día. Para evitar errores, confirma las acciones masivas. Máximo {MAX_BATCH_SIZE} alumnos por lote.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Movimientos manuales de hoy</CardTitle>
          <CardDescription>Mostrando entradas y salidas de los alumnos filtrados. El administrador puede anular movimientos erróneos sin borrar el historial.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {loadingAttendance ? <p className="text-sm text-muted-foreground">Cargando movimientos…</p> : manualMovements.length === 0 ?
            <p className="text-sm text-muted-foreground">Todavía no hay movimientos manuales con estos filtros.</p> : manualMovements.map(item =>
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm">{item.studentName}</p>
                  <p className="text-xs text-muted-foreground capitalize">{item.type} · {hhmm(item.timestamp)}</p>
                </div>
                {isAdmin && <Button variant="outline" size="sm" disabled={busy} onClick={() => void voidMovement(item)}>
                  <Trash2 className="mr-1.5 h-4 w-4 text-destructive" /> Anular
                </Button>}
              </div>
            )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5 space-y-3">
          <Button variant="ghost" className="px-0" onClick={() => setShowPermits(value => !value)}>
            <FileText className="mr-2 h-4 w-4" /> Permisos y justificaciones (opcional)
            {showPermits ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />}
          </Button>
          {showPermits && <>
            <p className="text-sm text-muted-foreground">Esta sección mantiene los permisos y las justificaciones separados de las entradas y salidas rápidas. Filtra a un alumno y escribe el motivo.</p>
            <Input value={reason} onChange={event => setReason(event.target.value)} placeholder="Motivo del permiso o justificación" />
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {visible.map(student => <div key={student.id} className="flex items-center justify-between gap-2 border-b py-2">
                <span className="truncate text-sm">{student.nombre}</span>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" disabled={busy || !reason.trim()} onClick={() => void registerPermit(student, 'permiso')}>Permiso</Button>
                  <Button size="sm" variant="outline" disabled={busy || !reason.trim()} onClick={() => void registerPermit(student, 'justificacion')}>Justificación</Button>
                </div>
              </div>)}
            </div>
          </>}
        </CardContent>
      </Card>
    </main>
  );
}
