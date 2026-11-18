'use client';

import * as React from 'react';
import { useUser } from '@/firebase';
import { dataApi } from '@/lib/api';
import type { Student } from '@/lib/types';

type StudentsContextType = {
  students: Student[];
  loading: boolean;
  error: string | null;
  refreshStudents: () => Promise<void>;
};
const StudentsContext = React.createContext<StudentsContextType | null>(null);

/** Una descarga al iniciar sesión; después, solo cambios por updated_at (PostgreSQL).
 * La lista se comparte entre todas las pantallas. Cambiar de página no carga 400 alumnos.
 */
export function StudentsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const records = React.useRef<Map<string, Student>>(new Map());
  const lastCursor = React.useRef<string | null>(null);
  const inFlight = React.useRef(false);
  const sessionGeneration = React.useRef(0);
  const [students, setStudents] = React.useState<Student[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const publish = React.useCallback(() => {
    setStudents([...records.current.values()].filter(student => student.active !== false));
  }, []);

  const refreshStudents = React.useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const generation = sessionGeneration.current;
    const cutoff = new Date(Date.now() - 3000).toISOString();
      const since = lastCursor.current;
      const result = await dataApi<{students: Student[]}>(`students${since ? `?since=${encodeURIComponent(since)}` : ''}`);
      if (generation !== sessionGeneration.current) return;
      if (!since) records.current = new Map();
      for (const item of result.students) records.current.set(item.id,item);
      lastCursor.current = cutoff;
      publish();
      setLoading(false);
      setError(null);
    } catch (e) {
      setLoading(false);
      setError(e instanceof Error ? e.message : 'No se pudo conectar a PostgreSQL');
      throw e;
    } finally { inFlight.current = false; }
  }, [publish]);

  React.useEffect(() => {
    sessionGeneration.current += 1;
    if (!user) {
      records.current.clear(); lastCursor.current = null;
      setStudents([]); setLoading(false); return;
    }
    records.current.clear(); lastCursor.current = null; setStudents([]); setLoading(true);
    let disposed = false;
    const refresh = () => { if (!disposed) void refreshStudents().catch(() => {}); };
    refresh();
    const timer = setInterval(refresh, 15000);
    return () => { disposed = true; clearInterval(timer); };
  }, [user?.uid,refreshStudents]);

  const value = React.useMemo(() => ({ students, loading, error, refreshStudents }),
    [students, loading, error, refreshStudents]);
  return <StudentsContext.Provider value={value}>{children}</StudentsContext.Provider>;
}
export function useStudents() {
  const context = React.useContext(StudentsContext);
  if (!context) throw new Error('useStudents requiere StudentsProvider');
  return context;
}
