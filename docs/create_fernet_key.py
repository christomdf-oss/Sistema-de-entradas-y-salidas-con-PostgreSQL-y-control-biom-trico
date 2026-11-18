from cryptography.fernet import Fernet
print('BIOMETRIC_FERNET_KEY='+Fernet.generate_key().decode('ascii'))
print('Conserva esta clave en lugar seguro; perderla impide descifrar las huellas.')
