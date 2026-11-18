"""Persistencia central PostgreSQL de ZENKAY: NO usa Firestore.

Los modelos escolares y las plantillas son exclusivamente de PostgreSQL.
Las plantillas biométricas se cifran con Fernet antes de escribir BYTEA.
"""
from contextlib import contextmanager
from datetime import datetime, date, timezone
from zoneinfo import ZoneInfo
import os
import uuid
import hashlib

import psycopg
from psycopg.rows import dict_row
from cryptography.fernet import Fernet, InvalidToken

SCHOOL_ID = os.environ.get('SCHOOL_ID', 'plantel-10-chicbul').strip()
LOCAL_TZ = ZoneInfo(os.environ.get('SCHOOL_TIMEZONE', 'America/Merida'))


def connection():
    dsn = os.environ.get('DATABASE_URL', '').strip()
    if not dsn:
        raise RuntimeError('Configura DATABASE_URL en docs/.env (PostgreSQL local)')
    return psycopg.connect(dsn, row_factory=dict_row, connect_timeout=5)


@contextmanager
def transaction():
    with connection() as con:
        with con.transaction():
            yield con


def cipher():
    key = os.environ.get('BIOMETRIC_FERNET_KEY', '').strip()
    if not key:
        raise RuntimeError('BIOMETRIC_FERNET_KEY es obligatoria para proteger las huellas')
    return Fernet(key.encode('ascii'))


def student_json(record):
    return { 'id': record['id'], 'matricula': record['matricula'], 'nombre': record['nombre'],
        'telefono_tutor': record['telefono_tutor'], 'correo_tutor': record['correo_tutor'],
        'grupo': record['grupo'], 'comunidad': record['comunidad'],
        'active': record['active'], 'enrollmentStatus': record['enrollment_status'],
        'updatedAt': record['updated_at'].isoformat() if record['updated_at'] else None }


def attendance_json(record):
    return {'id': record['id'], 'studentId': record['student_id'], 'studentName': record['student_name'],
      'timestamp': record['timestamp'].isoformat(), 'type': record['type'], 'isManual': record['is_manual'],
      'reason': record['reason'], 'voided': record['voided'], 'voidReason': record['void_reason'],
      'voidedBy': record['voided_by'], 'voidedAt': record['voided_at'].isoformat() if record['voided_at'] else None }


def profile(uid):
    with connection() as con:
        row = con.execute('SELECT uid, school_id,role,active FROM users WHERE uid=%s', (uid,)).fetchone()
    return ({'schoolId':row['school_id'], 'role':row['role'], 'active':row['active']}
             if row else {})


def all_students(since=None):
    args = [SCHOOL_ID]
    sql = 'SELECT * FROM students WHERE school_id=%s'
    if since:
        sql += ' AND updated_at >= %s'
        args.append(datetime.fromisoformat(since.replace('Z', '+00:00')))
    sql += ' ORDER BY id'
    with connection() as con:
        return [student_json(s) for s in con.execute(sql, args).fetchall()]


def get_student(student_id):
    with connection() as con:
        row = con.execute('SELECT * FROM students WHERE id=%s AND school_id=%s', (student_id,SCHOOL_ID)).fetchone()
    return student_json(row) if row else None


def save_student(data, student_id=None):
    keys = ('matricula','nombre','telefono_tutor','correo_tutor','grupo','comunidad')
    if not str(data.get('nombre','')).strip():
        raise ValueError('Se requiere el nombre del alumno')
    item = {key:str(data.get(key,'')).strip()[:255] for key in keys}
    student_id = student_id or str(uuid.uuid4())
    with transaction() as con:
        result = con.execute('''INSERT INTO students (id,school_id,matricula,nombre,telefono_tutor,correo_tutor,grupo,comunidad)
          VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
          ON CONFLICT(id) DO UPDATE SET matricula=excluded.matricula,nombre=excluded.nombre,
           telefono_tutor=excluded.telefono_tutor,correo_tutor=excluded.correo_tutor,
           grupo=excluded.grupo,comunidad=excluded.comunidad,updated_at=now()
          WHERE students.school_id=excluded.school_id
          RETURNING *''', (student_id,SCHOOL_ID,*(item[k] for k in keys))).fetchone()
        if result is None: raise ValueError('Alumno de otro plantel')
        return student_json(result)


def deactivate_student(student_id):
    with transaction() as con:
        result = con.execute("""UPDATE students SET active=false,enrollment_status='removed',updated_at=now()
          WHERE id=%s AND school_id=%s RETURNING id""", (student_id,SCHOOL_ID)).fetchone()
        if not result: raise ValueError('Alumno no encontrado')
        con.execute('DELETE FROM fingerprints WHERE student_id=%s AND school_id=%s', (student_id,SCHOOL_ID))
    return True


def list_biometrics(since=None):
    """Recupera todas las plantillas o solo altas/cambios.
    La baja se detecta por students.enrollment_status = pending/removed.
    """
    args = [SCHOOL_ID]
    where = 's.school_id=%s'
    if since:
        where += ' AND GREATEST(s.updated_at,coalesce(f.updated_at,s.updated_at)) >= %s'
        args.append(since)
    sql = f'''SELECT s.id,s.nombre,s.correo_tutor,s.active,s.enrollment_status,
                   f.template_ciphertext
          FROM students s LEFT JOIN fingerprints f ON f.student_id=s.id AND f.school_id=s.school_id
          WHERE {where} ORDER BY s.id'''
    with connection() as con:
        rows = con.execute(sql, args).fetchall()
    crypt = cipher()
    result = {}
    for row in rows:
        try:
            template = crypt.decrypt(bytes(row['template_ciphertext'])) if row['template_ciphertext'] else None
        except InvalidToken as exc:
            raise RuntimeError('La clave biométrica no corresponde con la utilizada al guardar plantillas') from exc
        result[row['id']] = {'student': {'nombre':row['nombre'],'correo_tutor':row['correo_tutor'],
                'active':row['active'], 'enrollmentStatus':row['enrollment_status']},
                'template':template}
    return result


def get_biometric(student_id):
    records = list_biometrics_for_id(student_id)
    return records.get(student_id)


def list_biometrics_for_id(student_id):
    with connection() as con:
        rows = con.execute('''SELECT s.id,s.nombre,s.correo_tutor,s.active,s.enrollment_status,
           f.template_ciphertext FROM students s LEFT JOIN fingerprints f ON f.student_id=s.id
           WHERE s.school_id=%s AND s.id=%s''', (SCHOOL_ID,student_id)).fetchall()
    crypt = cipher()
    return {row['id']: {'student':{'nombre':row['nombre'],'correo_tutor':row['correo_tutor'],
      'active':row['active'], 'enrollmentStatus':row['enrollment_status']},
      'template':crypt.decrypt(bytes(row['template_ciphertext'])) if row['template_ciphertext'] else None} for row in rows}


def remove_fingerprint(student_id):
    # Una sola transacción revoca la plantilla biométrica y deja una lápida temporal.
    with transaction() as con:
        row = con.execute("""UPDATE students SET enrollment_status='pending',updated_at=now()
          WHERE id=%s AND school_id=%s AND active=true RETURNING id""", (student_id,SCHOOL_ID)).fetchone()
        if not row: raise ValueError('Alumno no encontrado o inactivo')
        deleted = con.execute('DELETE FROM fingerprints WHERE student_id=%s AND school_id=%s RETURNING student_id', (student_id,SCHOOL_ID)).fetchone()
        con.execute('''INSERT INTO fingerprint_audit(id,school_id,student_id,action,details)
                       VALUES (%s,%s,%s,%s,%s)''',
                    (str(uuid.uuid4()), SCHOOL_ID, student_id, 'deleted',
                     'Plantilla revocada; historial de asistencias conservado' if deleted else 'Solicitud de eliminación; sin plantilla activa'))


def save_fingerprint(student_id, raw):
    encrypted = cipher().encrypt(bytes(raw))
    with transaction() as con:
        row = con.execute("SELECT id FROM students WHERE id=%s AND school_id=%s AND active=true FOR UPDATE", (student_id,SCHOOL_ID)).fetchone()
        if not row: raise ValueError('Alumno inexistente o inactivo')
        con.execute('''INSERT INTO fingerprints(student_id,school_id,template_ciphertext) VALUES (%s,%s,%s)
          ON CONFLICT(student_id) DO UPDATE SET template_ciphertext=excluded.template_ciphertext,updated_at=now()''',
          (student_id,SCHOOL_ID,encrypted))
        con.execute("UPDATE students SET enrollment_status='done', updated_at=now() WHERE id=%s", (student_id,))
        con.execute('''INSERT INTO fingerprint_audit(id,school_id,student_id,action,details)
                       VALUES (%s,%s,%s,'enrolled',%s)''',
                    (str(uuid.uuid4()), SCHOOL_ID, student_id, 'Plantilla registrada o reemplazada'))


def events(date_str=None, student_id=None, month=None, changed_since=None):
    args = [SCHOOL_ID]
    where = ['school_id=%s']
    if date_str:
        where.append('local_date=%s'); args.append(date_str)
    if month:
        # fechas sin zona horaria, calcula en PostgreSQL por día escolar local guardado
        first = date.fromisoformat(month + '-01')
        next_month = date(first.year + (first.month==12), first.month%12+1, 1)
        where.extend(['local_date >= %s','local_date < %s']); args.extend([first,next_month])
    if student_id:
        where.append('student_id=%s'); args.append(student_id)
    if changed_since:
        where.append('updated_at >= %s'); args.append(datetime.fromisoformat(changed_since.replace('Z','+00:00')))
    sql = 'SELECT * FROM attendance WHERE ' + ' AND '.join(where) + ' ORDER BY timestamp DESC,id'
    with connection() as con:
        return [attendance_json(row) for row in con.execute(sql,args).fetchall()]


class AttendanceExists(Exception): pass


def register_event(student_id, kind, *, is_manual=False, at=None, reason=None, name=None, event_id=None, template=None):
    if kind not in ('entrada','salida','permiso','justificacion'):
        raise ValueError('Tipo de asistencia inválido')
    if not is_manual and kind not in ('entrada','salida'):
        raise ValueError('Tipo biométrico inválido')
    now = at or datetime.now(timezone.utc)
    if now.tzinfo is None:
        raise ValueError('El timestamp debe tener zona horaria')
    local_date = now.astimezone(LOCAL_TZ).date()
    event_id = event_id or str(uuid.uuid4())
    with transaction() as con:
        # Bloqueo transaccional por alumno/día/tipo impide carreras entre modo manual y lector.
        h = int.from_bytes(hashlib.sha256(f'{SCHOOL_ID}|{student_id}|{local_date}|{kind}'.encode()).digest()[:8], 'big', signed=True)
        con.execute('SELECT pg_advisory_xact_lock(%s)', (h,))
        student = con.execute('SELECT * FROM students WHERE id=%s AND school_id=%s AND active=true FOR SHARE',
                               (student_id,SCHOOL_ID)).fetchone()
        if not student: raise ValueError('Alumno inactivo o inexistente')
        # Permitir múltiples entradas y salidas por día; cada movimiento es un evento independiente.
        if not is_manual:
            linked = con.execute('SELECT template_ciphertext FROM fingerprints WHERE student_id=%s AND school_id=%s FOR SHARE',
                                 (student_id,SCHOOL_ID)).fetchone()
            if not linked: raise ValueError('La plantilla biométrica ya fue eliminada')
            if template is None or cipher().decrypt(bytes(linked['template_ciphertext'])) != bytes(template):
                raise ValueError('La plantilla registrada cambió: sincroniza el lector')
        con.execute('''INSERT INTO attendance(id,school_id,student_id,student_name,timestamp,local_date,type,is_manual,reason)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)''',
           (event_id,SCHOOL_ID,student_id,name or student['nombre'],now,local_date,kind,is_manual,reason))
        if student['correo_tutor'] and kind in ('entrada','salida'):
            con.execute('''INSERT INTO email_outbox(id,recipient,student_name,kind) VALUES (%s,%s,%s,%s)
            ON CONFLICT (id) DO NOTHING''', (event_id,student['correo_tutor'],student['nombre'],kind))
    return {'id':event_id,'studentId':student_id,'studentName':name or student['nombre'],'timestamp':now.isoformat(),
            'type':kind,'isManual':is_manual}



def register_events_batch(student_ids, kind):
    # Lote manual: todo o nada, evitando altas parciales en un grupo.
    if kind not in ('entrada', 'salida'):
        raise ValueError('El registro masivo solo acepta entrada o salida')
    if not isinstance(student_ids, list) or not 1 <= len(student_ids) <= 150:
        raise ValueError('Selecciona entre 1 y 150 alumnos')
    if any(not isinstance(sid, str) or not sid.strip() or len(sid) > 255 for sid in student_ids):
        raise ValueError('ID de alumno inválido')
    student_ids = [sid.strip() for sid in student_ids]
    if len(student_ids) != len(set(student_ids)):
        raise ValueError('Hay alumnos duplicados en la selección')

    now = datetime.now(timezone.utc)
    local_date = now.astimezone(LOCAL_TZ).date()
    created = []
    with transaction() as con:
        rows = con.execute('''SELECT id,nombre,correo_tutor FROM students
            WHERE school_id=%s AND active=true AND id=ANY(%s) FOR SHARE''',
            (SCHOOL_ID, student_ids)).fetchall()
        by_id = {student['id']: student for student in rows}
        if len(by_id) != len(student_ids):
            raise ValueError('Uno o más alumnos ya no existen o están inactivos. Actualiza la lista.')
        for sid in student_ids:
            student = by_id[sid]
            event_id = str(uuid.uuid4())
            con.execute('''INSERT INTO attendance
              (id,school_id,student_id,student_name,timestamp,local_date,type,is_manual)
              VALUES (%s,%s,%s,%s,%s,%s,%s,true)''',
              (event_id,SCHOOL_ID,sid,student['nombre'],now,local_date,kind))
            if student['correo_tutor']:
                con.execute('''INSERT INTO email_outbox(id,recipient,student_name,kind)
                  VALUES (%s,%s,%s,%s)''',
                  (event_id,student['correo_tutor'],student['nombre'],kind))
            created.append({'id':event_id, 'studentId':sid, 'type':kind})
    return created


def void_event(event_id, reason, uid):
    with transaction() as con:
        row = con.execute('''UPDATE attendance SET voided=true,void_reason=%s,voided_by=%s,
          voided_at=now(),updated_at=now() WHERE id=%s AND school_id=%s AND voided=false RETURNING id''',
          (reason[:500],uid,event_id,SCHOOL_ID)).fetchone()
        if not row: raise ValueError('Registro inexistente o ya anulado')
        # Evita enviar correos que todavía están pendientes. Los enviados no pueden recuperarse.
        con.execute("UPDATE email_outbox SET status='cancelled' WHERE id=%s AND status='pending'", (event_id,))



def void_events_batch(event_ids, kind, reason, uid):
    # Anular en una sola transacción las últimas entradas/salidas manuales seleccionadas.
    if kind not in ('entrada', 'salida'):
        raise ValueError('Solo se pueden anular entradas o salidas manuales en lote')
    if not isinstance(event_ids, list) or not 1 <= len(event_ids) <= 150:
        raise ValueError('Selecciona entre 1 y 150 movimientos para anular')
    if any(not isinstance(item, str) or not item.strip() or len(item) > 255 for item in event_ids):
        raise ValueError('ID de movimiento inválido')
    event_ids = [item.strip() for item in event_ids]
    if len(event_ids) != len(set(event_ids)):
        raise ValueError('Hay movimientos duplicados en la selección')
    if not isinstance(reason, str) or not reason.strip():
        raise ValueError('Es obligatorio escribir el motivo de la anulación')
    with transaction() as con:
        rows = con.execute('''UPDATE attendance SET voided=true,void_reason=%s,voided_by=%s,
          voided_at=now(),updated_at=now()
          WHERE id=ANY(%s) AND school_id=%s AND type=%s AND is_manual=true AND voided=false
          RETURNING id''', (reason.strip()[:500],uid,event_ids,SCHOOL_ID,kind)).fetchall()
        if len(rows) != len(event_ids):
            raise ValueError('Una o más asistencias cambiaron o ya fueron anuladas. Actualiza la pantalla.')
        con.execute("UPDATE email_outbox SET status='cancelled' WHERE id=ANY(%s) AND status='pending'",(event_ids,))
    return len(event_ids)


def get_settings():
    with connection() as con:
        row = con.execute("SELECT payload FROM settings WHERE school_id=%s AND key='general'",(SCHOOL_ID,)).fetchone()
    return row['payload'] if row else {}


def set_settings(payload):
    import json
    with transaction() as con:
        con.execute("""INSERT INTO settings(school_id,key,payload) VALUES (%s,'general',%s::jsonb)
          ON CONFLICT(school_id,key) DO UPDATE SET payload=excluded.payload""", (SCHOOL_ID,json.dumps(payload)))


def list_communities():
    with connection() as con:
        return [r['name'] for r in con.execute('SELECT name FROM communities WHERE school_id=%s ORDER BY name', (SCHOOL_ID,)).fetchall()]


def grant_user(uid,role,active=True):
    if role not in ('admin','staff'): raise ValueError('Rol inválido')
    with transaction() as con:
        con.execute('''INSERT INTO users(uid,school_id,role,active) VALUES (%s,%s,%s,%s)
          ON CONFLICT(uid) DO UPDATE SET school_id=excluded.school_id,role=excluded.role,
             active=excluded.active,updated_at=now()''',(uid,SCHOOL_ID,role,active))


def add_community(name):
    with transaction() as con:
        con.execute('INSERT INTO communities(school_id,name) VALUES (%s,%s) ON CONFLICT DO NOTHING', (SCHOOL_ID,name.upper().strip()))


def remove_community(name):
    with transaction() as con:
        con.execute('DELETE FROM communities WHERE school_id=%s AND name=%s', (SCHOOL_ID,name.upper().strip()))
