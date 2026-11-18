'use client';
import { useEffect,useState } from 'react';
import { useUser } from '@/firebase';
import { dataApi } from '@/lib/api';
export type UserRole = 'admin' | 'staff' | null;
export function useRole() {
  const {user,loading:authLoading}=useUser();
  const [role,setRole]=useState<UserRole>(null);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    let active=true;
    setRole(null);
    if (authLoading) { setLoading(true); return; }
    if (!user) {setLoading(false);return;}
    setLoading(true);
    void dataApi<{role:UserRole}>('me').then(r=>{
      if(active) setRole(r.role);
    }).catch(()=>{if(active)setRole(null);}).finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[user?.uid,authLoading]);
  return {role,isAdmin:role==='admin',loading:authLoading||loading,user};
}
