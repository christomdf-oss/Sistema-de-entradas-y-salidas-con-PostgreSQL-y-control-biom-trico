'use client';
import { createContext,useContext,ReactNode,useMemo } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Auth } from 'firebase/auth';
import { initializeFirebase } from './index';
interface FirebaseContextType {app:FirebaseApp;auth:Auth}
const FirebaseContext=createContext<FirebaseContextType|undefined>(undefined);
export const FirebaseProvider=({children}:{children:ReactNode})=>{
  const firebase=useMemo(()=>initializeFirebase(),[]);
  return <FirebaseContext.Provider value={firebase}>{children}</FirebaseContext.Provider>;
};
export const getFirebase=():FirebaseContextType=>{
  const context=useContext(FirebaseContext);
  if(context===undefined)throw new Error('getFirebase requiere FirebaseProvider');
  return context;
};
export const useFirebaseApp=():FirebaseApp=>getFirebase().app;
export const useAuth=():Auth=>getFirebase().auth;
