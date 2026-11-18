"""Diagnóstico de conexión PostgreSQL sin imprimir credenciales."""
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).with_name('.env'))
import pg_store as store
with store.connection() as db:
    print('PostgreSQL disponible:', db.execute('SELECT current_database() AS db').fetchone()['db'])
    for table in ['users','students','fingerprints','attendance','communities']:
        n=db.execute(f'SELECT count(*) AS n FROM {table} WHERE school_id=%s',(store.SCHOOL_ID,)).fetchone()['n']
        print(f'{table}: {n}')
store.cipher()
print('Clave de protección biométrica: configurada correctamente.')
