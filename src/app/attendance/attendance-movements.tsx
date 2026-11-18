'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Attendance } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

type Props = {
  records: Attendance[];
  isAdmin: boolean;
  onVoid: (record: Attendance, reason: string) => Promise<void>;
};

export function AttendanceMovements({ records, isAdmin, onVoid }: Props) {
  const { toast } = useToast();
  const [editing, setEditing] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const sorted = [...records].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const handleVoid = async (record: Attendance) => {
    if (busy || !isAdmin || record.voided) return;
    if (!window.confirm('¿Confirmas que deseas anular esta asistencia? El movimiento permanecerá en el historial.')) return;
    setBusy(true);
    try {
      await onVoid(record, 'Corrección administrativa');
      setEditing(null);
      toast({ title: 'Asistencia anulada', description: 'El movimiento permanece en el historial.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'No se pudo anular', description: error instanceof Error ? error.message : 'Error desconocido' });
    } finally {
      setBusy(false);
    }
  };

  return <>
    <CardHeader>
      <CardTitle>Todos los movimientos del día</CardTitle>
      <CardDescription>Se muestra cada entrada y salida. Los movimientos anulados permanecen visibles para auditoría.</CardDescription>
    </CardHeader>
    <CardContent className="max-h-[480px] space-y-3 overflow-y-auto">
      {!sorted.length && <p className="text-sm text-muted-foreground">Sin movimientos para este día.</p>}
      {sorted.map(record => <div key={record.id} className="rounded-xl border p-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><p className="font-medium">{record.studentName || 'Alumno'}</p><p className="text-xs text-muted-foreground">{format(record.timestamp, 'd MMM yyyy, HH:mm:ss', { locale: es })}</p></div>
          <div className="flex gap-2 items-center">
            <Badge variant={record.type === 'salida' ? 'destructive' : 'secondary'}>{record.type === 'salida' ? 'Salida' : 'Entrada'}</Badge>
            {record.voided ? <Badge variant="outline">Anulado</Badge> : isAdmin && <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditing(editing === record.id ? null : record.id)}>Corregir</Button>}
          </div>
        </div>
        {record.voided && <p className="text-xs text-muted-foreground">Motivo: {record.voidReason || 'Corrección administrativa'}</p>}
        {editing === record.id && !record.voided && isAdmin && <div className="space-y-3 rounded-lg bg-muted/40 p-3">
          <p className="text-sm text-muted-foreground">¿Deseas anular este movimiento? No se eliminará definitivamente y quedará registrado en el historial.</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="destructive" disabled={busy} onClick={() => handleVoid(record)}>{busy ? 'Anulando...' : 'Confirmar anulación'}</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditing(null)}>Cancelar</Button>
          </div>
        </div>}
      </div>)}
    </CardContent>
  </>;
}
