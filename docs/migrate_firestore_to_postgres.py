"""Una sola importación LEYENDO Firestore. NUNCA borra documentos Firebase.
Uso: python migrate_firestore_to_postgres.py       (muestra conteos)
     python migrate_firestore_to_postgres.py --apply (copia a PostgreSQL)
Requiere Firebase Admin, BIOMETRIC_FERNET_KEY, DATABASE_URL y PostgreSQL iniciado.
"""
import argparse
import base64
import os
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo
from dotenv import load_dotenv
load_dotenv(Path(__file__).with_name('.env'))
import firebase_admin
from firebase_admin import credentials, firestore
from psycopg.types.json import Jsonb
import pg_store as store


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--apply',action='store_true',help='Copia los datos; no elimina Firestore')
    args=parser.parse_args()
    cert=os.environ.get('FIREBASE_SERVICE_ACCOUNT',str(Path(__file__).with_name('serviceAccountKey.json')))
    if not Path(cert).is_absolute():cert=str(Path(__file__).with_name(cert))
    if not firebase_admin._apps: firebase_admin.initialize_app(credentials.Certificate(cert))
    db=firestore.client()
    school=db.collection('schools').document(store.SCHOOL_ID)
    students=list(school.collection('students').stream())
    fingerprints=list(school.collection('fingerprints').stream())
    attendance=list(school.collection('asistencias').stream())
    communities=list(school.collection('communities').stream())
    users=list(db.collection('users').stream())
    settings=school.collection('settings').document('general').get().to_dict() or {}
    print('Firestore (solo lectura):',len(students),'alumnos;',len(fingerprints),'huellas;',
          len(attendance),'asistencias;',len(communities),'comunidades;',len(users),'perfiles')
    if not args.apply:
        print('No se cambió ninguna base. Para copiar: python migrate_firestore_to_postgres.py --apply')
        return
    if not students:
        raise SystemExit('No se encontraron alumnos; confirma SCHOOL_ID antes de continuar')
    crypt=store.cipher()
    known_student_ids={s.id for s in students}
    ids_by_matricula={}
    for snap in students:
        numero=str((snap.to_dict() or {}).get('matricula') or '').strip()
        if numero:
            ids_by_matricula.setdefault(numero,[]).append(snap.id)
    with store.transaction() as con:
        for snap in users:
            d=snap.to_dict() or {}
            if d.get('schoolId') != store.SCHOOL_ID or d.get('role') not in ('admin','staff'):
                continue
            con.execute('''INSERT INTO users(uid,school_id,role,active) VALUES (%s,%s,%s,%s)
                ON CONFLICT(uid) DO UPDATE SET school_id=excluded.school_id,role=excluded.role,
                active=excluded.active''', (snap.id,store.SCHOOL_ID,d['role'],d.get('active') is True))
        for snap in students:
            d=snap.to_dict() or {}
            con.execute('''INSERT INTO students
              (id,school_id,matricula,nombre,telefono_tutor,correo_tutor,grupo,comunidad,active,enrollment_status)
              VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
              ON CONFLICT(id) DO NOTHING''',(snap.id,store.SCHOOL_ID,
                d.get('matricula') or '',d.get('nombre') or 'Alumno',d.get('telefono_tutor') or '',
                d.get('correo_tutor') or '',d.get('grupo') or '',d.get('comunidad') or '',
                d.get('active',True) is not False,d.get('enrollmentStatus') or 'pending'))
        count=0
        for snap in fingerprints:
            d=snap.to_dict() or {}
            if not d.get('template'):continue # lápida de borrado no es plantilla activa
            raw=base64.b64decode(d['template'],validate=True)
            con.execute('''INSERT INTO fingerprints(student_id,school_id,template_ciphertext)
              VALUES (%s,%s,%s) ON CONFLICT(student_id) DO NOTHING''',
              (snap.id,store.SCHOOL_ID,crypt.encrypt(raw)))
            if snap.id in known_student_ids:
                con.execute("""UPDATE students SET enrollment_status='done'
                  WHERE id=%s AND school_id=%s AND active=true AND enrollment_status NOT IN ('removed')""",
                  (snap.id,store.SCHOOL_ID))
            count+=1
        for snap in attendance:
            d=snap.to_dict() or {}
            at=d.get('timestamp') or datetime.now(timezone.utc)
            if not isinstance(at,datetime):
                print('AVISO: asistencia',snap.id,'no tiene timestamp válido; se omitirá');continue
            if at.tzinfo is None:at=at.replace(tzinfo=timezone.utc)
            kind=d.get('type') or 'entrada'
            if kind not in ('entrada','salida','permiso','justificacion'):
                print('AVISO: asistencia',snap.id,'tiene tipo desconocido; se omitirá');continue
            day=at.astimezone(store.LOCAL_TZ).date()
            student_id=str(d.get('studentId') or '')
            if student_id not in known_student_ids:
                matches=ids_by_matricula.get(student_id,[])
                if len(matches)==1:
                    student_id=matches[0]
                else:
                    print('AVISO: asistencia',snap.id,'sin vínculo único con alumno:',student_id)
            voided_at=d.get('voidedAt') if isinstance(d.get('voidedAt'),datetime) else None
            con.execute('''INSERT INTO attendance
              (id,school_id,student_id,student_name,timestamp,local_date,type,is_manual,
               reason,voided,void_reason,voided_by,voided_at)
              VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(id) DO NOTHING''',
              (snap.id,store.SCHOOL_ID,student_id,
               str(d.get('studentName') or 'Alumno'),at,day,kind,
               d.get('isManual') is True,d.get('reason'),d.get('voided') is True,
               d.get('voidReason'),d.get('voidedBy'),voided_at))
        for snap in communities:
            name=str((snap.to_dict() or {}).get('name') or '').upper().strip()
            if name:
                con.execute('INSERT INTO communities(school_id,name) VALUES (%s,%s) ON CONFLICT DO NOTHING', (store.SCHOOL_ID,name))
        if settings:
            con.execute("""INSERT INTO settings(school_id,key,payload) VALUES (%s,'general',%s)
              ON CONFLICT(school_id,key) DO NOTHING""",(store.SCHOOL_ID,Jsonb(settings)))
    with store.connection() as con:
        for table in ('users','students','fingerprints','attendance','communities'):
            print('PostgreSQL',table,con.execute('SELECT count(*) AS n FROM '+table+' WHERE school_id=%s',(store.SCHOOL_ID,)).fetchone()['n'])
    print('Migración terminada; Firebase NO fue eliminado. Revisa los conteos ANTES del cambio.')


if __name__=='__main__': main()
