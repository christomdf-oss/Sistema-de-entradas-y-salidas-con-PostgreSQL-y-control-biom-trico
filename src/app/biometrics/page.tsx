'use client';

import * as React from 'react';
import { io, Socket } from 'socket.io-client';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useRole } from '@/components/auth/use-role';
import { Fingerprint, Play, Square, RefreshCw, CheckCircle2, AlertTriangle, WifiOff, Activity, Users, LogIn, LogOut, ShieldCheck } from 'lucide-react';

const LOCAL_URL = 'http://127.0.0.1:5000';
const apiBase = () => (process.env.NEXT_PUBLIC_KIOSK_URL || LOCAL_URL).replace(/\/+$/, '');

type Mode = 'entrada' | 'salida';
type EventItem = { id: number; title: string; detail: string; kind: 'success' | 'error' | 'info'; when: string };

export default function BiometricsPage() {
  const auth = useAuth();
  const { toast } = useToast();
  const { isAdmin } = useRole();
  const [busy, setBusy] = React.useState(false);
  const [active, setActive] = React.useState(false);
  const [mode, setMode] = React.useState<Mode | null>(null);
  const [count, setCount] = React.useState<number | null>(null);
  const [connected, setConnected] = React.useState(false);
  const [events, setEvents] = React.useState<EventItem[]>([]);
  const sequence = React.useRef(0);
  const event = React.useCallback((title: string, detail: string, kind: EventItem['kind']) => {
    setEvents(old => [{ id: ++sequence.current, title, detail, kind, when: new Date().toLocaleTimeString('es-MX') }, ...old].slice(0, 30));
  }, []);

  const call = React.useCallback(async (endpoint: string, body?: object) => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('Vuelve a iniciar sesión para usar el lector.');
    const response = await fetch(`${apiBase()}/api/${endpoint}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const result = await response.json();
    if (!response.ok || result.success === false) throw new Error(result.error || `Error HTTP ${response.status}`);
    return result;
  }, [auth]);


  const updateStatus = React.useCallback(async () => {
    try {
      const status = await call('attendance-status');
      setConnected(true);
      setActive(Boolean(status.attendance_mode));
      setMode(status.attendance_mode ? (status.attendance_type === 'salida' ? 'salida' : 'entrada') : null);
      setCount(typeof status.students_loaded === 'number' ? status.students_loaded : null);
    } catch {
      setConnected(false);
      setActive(false);
      setMode(null);
    }
  }, [call]);

  React.useEffect(() => {
    let socket: Socket | undefined;
    let disposed = false;
    void (async () => {
      await updateStatus();
      const token = await auth.currentUser?.getIdToken();
      if (!token || disposed) return;
      socket = io(apiBase(), { path: '/socket.io', transports: ['websocket'], auth: { token }, reconnection: true });
      socket.on('connect', () => { setConnected(true); event('Conectado', 'Servidor biométrico disponible.', 'info'); void updateStatus(); });
      socket.on('disconnect', () => { setConnected(false); event('Desconectado', 'Se perdió la comunicación con el servidor biométrico.', 'error'); });
      socket.on('attendance_marked', (payload: { studentName?: string; action?: string }) => {
        const name = payload.studentName || 'Alumno';
        const action = payload.action === 'salida' ? 'Salida' : 'Entrada';
        event('Asistencia registrada', `${name} — ${action} guardada correctamente.`, 'success');
        toast({ title: `${action} registrada`, description: name });
      });
      socket.on('attendance_error', (payload: { error?: string }) => {
        const detail = payload?.error || 'Huella no reconocida o registro rechazado.';
        event('No se registró la asistencia', detail, 'error');
        toast({ variant: 'destructive', title: 'Asistencia no registrada', description: detail });
      });
    })();
    const polling = setInterval(() => { void updateStatus(); }, 60000);
    return () => { disposed = true; clearInterval(polling); socket?.disconnect(); };
  }, [auth, event, toast, updateStatus]);

  const run = async (command: 'start-attendance' | 'stop-attendance', selected?: Mode) => {
    setBusy(true);
    try {
      await call(command, command === 'start-attendance' ? { type: selected } : {});
      await updateStatus();
      if (command === 'start-attendance') event('Captura activada', `Esperando huellas para ${selected === 'salida' ? 'salidas' : 'entradas'}.`, 'info');
      else event('Captura detenida', 'El lector dejó de registrar asistencias.', 'info');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'El lector no respondió.';
      event('Error del lector', message, 'error');
      toast({ variant: 'destructive', title: 'No se pudo controlar el lector', description: message });
      await updateStatus();
    } finally { setBusy(false); }
  };

  return (
    <main className="mx-auto max-w-7xl space-y-5 pb-10">
      <section className="cobacam-hero">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-rose-200">Sistema de Entradas y Salidas</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Control Biométrico</h1>
        <p className="mt-2 max-w-xl text-sm text-rose-100">Gestiona las entradas y salidas del Plantel 10 Chicbul mediante el lector USB ZK9500.</p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5">COBACAM · Plantel 10 Chicbul</span>
          <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5">Modo: {active ? (mode === 'salida' ? 'salidas' : 'entradas') : 'detenido'}</span>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <section className="cobacam-section-card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-bold text-lg"><Fingerprint className="text-primary"/> Estado del dispositivo</h2><span className={`rounded-full px-3 py-1.5 text-xs font-bold ${connected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{connected ? '● Servidor conectado' : '● Servidor desconectado'}</span></div>
          <div className="mt-5 flex items-center gap-4 rounded-2xl bg-[#faf7f9] p-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-[#f0dce4]"><Fingerprint className="h-11 w-11 text-[#940f37]" /></div>
            <div className="space-y-1.5"><p className="font-bold">Lector ZKTeco ZK9500</p><p className="text-xs text-muted-foreground">Dispositivo biométrico USB</p><p className="text-sm font-medium">{active ? (mode === 'entrada' ? 'Entradas activas' : 'Salidas activas') : 'Captura detenida'}</p></div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border p-3"><span className="block text-xs text-muted-foreground">Servidor local</span><strong>{connected ? 'Disponible' : 'Sin conexión'}</strong></div>
            <div className="rounded-xl border p-3"><span className="block text-xs text-muted-foreground">Huellas autorizadas</span><strong>{count === null ? 'Sin consultar' : count}</strong></div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">El estado del servidor no confirma que el sensor físico haya inicializado. Compruébalo con una huella ficticia de prueba.</p>
        </section>
        <section className="cobacam-section-card p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold"><Activity className="text-primary"/> Controles del sistema</h2>
          <p className="mt-1 text-sm text-muted-foreground">Selecciona un modo y observa cada lectura en tiempo real.</p>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button disabled={busy || !connected || active} onClick={() => void run('start-attendance', 'entrada')} className="cobacam-action cobacam-action-entry"><LogIn className="h-6 w-6"/><span>Iniciar<br/>Entradas</span></button>
            <button disabled={busy || !connected || active} onClick={() => void run('start-attendance', 'salida')} className="cobacam-action cobacam-action-exit"><LogOut className="h-6 w-6"/><span>Iniciar<br/>Salidas</span></button>
            <button disabled={busy || !connected || !active} onClick={() => void run('stop-attendance')} className="cobacam-action cobacam-action-stop"><Square className="h-6 w-6"/><span>Detener<br/>Sistema</span></button>
          </div>
          <Button disabled={busy} variant="outline" className="mt-5 w-full" onClick={() => void updateStatus()}><RefreshCw className="mr-2 h-4 w-4"/> Actualizar estado</Button>
          {isAdmin && <Button disabled={busy || active || !connected} variant="outline" className="mt-2 w-full" onClick={() => void (async () => {
            setBusy(true);
            try {
              const result = await call('sync', {});
              event('Sincronización completa', `${result.students_loaded ?? 0} huellas sincronizadas desde PostgreSQL.`, 'success');
              await updateStatus();
            } catch (error: any) {
              toast({ variant: 'destructive', title: 'Sincronización fallida', description: error.message });
            } finally { setBusy(false); }
          })()}><RefreshCw className="mr-2 h-4 w-4"/> Sincronizar todas las huellas (administrador)</Button>}
          <p className="mt-3 text-xs text-muted-foreground">Las acciones solamente están disponibles cuando el servicio biométrico local responde.</p>
        </section>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="cobacam-stat flex items-center gap-4 p-5"><span className="rounded-xl bg-rose-100 p-3 text-rose-800"><Fingerprint /></span><div><p className="text-xs text-muted-foreground">Modo actual</p><p className="font-bold">{!active ? 'Detenido' : mode === 'entrada' ? 'Entradas' : 'Salidas'}</p></div></div>
        <div className="cobacam-stat flex items-center gap-4 p-5"><span className="rounded-xl bg-green-100 p-3 text-green-700"><Users /></span><div><p className="text-xs text-muted-foreground">Huellas disponibles</p><p className="text-2xl font-extrabold">{count ?? '—'}</p></div></div>
        <div className="cobacam-stat flex items-center gap-4 p-5"><span className="rounded-xl bg-slate-100 p-3 text-slate-700"><ShieldCheck /></span><div><p className="text-xs text-muted-foreground">Verificación</p><p className="font-bold">{connected ? 'Servidor accesible' : 'Sin conexión'}</p></div></div>
      </div>
      <section className="cobacam-section-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="flex items-center gap-2 text-lg font-bold"><Activity className="text-primary"/> Actividad en tiempo real</h2><p className="text-sm text-muted-foreground">Confirmaciones de entradas, salidas y huellas no reconocidas.</p></div><span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-800">Últimos 30 eventos de esta sesión</span></div>
        <div className="mt-5 space-y-2" aria-live="polite">
          {events.length === 0 ? <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Aún no hay lecturas. Inicia el modo de entrada o salida y coloca un dedo en el sensor.</p> : events.map(item =>
            <div key={item.id} className="cobacam-event flex items-start gap-3">
              <div className={`rounded-full p-2 ${item.kind === 'success' ? 'bg-green-100 text-green-700' : item.kind === 'error' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                {item.kind === 'success' ? <CheckCircle2 className="h-5 w-5"/> : item.kind === 'error' ? <AlertTriangle className="h-5 w-5"/> : <WifiOff className="h-5 w-5"/>}
              </div>
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">{item.title}</strong><span className="text-xs text-muted-foreground">{item.when}</span></div><p className="mt-1 text-sm text-muted-foreground">{item.detail}</p></div>
            </div>)}
        </div>
      </section>
    </main>
  );
}
