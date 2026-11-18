"""Para instalación nueva sin usuarios previos: python bootstrap_admin_pg.py UID"""
import sys
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).with_name('.env'))
import pg_store as store
if len(sys.argv)!=2 or len(sys.argv[1])<8:
    raise SystemExit('Uso: python bootstrap_admin_pg.py UID_EXISTENTE_DE_FIREBASE_AUTH')
uid=sys.argv[1]
print('AVISO: vas a conceder administrador para el plantel',store.SCHOOL_ID,'a UID',uid)
if input('Escribe CONFIRMAR: ')!='CONFIRMAR':raise SystemExit('Cancelado')
store.grant_user(uid,'admin')
print('Administrador autorizado en PostgreSQL; no se modificó Firebase.')
