import { NextResponse } from 'next/server';
// Este endpoint antiguo aceptaba correos arbitrarios sin autenticación.
// No volver a habilitar sin autenticación y validación del servidor.
export async function POST() {
  return NextResponse.json({ success: false, error: 'Notificaciones web deshabilitadas. El lector local usa su servicio autenticado.' }, { status: 503 });
}
