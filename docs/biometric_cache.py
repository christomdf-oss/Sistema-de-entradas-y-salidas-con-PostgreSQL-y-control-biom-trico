"""Caché SQLite de biometría para una única PC Windows.

Los perfiles y las plantillas se guardan cifrados con DPAPI (ámbito del usuario
Windows). Nunca se utiliza esta caché como autorización final para una asistencia:
el servicio consulta el perfil y la plantilla remotos antes de escribir el evento.
"""
from __future__ import annotations

import ctypes
from contextlib import contextmanager
import json
import os
import sqlite3
import time
from ctypes import wintypes
from pathlib import Path


class _DataBlob(ctypes.Structure):
    _fields_ = [('cbData', wintypes.DWORD), ('pbData', ctypes.POINTER(ctypes.c_ubyte))]


def _blob(data: bytes):
    # Mantener vivo el buffer durante CryptProtectData/CryptUnprotectData.
    buf = ctypes.create_string_buffer(data)
    return _DataBlob(len(data), ctypes.cast(buf, ctypes.POINTER(ctypes.c_ubyte))), buf


def _dpapi(data: bytes, decrypt: bool = False) -> bytes:
    if os.name != 'nt':
        raise RuntimeError('La caché biométrica cifrada con DPAPI requiere Windows')
    crypt32 = ctypes.windll.crypt32
    kernel32 = ctypes.windll.kernel32
    source, keepalive = _blob(data)
    output = _DataBlob()
    if decrypt:
        fn = crypt32.CryptUnprotectData
        fn.argtypes = [ctypes.POINTER(_DataBlob), ctypes.c_void_p,
                       ctypes.POINTER(_DataBlob), ctypes.c_void_p, ctypes.c_void_p,
                       wintypes.DWORD, ctypes.POINTER(_DataBlob)]
        fn.restype = wintypes.BOOL
        ok = fn(ctypes.byref(source), None, None, None, None, 0, ctypes.byref(output))
    else:
        fn = crypt32.CryptProtectData
        fn.argtypes = [ctypes.POINTER(_DataBlob), wintypes.LPCWSTR,
                       ctypes.POINTER(_DataBlob), ctypes.c_void_p, ctypes.c_void_p,
                       wintypes.DWORD, ctypes.POINTER(_DataBlob)]
        fn.restype = wintypes.BOOL
        # CRYPTPROTECT_UI_FORBIDDEN = 1. La clave depende de la cuenta Windows.
        ok = fn(ctypes.byref(source), 'ZENKAY biometric cache', None, None, None, 1,
                ctypes.byref(output))
    if not ok:
        raise ctypes.WinError()
    try:
        return ctypes.string_at(output.pbData, output.cbData)
    finally:
        kernel32.LocalFree.argtypes = [ctypes.c_void_p]
        kernel32.LocalFree(ctypes.cast(output.pbData, ctypes.c_void_p))


class BiometricCache:
    """Almacén separado por plantel con protección de datos en reposo.

    `encrypt`/`decrypt` se inyectan solamente para pruebas unitarias; la
    aplicación real exige Windows/DPAPI.
    """
    def __init__(self, path: Path, school_id: str, *, encrypt=None, decrypt=None):
        self.path = Path(path)
        self.school_id = school_id
        self.encrypt = encrypt or (lambda value: _dpapi(value))
        self.decrypt = decrypt or (lambda value: _dpapi(value, True))
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as conn:
            conn.execute('CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
            conn.execute('CREATE TABLE IF NOT EXISTS records (student_id TEXT PRIMARY KEY, payload BLOB NOT NULL)')
            existing = conn.execute('SELECT value FROM metadata WHERE key = ?', ('schoolId',)).fetchone()
            if existing and existing[0] != school_id:
                raise RuntimeError('La caché pertenece a otro plantel')
            conn.execute('INSERT OR IGNORE INTO metadata VALUES (?, ?)', ('schoolId', school_id))

    @contextmanager
    def _connect(self):
        conn = sqlite3.connect(self.path, timeout=15)
        try:
            conn.execute('PRAGMA busy_timeout = 15000')
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def load(self):
        with self._connect() as conn:
            meta = dict(conn.execute('SELECT key, value FROM metadata'))
            records = {}
            for student_id, encrypted in conn.execute('SELECT student_id, payload FROM records'):
                records[student_id] = json.loads(self.decrypt(encrypted).decode('utf-8'))
            return records, meta

    def save(self, records: dict, meta: dict):
        """Sustitución transaccional después de sincronizar con éxito el SDK."""
        encrypted = [(sid, self.encrypt(json.dumps(value, ensure_ascii=False).encode('utf-8')))
                     for sid, value in records.items()]
        with self._connect() as conn:
            conn.execute('DELETE FROM records')
            conn.executemany('INSERT INTO records (student_id, payload) VALUES (?, ?)', encrypted)
            conn.executemany('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)',
                             [(key, str(value)) for key, value in meta.items() if key != 'schoolId'])

    def save_changes(self, changed_records: dict, meta: dict):
        """V8.3: persistir solo los alumnos modificados, no 400 plantillas.

        Mismo cifrado DPAPI y transacción que `save` (para carga completa).
        """
        encrypted = [(sid, self.encrypt(json.dumps(value, ensure_ascii=False).encode('utf-8')))
                     for sid, value in changed_records.items()]
        with self._connect() as conn:
            if encrypted:
                conn.executemany('INSERT OR REPLACE INTO records (student_id, payload) VALUES (?, ?)', encrypted)
            conn.executemany('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)',
                             [(key, str(value)) for key, value in meta.items() if key != 'schoolId'])

    def get_pending_emails(self):
        with self._connect() as conn:
            conn.execute('''CREATE TABLE IF NOT EXISTS email_outbox (
                event_id TEXT PRIMARY KEY, payload BLOB NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
                retry_at REAL NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending')''')
            return [(event_id, json.loads(self.decrypt(payload).decode('utf-8')), attempts)
                    for event_id, payload, attempts in conn.execute(
                        "SELECT event_id, payload, attempts FROM email_outbox WHERE status='pending' AND retry_at <= ? LIMIT 10",
                        (time.time(),))]

    def queue_email(self, event_id: str, recipient: str, name: str, kind: str):
        payload = self.encrypt(json.dumps({'to': recipient, 'name': name, 'kind': kind},
                                          ensure_ascii=False).encode('utf-8'))
        with self._connect() as conn:
            conn.execute('''CREATE TABLE IF NOT EXISTS email_outbox (
                event_id TEXT PRIMARY KEY, payload BLOB NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
                retry_at REAL NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending')''')
            conn.execute('INSERT OR IGNORE INTO email_outbox (event_id, payload) VALUES (?, ?)',
                         (event_id, payload))

    def finish_email(self, event_id: str, success: bool, attempts: int):
        with self._connect() as conn:
            if success:
                conn.execute("UPDATE email_outbox SET status='sent' WHERE event_id=?", (event_id,))
            else:
                # Retrasos progresivos entre 1 minuto y 1 hora.
                backoff = min(3600, 60 * (2 ** min(attempts, 6)))
                conn.execute("UPDATE email_outbox SET attempts=?, retry_at=? WHERE event_id=?",
                             (attempts + 1, time.time() + backoff, event_id))


def event_id_for(student_id: str, kind: str, date_iso: str) -> str:
    """ID determinista y seguro: un movimiento biométrico por alumno/tipo/día."""
    import hashlib
    if kind not in ('entrada', 'salida'):
        raise ValueError('Movimiento inválido')
    digest = hashlib.sha256(student_id.encode('utf-8')).hexdigest()[:32]
    return f'bio_{date_iso}_{kind}_{digest}'
