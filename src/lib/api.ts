import { getAuth } from 'firebase/auth';
import type { Attendance } from '@/lib/types';

/** Firebase solamente valida la identidad Google; NINGÚN dato escolar se lee de Firestore. */
export const DATA_API_BASE = (process.env.NEXT_PUBLIC_DATA_API_URL || 'http://127.0.0.1:5050').replace(/\/+$/, '');

export async function dataApi<T = any>(route: string, options: RequestInit = {}): Promise<T> {
  const user = getAuth().currentUser;
  if (!user) throw new Error('Inicia sesión con Google para continuar.');
  const token = await user.getIdToken();
  const response = await fetch(`${DATA_API_BASE}/api/${route.replace(/^\/+/, '')}`, {
    ...options,
    headers: { 'Authorization': `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers },
    cache: 'no-store',
  });
  let result: any = {};
  try { result = await response.json(); } catch { /* Mostrar HTTP si falla el servidor. */ }
  if (!response.ok || result.success === false) {
    throw new Error(result.error || `Error del servidor PostgreSQL (HTTP ${response.status})`);
  }
  return result as T;
}

export function toAttendance(item: any): Attendance {
  return { ...item, timestamp: item.timestamp ? new Date(item.timestamp) : new Date(0),
    voidedAt: item.voidedAt ? new Date(item.voidedAt) : null } as Attendance;
}
