'use client';
import * as React from 'react';
import { startOfDay, format } from 'date-fns';
import { useUser } from '@/firebase';
import { dataApi, toAttendance } from '@/lib/api';
import type { Attendance } from '@/lib/types';

type TodayContextType = { attendance: Attendance[]; loading: boolean; day: Date; refreshAttendance: () => Promise<void> };
const Context = React.createContext<TodayContextType | null>(null);

/** Un proveedor diario compartido: en PostgreSQL se leen cambios (no el mes completo). */
export function TodayAttendanceProvider({ children }: {children:React.ReactNode}) {
  const { user } = useUser();
  const [day,setDay] = React.useState(() => startOfDay(new Date()));
  const [attendance,setAttendance] = React.useState<Attendance[]>([]);
  const [loading,setLoading] = React.useState(true);
  const records = React.useRef<Map<string,Attendance>>(new Map());
  const cursor = React.useRef<string|null>(null);
  const busy = React.useRef(false);
  const sessionGeneration = React.useRef(0);
  const refreshAttendance = React.useCallback(async () => {
    if (!user || busy.current) return;
    busy.current = true;
    const generation = sessionGeneration.current;
    const cutoff = new Date(Date.now() - 3000).toISOString();
    try {
      const params = new URLSearchParams({date:format(day,'yyyy-MM-dd')});
      if (cursor.current) params.set('since',cursor.current);
      const payload = await dataApi<{attendance:any[]}>(`attendance?${params}`);
      if (generation !== sessionGeneration.current) return;
      if (!cursor.current) records.current.clear();
      for (const item of payload.attendance) records.current.set(item.id,toAttendance(item));
      cursor.current = cutoff;
      setAttendance([...records.current.values()].sort((a,b)=>b.timestamp.getTime()-a.timestamp.getTime()));
      setLoading(false);
    } catch (err) {
      setLoading(false);
      console.error('No se pudo cargar la asistencia del día desde PostgreSQL',err);
    } finally { busy.current = false; }
  },[user?.uid,day]);
  React.useEffect(()=>{
    const timer=setInterval(()=>setDay(before=>{
      const today=startOfDay(new Date());
      return today.getTime()===before.getTime()?before:today;
    }),60000);
    return ()=>clearInterval(timer);
  },[]);
  React.useEffect(()=>{
    sessionGeneration.current += 1;
    records.current.clear(); cursor.current=null; setAttendance([]); setLoading(true);
    if (!user) { setLoading(false); return; }
    void refreshAttendance();
    const timer=setInterval(()=>{void refreshAttendance();},5000);
    return ()=>clearInterval(timer);
  },[user?.uid,day,refreshAttendance]);
  const value=React.useMemo(()=>({attendance,loading,day,refreshAttendance}),[attendance,loading,day,refreshAttendance]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useTodayAttendance() {
  const context=React.useContext(Context);
  if (!context) throw new Error('useTodayAttendance requiere TodayAttendanceProvider');
  return context;
}
