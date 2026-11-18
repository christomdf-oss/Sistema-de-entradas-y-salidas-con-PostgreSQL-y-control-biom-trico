"""ZENKAY V9: ZK9500 + PostgreSQL local; Firebase únicamente verifica tokens de acceso Google."""
import logging
import uuid
import os
import smtplib
import threading
import time
from datetime import datetime, timezone, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr
from html import escape as html_escape
from pathlib import Path

from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO
import firebase_admin
from firebase_admin import auth, credentials

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).with_name('.env'))
except ImportError:
    pass

# Windows debe localizar las DLL del SDK instaladas junto al servicio.
if os.name == 'nt' and hasattr(os, 'add_dll_directory'):
    os.add_dll_directory(str(Path(__file__).resolve().parent))

# pythonnet carga clases .NET dinámicamente, Pylance podría marcarlas en amarillo.
import clr  # noqa: F401
from System import Array, Byte
from pyzkfp import ZKFP2
from biometric_cache import event_id_for
import pg_store as store

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
SCHOOL_ID = os.environ.get('SCHOOL_ID', 'plantel-10-chicbul').strip()
FIREBASE_CREDENTIALS = os.environ.get('FIREBASE_SERVICE_ACCOUNT', str(Path(__file__).with_name('serviceAccountKey.json')))
# PostgreSQL local: inicio carga huellas una vez; luego solo cambios.
ALLOWED_ORIGINS = [s.strip() for s in os.environ.get('KIOSK_ALLOWED_ORIGINS', 'http://localhost:9002,http://127.0.0.1:9002').split(',') if s.strip()]
if not SCHOOL_ID or '/' in SCHOOL_ID:
    raise SystemExit('SCHOOL_ID inválido')
if not Path(FIREBASE_CREDENTIALS).is_absolute():
    FIREBASE_CREDENTIALS = str(Path(__file__).with_name(FIREBASE_CREDENTIALS))
if not Path(FIREBASE_CREDENTIALS).is_file():
    raise SystemExit('Falta serviceAccountKey.json para Firebase Authentication')
if not firebase_admin._apps:
    firebase_admin.initialize_app(credentials.Certificate(FIREBASE_CREDENTIALS))
# Fallar al iniciar si no hay PostgreSQL o falta la clave biométrica.
store.cipher()
with store.connection() as db_check:
    db_check.execute('SELECT 1')

app = Flask(__name__)
CORS(app, resources={r'/api/*': {'origins': ALLOWED_ORIGINS}}, supports_credentials=False)
socketio = SocketIO(app, cors_allowed_origins=ALLOWED_ORIGINS, async_mode='threading')
sensor_lock = threading.RLock()
students_db = {}  # sensor_id -> {studentId, nombre, correo, template}
attendance_mode = False
attendance_type = 'entrada'
attendance_thread = None
state_lock = threading.RLock()
_sensor_dirty = False
_recent_success = {}  # (kind, studentId) -> monotonic de última lectura; evita dobles lecturas accidentales
_last_sync = None
_sync_ready = False


# Caché corta por UID para evitar leer users/{uid} en cada consulta de estado.
# En caso de error de Firebase y caché caducada, el acceso se rechaza (fail closed).
ROLE_CACHE_SECONDS = 60
REVOCATION_CACHE_SECONDS = 60
_auth_cache_lock = threading.RLock()
_role_cache = {}  # uid -> (monotonic_expiry, profile)
_revocation_cache = {}  # uid -> monotonic_expiry


def authorized_identity(token):
    """Verifica firma y vigencia del JWT en cada petición.

    La revocación se comprueba contra Firebase Authentication, como máximo una
    vez por minuto por usuario; no se omite el control de revocación indefinidamente.
    """
    identity = auth.verify_id_token(token, check_revoked=False)
    uid = identity['uid']
    with _auth_cache_lock:
        fresh = _revocation_cache.get(uid, 0) > time.monotonic()
    if not fresh:
        # Si la red o la cuota falla, NO se acepta la solicitud.
        auth.verify_id_token(token, check_revoked=True)
        with _auth_cache_lock:
            _revocation_cache[uid] = time.monotonic() + REVOCATION_CACHE_SECONDS
    return identity


def authorized_profile(uid):
    with _auth_cache_lock:
        entry = _role_cache.get(uid)
        if entry and entry[0] > time.monotonic():
            return entry[1]
    # Los permisos se guardan exclusivamente en PostgreSQL.
    profile = store.profile(uid)
    with _auth_cache_lock:
        _role_cache[uid] = (time.monotonic() + ROLE_CACHE_SECONDS, profile)
    return profile


def require_role(required='staff'):
    header = request.headers.get('Authorization', '')
    if not header.startswith('Bearer '):
        return None, ('Se requiere inicio de sesión', 401)
    try:
        identity = authorized_identity(header[7:])
        profile = authorized_profile(identity['uid'])
        if profile.get('active') is not True or profile.get('schoolId') != SCHOOL_ID:
            return None, ('Cuenta sin acceso a este plantel', 403)
        if profile.get('role') not in ('admin', 'staff'):
            return None, ('Rol no autorizado', 403)
        if required == 'admin' and profile['role'] != 'admin':
            return None, ('Se requieren permisos de administrador', 403)
        return identity, None
    except Exception as exc:
        logging.warning('No se pudo autorizar sesión: %s', exc.__class__.__name__)
        return None, ('No se pudo verificar la sesión o PostgreSQL', 503)


def protected(required='staff'):
    _, err = require_role(required)
    if err:
        return jsonify({'success': False, 'error': err[0]}), err[1]
    return None


def normalize_template(raw):
    if isinstance(raw, (bytes, bytearray)):
        return Array[Byte](raw)
    if 'System.Byte[]' in str(type(raw)):
        return raw
    if isinstance(raw, (tuple, list)):
        for item in raw:
            try:
                return normalize_template(item)
            except (TypeError, ValueError):
                continue
    raise ValueError('El SDK devolvió un formato de huella inesperado')


def from_capture(result):
    if isinstance(result, (tuple, list)):
        if not result:
            raise ValueError('Captura vacía')
        return normalize_template(result[0])
    return normalize_template(result)


logging.info('Inicializando ZK9500...')
zkfp = ZKFP2()
zkfp.Init()
zkfp.OpenDevice(0)
logging.info('Sensor listo')


def _rebuild_sdk(records):
    """Reconstruir únicamente la DB local del SDK; sin descargas de Firebase."""
    global students_db, _sensor_dirty
    _sensor_dirty = True
    if hasattr(zkfp, 'DBClear'):
        zkfp.DBClear()
    else:
        for old_id in students_db:
            zkfp.DBDel(old_id)
    prepared = {}
    for sid, student_id in enumerate(sorted(records), 1):
        record = records[student_id]
        profile = record.get('student') or {}
        encoded = record.get('template')
        if profile.get('active') is False or profile.get('enrollmentStatus') in ('removed', 'pending') or not encoded:
            continue
        try:
            raw = bytes(encoded)
            if not raw:
                continue
            zkfp.DBAdd(sid, normalize_template(raw))
            prepared[sid] = {'studentId': student_id, 'nombre': profile.get('nombre') or 'Alumno',
                             'correo': profile.get('correo_tutor') or '', 'template': raw}
        except Exception:
            logging.exception('No se pudo cargar huella del alumno %s', student_id)
            raise RuntimeError('Fallo al cargar huellas; reinicia el servicio antes de operar')
    students_db = prepared
    _sensor_dirty = False
    logging.info('Plantillas en lector (carga LOCAL): %d', len(students_db))


def _update_one_sdk(student_id, profile, raw):
    """Reemplaza/agrega UNA plantilla en el algoritmo local (sin 400 DBAdd)."""
    global _sensor_dirty
    if _sensor_dirty:
        raise RuntimeError('La DB del lector está inconsistente; sincroniza antes de inscribir')
    previous = next((sid for sid, person in students_db.items()
                     if person['studentId'] == student_id), None)
    sid = previous if previous is not None else max(students_db, default=0) + 1
    _sensor_dirty = True
    if previous is not None:
        zkfp.DBDel(previous)
    zkfp.DBAdd(sid, normalize_template(raw))
    students_db[sid] = {'studentId': student_id, 'nombre': profile.get('nombre') or 'Alumno',
                        'correo': profile.get('correo_tutor') or '', 'template': raw}
    _sensor_dirty = False



def _remove_one_sdk(student_id):
    """Quita inmediatamente la plantilla del algoritmo ZKFP2, sin reinicializarlo."""
    global _sensor_dirty
    sid = next((key for key, item in students_db.items()
                if item['studentId'] == student_id), None)
    if sid is None:
        return
    _sensor_dirty = True
    try:
        zkfp.DBDel(sid)
        del students_db[sid]
    except Exception:
        # No permitir capturas si el SDK y PostgreSQL pudieran discrepar.
        logging.exception('No se pudo eliminar la plantilla del SDK')
        raise
    else:
        _sensor_dirty = False


def sync_students(force=False):
    """Una carga al iniciar; luego únicamente filas SQL modificadas.

    NO usa Firestore, ni descarga huellas al registrar entrada/salida.
    Los cambios en PostgreSQL se detectan al pasar entre modos o pulsar sincronizar.
    """
    global _last_sync, _sync_ready
    with sensor_lock:
        if attendance_mode or (attendance_thread is not None and attendance_thread.is_alive()):
            raise RuntimeError('Detén el lector antes de sincronizar')
        since = None if force or not _sync_ready else _last_sync
        # Margen de seguridad contra operaciones concurrentes.
        next_cursor = datetime.now(timezone.utc) - timedelta(seconds=2)
        changed = store.list_biometrics(since=since)
        if since is None or _sensor_dirty:
            _rebuild_sdk(changed if since is None else store.list_biometrics())
            logging.info('Huellas cargadas desde PostgreSQL: %d', len(students_db))
        else:
            for student_id, record in changed.items():
                profile = record['student']
                raw = record.get('template')
                if profile.get('active') is False or profile.get('enrollmentStatus') in ('removed','pending') or not raw:
                    _remove_one_sdk(student_id)
                else:
                    _update_one_sdk(student_id,profile,raw)
            if changed:
                logging.info('Sincronización incremental PostgreSQL: %d alumnos',len(changed))
        _last_sync = next_cursor
        _sync_ready = True
        return len(students_db)


def validate_student(student_id, template):
    """Una consulta SQL puntual al alumno/plantilla; nunca lee 400 documentos."""
    record=store.get_biometric(student_id)
    if not record or not record['student'].get('active') or not record.get('template'):
        return None
    if record['student'].get('enrollmentStatus') != 'done':
        return None
    if record['template'] != bytes(template):
        return None
    return record['student']


from mailer import email_tutor


def register_attendance(sid, kind):
    person = students_db.get(sid)
    if not person:
        return
    student_id = person['studentId']
    dedupe_key = (kind, student_id)
    now_tick = time.monotonic()
    if now_tick - _recent_success.get(dedupe_key, -1e9) < 10:
        socketio.emit('attendance_error', {'error':'Lectura reciente; espera 10 segundos para volver a marcar el mismo movimiento'})
        return
    try:
        data = validate_student(student_id, person['template'])
        if not data:
            socketio.emit('attendance_error', {'error':'Alumno o huella desactualizada. Sincroniza el lector.'})
            return
        event_id = str(uuid.uuid4())
        store.register_event(student_id,kind,is_manual=False,event_id=event_id,
                             template=person['template'])
        _recent_success[dedupe_key] = time.monotonic()
        socketio.emit('attendance_marked', {'studentId':student_id,'studentName':data.get('nombre') or person['nombre'],
                      'action':kind,'hora':datetime.now().strftime('%H:%M')})
    except store.AttendanceExists:
        _recent_success[dedupe_key] = time.monotonic()
        socketio.emit('attendance_error', {'error':'Movimiento duplicado; vuelve a intentar'})
    except Exception:
        logging.exception('Error PostgreSQL/validación: asistencia NO guardada')
        socketio.emit('attendance_error', {'error':'No se guardó la asistencia. Revisa PostgreSQL.'})


def email_worker():
    """Buzón de correos PostgreSQL; reintentos sin duplicar entradas escolares.
    Una interrupción tras SMTP puede reenviar un mensaje, pero no una asistencia.
    """
    while True:
        try:
            with store.connection() as con:
                pending=con.execute("""SELECT id,recipient,student_name,kind,attempts
                     FROM email_outbox WHERE status='pending' AND attempts<5
                     ORDER BY created_at LIMIT 10""").fetchall()
            for item in pending:
                ok=email_tutor(item['recipient'],item['student_name'],item['kind'])
                with store.transaction() as con:
                    con.execute("""UPDATE email_outbox SET attempts=attempts+1,
                      status=CASE WHEN %s THEN 'sent' WHEN attempts+1>=5 THEN 'failed' ELSE 'pending' END
                      WHERE id=%s AND status='pending'""",(ok,item['id']))
        except Exception:
            logging.exception('Error al procesar correo desde PostgreSQL')
        time.sleep(10)


def attendance_loop():
    global attendance_mode
    waiting_for_lift = False
    while attendance_mode:
        try:
            with sensor_lock:
                result = zkfp.AcquireFingerprint()
                if not result:
                    waiting_for_lift = False
                identified = zkfp.DBIdentify(from_capture(result)) if result and not waiting_for_lift else None
            if not attendance_mode:
                break
            if not result or waiting_for_lift:
                time.sleep(0.2)
                continue
            waiting_for_lift = True  # un intento por colocación; exigir retirar el dedo
            value = identified[0] if isinstance(identified, (tuple, list)) else identified
            try:
                sid = int(value)  # pyzkfp/pythonnet puede devolver System.Int32
            except (TypeError, ValueError):
                sid = 0
            if sid > 0 and sid in students_db:
                register_attendance(sid, attendance_type)
            else:
                socketio.emit('attendance_error', {'error': 'Huella no reconocida'})
            time.sleep(0.2)
        except Exception:
            logging.exception('Error biométrico; asistencia detenida por seguridad')
            attendance_mode = False
            socketio.emit('attendance_error', {'error': 'Error del lector; asistencia detenida'})


@app.route('/api/attendance-status', methods=['GET'])
def attendance_status():
    denial = protected()
    if denial:
        return denial
    return jsonify({'success': True, 'status': 'connected', 'students_loaded': len(students_db),
                    'attendance_mode': attendance_mode, 'attendance_type': attendance_type,
                    'schoolId': SCHOOL_ID})


@app.route('/api/start-attendance', methods=['POST'])
def start_attendance():
    global attendance_mode, attendance_type, attendance_thread
    denial = protected()
    if denial:
        return denial
    kind = (request.get_json(silent=True) or {}).get('type', 'entrada')
    if kind not in ('entrada', 'salida'):
        return jsonify({'success': False, 'error': 'Modo inválido'}), 400
    with state_lock:
        if attendance_mode or (attendance_thread is not None and attendance_thread.is_alive()):
            return jsonify({'success': False, 'error': 'El lector está activo o terminando la captura'}), 409
        try:
            sync_students(force=False)
        except Exception:
            logging.exception('Sincronización fallida; modo de asistencia bloqueado')
            return jsonify({'success': False, 'error': 'No se pudo sincronizar las huellas con PostgreSQL'}), 503
        if not students_db:
            return jsonify({'success': False, 'error': 'No hay huellas activas; registra un alumno primero'}), 409
        attendance_type = kind
        attendance_mode = True
        attendance_thread = threading.Thread(target=attendance_loop, daemon=True)
        attendance_thread.start()
    return jsonify({'success': True, 'type': kind})


@app.route('/api/stop-attendance', methods=['POST'])
def stop_attendance():
    global attendance_mode
    denial = protected()
    if denial:
        return denial
    with state_lock:
        attendance_mode = False
        worker = attendance_thread
    if worker is not None and worker.is_alive():
        worker.join(timeout=5)
        if worker.is_alive():
            return jsonify({'success': False, 'error': 'Lector todavía deteniéndose; vuelve a intentarlo'}), 409
    return jsonify({'success': True})


@app.route('/api/sync', methods=['POST'])
def sync_endpoint():
    denial = protected('admin')
    if denial:
        return denial
    with state_lock:
        if attendance_mode or (attendance_thread is not None and attendance_thread.is_alive()):
            return jsonify({'success': False, 'error': 'Detén la asistencia antes de sincronizar'}), 409
        try:
            return jsonify({'success': True, 'students_loaded': sync_students(force=True)})
        except Exception:
            logging.exception('Sincronización completa fallida')
            return jsonify({'success': False, 'error': 'Sincronización fallida'}), 503



@app.route('/api/remove-fingerprint', methods=['POST'])
def remove_fingerprint():
    """Revoca la plantilla real y reconstruye DB LOCAL del ZK9500 para quitar residuos.
    No borra los eventos históricos de entrada/salida.
    """
    denial = protected('admin')
    if denial: return denial
    payload=request.get_json(silent=True) or {}
    student_id=str(payload.get('studentId','')).strip()
    if not student_id or '/' in student_id or payload.get('schoolId')!=SCHOOL_ID:
        return jsonify({'success':False,'error':'Alumno/plantel inválido'}),400
    with state_lock:
        if attendance_mode or (attendance_thread is not None and attendance_thread.is_alive()):
            return jsonify({'success':False,'error':'Detén la asistencia antes de borrar huellas'}),409
        try:
            with sensor_lock:
                # PostgreSQL se actualiza primero: ante fallo del SDK el sistema ya no acepta la huella.
                store.remove_fingerprint(student_id)
                # DBClear + DBAdd de plantillas restantes borra posibles huellas fantasma del SDK.
                # Es una carga LOCAL, sin lecturas de Firestore.
                _rebuild_sdk(store.list_biometrics())
                if store.get_biometric(student_id)['template'] is not None:
                    raise RuntimeError('No se confirmó el borrado en PostgreSQL')
            logging.info('HUELLA BORRADA de PostgreSQL y DB del SDK para %s',student_id)
            return jsonify({'success':True,'studentId':student_id,
                            'message':'Plantilla borrada. Historial de asistencias conservado.'})
        except Exception:
            logging.exception('Borrado incompleto; comprobar SDK y PostgreSQL')
            return jsonify({'success':False,'error':
                'No se completó la limpieza del lector; reinicia el servicio y sincroniza antes de registrar otra huella.'}),503


@app.route('/api/enroll', methods=['POST'])
def enroll_fingerprint():
    denial = protected('admin')
    if denial:
        return denial
    payload = request.get_json(silent=True) or {}
    student_id = str(payload.get('studentId', '')).strip()
    if not student_id or '/' in student_id or payload.get('schoolId') != SCHOOL_ID:
        return jsonify({'success': False, 'error': 'ID de alumno/plantel inválido'}), 400
    with state_lock:
        if attendance_mode or (attendance_thread is not None and attendance_thread.is_alive()):
            return jsonify({'success': False, 'error': 'Detén la asistencia antes de registrar huellas'}), 409
        try:
            if _sensor_dirty or not _sync_ready:
                sync_students(force=False)
            profile=store.get_student(student_id)
            if not profile or profile.get('active') is False:
                return jsonify({'success':False,'error':'Alumno inactivo o inexistente'}),404
            with sensor_lock:
                samples = []
                finger_lifted = True
                deadline = time.monotonic() + 90
                while len(samples) < 4 and time.monotonic() < deadline:
                    result = zkfp.AcquireFingerprint()
                    if not result:
                        finger_lifted = True
                        time.sleep(0.15)
                        continue
                    if not finger_lifted:
                        time.sleep(0.15)
                        continue
                    sample = from_capture(result)
                    # Confirmar que todas las muestras corresponden al mismo dedo.
                    if samples and zkfp.DBMatch(samples[-1], sample) <= 0:
                        return jsonify({'success': False, 'error': 'Las capturas no coinciden; registra el mismo dedo cuatro veces'}), 422
                    samples.append(sample)
                    finger_lifted = False  # exigir retirar el dedo antes de la siguiente lectura
                    socketio.emit('enroll_progress', {'studentId': student_id, 'captured': len(samples), 'total': 4})
                    time.sleep(0.15)
                if len(samples) != 4:
                    return jsonify({'success': False, 'error': 'No se completaron las cuatro capturas en 90 segundos'}), 408
                # El SDK combina exactamente TRES muestras; la cuarta verifica el resultado.
                merged = normalize_template(zkfp.DBMerge(samples[0], samples[1], samples[2]))
                if zkfp.DBMatch(merged, samples[3]) <= 0:
                    return jsonify({'success': False, 'error': 'La cuarta captura no coincide con la huella registrada'}), 422
                # Evitar asignar la misma huella a dos alumnos distintos.
                for other in students_db.values():
                    if other['studentId'] != student_id and zkfp.DBMatch(merged, normalize_template(other['template'])) > 0:
                        return jsonify({'success': False, 'error': 'Esta huella ya pertenece a otro alumno'}), 409
                fresh=store.get_student(student_id)
                if not fresh or fresh.get('active') is False:
                    return jsonify({'success':False,'error':'Alumno desactivado durante la captura'}),409
                # Solo una plantilla cifrada en PostgreSQL, no se conservan duplicados.
                store.save_fingerprint(student_id,bytes(merged))
                try:
                    _update_one_sdk(student_id,fresh,bytes(merged))
                except Exception:
                    logging.exception('Plantilla guardada en PostgreSQL; sincronización local fallida')
                    return jsonify({'success':False,'error':
                         'La huella quedó guardada, pero el lector no la cargó. Reinicia y sincroniza.'}),503
            logging.info('Huella registrada para %s (cuatro capturas; sin recarga masiva)', student_id)
            return jsonify({'success': True, 'studentId': student_id})
        except Exception:
            logging.exception('Falló el registro biométrico')
            return jsonify({'success': False, 'error': 'No se completó el registro; revisa los registros del servidor'}), 500


@app.route('/api/email-status', methods=['GET'])
def email_status():
    denial = protected('admin')
    if denial:
        return denial
    configured = bool(os.environ.get('GMAIL_USER', '').strip() and
                      os.environ.get('GMAIL_APP_PASSWORD', '').strip())
    return jsonify({'success': True, 'configured': configured,
                    'sender': os.environ.get('GMAIL_USER', '').strip() if configured else None})


@app.route('/api/test-email', methods=['POST'])
def test_email():
    denial = protected('admin')
    if denial:
        return denial
    payload = request.get_json(silent=True) or {}
    recipient = str(payload.get('to', '')).strip()
    from email.utils import parseaddr
    if not recipient or parseaddr(recipient)[1] != recipient or '@' not in recipient or len(recipient) > 254:
        return jsonify({'success': False, 'error': 'Destinatario inválido'}), 400
    if not email_tutor(recipient, 'Alumno de prueba', 'entrada'):
        return jsonify({'success': False, 'error': 'Falló la configuración o el envío SMTP; consulta el terminal Python'}), 503
    return jsonify({'success': True, 'message': 'Correo de prueba enviado'})


@app.route('/api/students', methods=['GET'])
def list_students():
    denial = protected('admin')
    if denial:
        return denial
    return jsonify({'success': True, 'students': [{'studentId': d['studentId'], 'nombre': d['nombre']} for d in students_db.values()]})


@socketio.on('connect')
def authorize_socket(auth_data=None):
    try:
        token = (auth_data or {}).get('token', '')
        identity = authorized_identity(token)
        profile = authorized_profile(identity['uid'])
        return (profile.get('schoolId') == SCHOOL_ID and
                profile.get('active') is True and
                profile.get('role') in ('admin', 'staff'))
    except Exception as exc:
        logging.warning('Conexión de eventos rechazada: %s', exc.__class__.__name__)
        return False


if __name__ == '__main__':
    # En V9 el servidor postgres_api.py procesa la bandeja SMTP.
    try:
        sync_students(force=False)
    except Exception:
        logging.exception('Sin PostgreSQL: lector bloqueado hasta sincronización')
    socketio.run(app, host='127.0.0.1', port=5000, debug=False, use_reloader=False, allow_unsafe_werkzeug=True)
