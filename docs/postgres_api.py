"""API de datos PostgreSQL. Firebase Admin solo verifica tokens Google/Firebase Auth.
Ejecutar en el equipo donde está PostgreSQL: python postgres_api.py
NO publicar este servidor ni el puerto PostgreSQL a Internet sin proxy TLS/controles adicionales.
"""
import logging
import threading
import time
import os
from pathlib import Path
from datetime import datetime

from flask import Flask, jsonify, request
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, auth
from psycopg import Error as PgError
from dotenv import load_dotenv

load_dotenv(Path(__file__).with_name('.env'))
import pg_store as store

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
SERVICE_ACCOUNT = os.environ.get('FIREBASE_SERVICE_ACCOUNT', str(Path(__file__).with_name('serviceAccountKey.json')))
if not Path(SERVICE_ACCOUNT).is_absolute():
    SERVICE_ACCOUNT = str(Path(__file__).with_name(SERVICE_ACCOUNT))
if not Path(SERVICE_ACCOUNT).is_file():
    raise SystemExit('Falta Firebase serviceAccountKey.json para comprobar inicio de sesión Google')
if not firebase_admin._apps:
    firebase_admin.initialize_app(credentials.Certificate(SERVICE_ACCOUNT))
app = Flask(__name__)
ORIGINS = [x.strip() for x in os.environ.get('KIOSK_ALLOWED_ORIGINS', 'http://localhost:9002,http://127.0.0.1:9002').split(',') if x.strip()]
CORS(app, resources={r'/api/*':{'origins': ORIGINS}})


def principal(required='staff'):
    header = request.headers.get('Authorization', '')
    if not header.startswith('Bearer '):
        return None, ('Inicia sesión con Google',401)
    try:
        identity = auth.verify_id_token(header[7:], check_revoked=True)
        profile = store.profile(identity['uid'])
    except Exception:
        logging.exception('Error de autenticación o PostgreSQL')
        return None, ('No se pudo verificar la sesión o base de datos',503)
    if required == 'login':
        return (identity,profile), None
    if profile.get('schoolId') != store.SCHOOL_ID or profile.get('active') is not True:
        return None, ('Cuenta sin acceso',403)
    if profile.get('role') not in ('admin','staff'):
        return None, ('Rol no autorizado',403)
    if required == 'admin' and profile.get('role') != 'admin':
        return None, ('Solo administrador',403)
    return (identity,profile), None


def denied(role='staff'):
    person, error = principal(role)
    if error:
        return None, (jsonify({'error':error[0]}),error[1])
    return person, None


@app.errorhandler(ValueError)
def value_error(error):
    return jsonify({'error':str(error)}),400


@app.errorhandler(PgError)
def db_error(error):
    logging.exception('Error PostgreSQL')
    return jsonify({'error':'Error de base de datos. Revisa el servidor PostgreSQL.'}),503


@app.route('/api/health')
def health():
    # Sin información sensible; diagnóstico de conexión a DB.
    with store.connection() as db:
        db.execute('SELECT 1')
    return jsonify({'success':True,'database':'postgresql'})


@app.route('/api/me')
def me():
    person, error = denied('login')
    if error:return error
    _, profile = person
    allowed = profile.get('schoolId')==store.SCHOOL_ID and profile.get('active') is True
    return jsonify({'role':profile.get('role') if allowed else None,
                    'schoolId':store.SCHOOL_ID})


@app.route('/api/students',methods=['GET','POST'])
def students():
    _, error = denied('admin' if request.method=='POST' else 'staff')
    if error:return error
    if request.method=='GET':
        since = request.args.get('since')
        return jsonify({'students':store.all_students(since)})
    return jsonify({'student':store.save_student(request.get_json(silent=True) or {})}),201


@app.route('/api/students/<student_id>',methods=['PATCH','DELETE'])
def student_one(student_id):
    _, error = denied('admin')
    if error:return error
    if request.method=='PATCH':
        return jsonify({'student':store.save_student(request.get_json(silent=True) or {},student_id)})
    # Baja lógica: no elimina el historial de asistencia.
    store.deactivate_student(student_id)
    return jsonify({'success':True, 'message':'Alumno desactivado; detén/sincroniza el sensor'})


@app.route('/api/students/import',methods=['POST'])
def student_import():
    _,error=denied('admin')
    if error:return error
    records=(request.get_json(silent=True) or {}).get('students')
    if not isinstance(records,list) or len(records)>1000:
        raise ValueError('Envía hasta 1000 alumnos en un lote')
    for student in records:
        if not isinstance(student,dict) or not student.get('nombre'):
            raise ValueError('Fila sin nombre')
    # Conservar duplicados antiguos por ID; rechazar matrícula repetida en nuevas importaciones.
    seen={s['matricula'].casefold() for s in store.all_students() if s['matricula']}
    added=0; skipped=0
    for student in records:
        matricula=str(student.get('matricula','')).strip().casefold()
        if matricula and matricula in seen:
            skipped+=1;continue
        store.save_student(student)
        added+=1
        if matricula:seen.add(matricula)
    return jsonify({'added':added,'skipped':skipped})


@app.route('/api/communities',methods=['GET','POST'])
def communities():
    _,error=denied('admin' if request.method=='POST' else 'staff')
    if error:return error
    if request.method=='GET':return jsonify({'communities':store.list_communities()})
    name=str((request.get_json(silent=True) or {}).get('name','')).strip().upper()
    if not name or len(name)>100:raise ValueError('Nombre de comunidad inválido')
    store.add_community(name)
    return jsonify({'success':True})


@app.route('/api/communities/<path:name>',methods=['DELETE'])
def community_del(name):
    _,error=denied('admin')
    if error:return error
    store.remove_community(name)
    return jsonify({'success':True})


@app.route('/api/attendance',methods=['GET','POST'])
def attendance():
    _,error=denied()
    if error:return error
    if request.method=='GET':
        date=request.args.get('date');month=request.args.get('month');sid=request.args.get('studentId')
        if not (date or month or sid):raise ValueError('Solicita un día, mes o alumno')
        if date:datetime.strptime(date,'%Y-%m-%d')
        if month:datetime.strptime(month,'%Y-%m')
        return jsonify({'attendance':store.events(date_str=date,month=month,student_id=sid,changed_since=request.args.get('since'))})
    data=request.get_json(silent=True) or {}
    kind=str(data.get('type',''))
    if kind not in ('entrada','salida','permiso','justificacion'):
        raise ValueError('Tipo inválido')
    at=datetime.fromisoformat(data['timestamp'].replace('Z','+00:00')) if data.get('timestamp') else None
    try:
        item=store.register_event(str(data.get('studentId','')),kind,is_manual=True,at=at,reason=data.get('reason'))
        return jsonify({'attendance':item}),201
    except store.AttendanceExists as exc:
        return jsonify({'error':str(exc)}),409



@app.route('/api/attendance/batch',methods=['POST'])
def attendance_batch():
    # Registrar múltiples entradas o salidas en una sola transacción.
    _,error=denied()
    if error:return error
    data=request.get_json(silent=True) or {}
    records=store.register_events_batch(data.get('studentIds'),str(data.get('type','')))
    return jsonify({'success':True,'count':len(records)}),201



@app.route('/api/attendance/void-batch',methods=['POST'])
def attendance_void_batch():
    person,error=denied('admin')
    if error:return error
    data=request.get_json(silent=True) or {}
    count=store.void_events_batch(data.get('eventIds'),str(data.get('type','')),
                                  data.get('reason'),person[0]['uid'])
    return jsonify({'success':True,'count':count})


@app.route('/api/attendance/<event_id>/void',methods=['POST'])
def attendance_void(event_id):
    person,error=denied('admin')
    if error:return error
    data=request.get_json(silent=True) or {}
    store.void_event(event_id,str(data.get('reason') or 'Corrección administrativa'),person[0]['uid'])
    return jsonify({'success':True})


@app.route('/api/settings',methods=['GET','PUT'])
def settings():
    _,error=denied('admin')
    if error:return error
    if request.method=='GET':return jsonify({'settings':store.get_settings()})
    data=request.get_json(silent=True) or {}
    allowed={key:data[key] for key in ('schoolName','entryTime','exitTime','mailFromName') if key in data}
    store.set_settings(allowed)
    return jsonify({'success':True})


@app.route('/api/users',methods=['POST'])
def users():
    _,error=denied('admin')
    if error:return error
    data=request.get_json(silent=True) or {}
    uid=str(data.get('uid','')).strip(); role=str(data.get('role','')).strip()
    if not uid or len(uid)>256:raise ValueError('UID inválido')
    # Verificar que la cuenta realmente existe en Firebase Authentication.
    auth.get_user(uid)
    store.grant_user(uid,role)
    return jsonify({'success':True})


def email_worker():
    from mailer import email_tutor
    while True:
        try:
            with store.connection() as con:
                emails=con.execute("""SELECT e.id,e.recipient,e.student_name,e.kind FROM email_outbox e
                  JOIN attendance a ON a.id=e.id
                  WHERE e.status='pending' AND e.attempts<5 AND a.voided=false
                  ORDER BY e.created_at LIMIT 20""").fetchall()
            for email in emails:
                ok=email_tutor(email['recipient'],email['student_name'],email['kind'])
                with store.transaction() as con:
                    con.execute("""UPDATE email_outbox SET attempts=attempts+1,
                      status=CASE WHEN %s THEN 'sent' WHEN attempts+1 >= 5 THEN 'failed' ELSE 'pending' END
                      WHERE id=%s AND status='pending'""",(ok,email['id']))
        except Exception:
            logging.exception('Error en cola de correos')
        time.sleep(10)


if __name__=='__main__':
    with store.connection() as db:
        db.execute('SELECT 1')
    threading.Thread(target=email_worker,name='postgres-mail-worker',daemon=True).start()
    app.run(host=os.environ.get('DATA_API_HOST','127.0.0.1'),port=int(os.environ.get('DATA_API_PORT','5050')),
            debug=False,use_reloader=False)
