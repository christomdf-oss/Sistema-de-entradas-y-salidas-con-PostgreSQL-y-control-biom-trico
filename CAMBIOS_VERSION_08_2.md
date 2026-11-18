# Versión 8.2 — borrado biométrico coordinado y sincronización incremental

## Corregido
- **Eliminar solo huella** ahora llama `POST /api/remove-fingerprint` en el servicio Python, con token Firebase y rol `admin`.
- El servicio revoca la plantilla en Firestore, marca al alumno `pending`, ejecuta `ZKFP2.DBDel` para quitar la plantilla del algoritmo local y actualiza la caché SQLite cifrada. Ya se puede inscribir de nuevo el mismo dedo sin que la plantilla antigua permanezca cargada.
- Se conserva el documento de huella como **lápida** (`template: null`, `updatedAt`) en lugar de borrarlo físicamente. Así las consultas incrementales detectan las bajas sin obligar a consultar de nuevo todos los alumnos y todas las huellas.
- El diálogo de inscripción respeta `NEXT_PUBLIC_KIOSK_URL`, igual que la pantalla del sensor.

## Importante para el consumo de Firebase
- Esta corrección evita una **sincronización completa** causada por una baja de huella que antes no podía detectarse con `updatedAt`.
- **No elimina** las lecturas de la lista de alumnos, del panel, ni de la consulta mensual de asistencias. Esas pantallas siguen pudiendo consumir muchas lecturas al abrirse, especialmente con un historial mensual grande.
- Cada entrada o salida biométrica mantiene dos lecturas puntuales de verificación y una escritura, por seguridad.
- No se puede garantizar la cuota gratuita sin medir el uso real y optimizar adicionalmente los reportes y consultas mensuales.

## Instalación y prueba
1. Haz respaldo de tu proyecto, Firebase y la caché `.private/biometrics.sqlite3` (protegida por la cuenta Windows).
2. Cierra el servicio Python anterior, actualiza los archivos y reinicia el servicio. **No mezcles el frontend 8.2 con el servicio Python 8.1.**
3. Detén el modo asistencia. Desde Alumnos → Acciones → **Eliminar solo huella**, confirma. El lector debe estar conectado en la PC y el servicio Python funcionando.
4. Verifica que el alumno figure **Pendiente**. En la misma PC pulsa **Registrar huella**, coloca el mismo dedo cuatro veces y verifica una entrada y una salida.
5. Si falla la eliminación local, no intentes registrar hasta reiniciar el servicio y ejecutar **Sincronizar**; la plantilla ya habrá sido revocada en Firebase.
6. Compara las lecturas en la consola Firebase con todas las pestañas cerradas, luego abriendo únicamente la página Alumnos, y luego el lector. No atribuyas los picos a las capturas sin separar esos procesos.

**Aviso:** No se ha probado contra el SDK ZK9500 físico ni una instancia real de Firebase. El comando `DBDel` debe verificarse en la versión instalada de pyzkfp/ZKFP2 antes de producción.
