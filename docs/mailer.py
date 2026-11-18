"""Correo SMTP para notificaciones de ZENKAY; sin archivos adjuntos."""
import logging,os,smtplib
from datetime import datetime
from html import escape as html_escape
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr

def email_tutor(to, student_name, kind):
    """Envía una notificación de asistencia en texto y HTML, sin imágenes adjuntas."""
    user = os.environ.get('GMAIL_USER', '').strip()
    password = os.environ.get('GMAIL_APP_PASSWORD', '').replace(' ', '').strip()
    if not user or not password or not to:
        logging.warning('Correo no enviado: falta remitente, contraseña o destinatario')
        return False

    try:
        now = datetime.now()
        kind_label = 'Salida' if kind == 'salida' else 'Entrada'
        kind_lower = kind_label.lower()
        display_name = html_escape(str(student_name), quote=True)
        safe_kind = html_escape(kind_label, quote=True)
        safe_when = html_escape(now.strftime('%d/%m/%Y a las %H:%M'), quote=True)
        from_name = os.environ.get('MAIL_FROM_NAME', 'COBACAM Plantel 10 Chicbul').strip()

        # Texto y HTML alternativos; sin adjuntos ni imágenes incrustadas.
        msg = MIMEMultipart('alternative')
        msg['From'] = formataddr((from_name, user))
        msg['To'] = to
        msg['Subject'] = f'COBACAM | {kind_label} registrada'

        texto = (
            f'COBACAM - Plantel 10 Chicbul\n'
            f'Sistema de Entradas y Salidas\n\n'
            f'Se registró correctamente la {kind_lower} del alumno.\n'
            f'Alumno: {student_name}\n'
            f'Movimiento: {kind_label}\n'
            f'Fecha y hora: {now:%d/%m/%Y a las %H:%M}\n'
            f'Plantel: 10 Chicbul, Carmen, Campeche\n\n'
            f'Este mensaje se generó automáticamente. No responda a este correo.\n'
        )
        msg.attach(MIMEText(texto, 'plain', 'utf-8'))

        html = f"""<!doctype html>
<html lang='es'>
<head><meta charset='utf-8'></head>
<body style='margin:0;padding:24px 12px;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#24212a'>
  <div style='max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e8e3e7;border-radius:16px;overflow:hidden'>
    <div style='padding:26px 30px;background:#760d2d;color:#ffffff'>
      <div style='font-size:22px;font-weight:bold'>COBACAM · Plantel 10 Chicbul</div>
      <div style='font-size:13px;margin-top:6px;color:#f8dfe6'>Sistema de Entradas y Salidas</div>
    </div>
    <div style='padding:30px'>
      <div style='font-size:12px;letter-spacing:2px;color:#a20e3c;font-weight:bold'>NOTIFICACIÓN DE ASISTENCIA</div>
      <h1 style='font-size:26px;margin:10px 0 18px;color:#290c1a'>{safe_kind} registrada</h1>
      <div style='padding:16px;background:#e6f7ed;color:#126b3a;border-radius:10px;font-weight:bold'>
        &#10003; Se registró correctamente la {kind_lower} del alumno.
      </div>
      <table role='presentation' width='100%' cellpadding='12' cellspacing='0' style='font-size:14px;border-collapse:collapse;margin-top:20px'>
        <tr style='background:#f5f5f7'><td>Alumno</td><td><strong>{display_name}</strong></td></tr>
        <tr><td>Movimiento</td><td><strong>{safe_kind}</strong></td></tr>
        <tr style='background:#f5f5f7'><td>Fecha y hora</td><td>{safe_when}</td></tr>
        <tr><td>Plantel</td><td>10 Chicbul · Carmen, Campeche</td></tr>
      </table>
      <p style='font-size:13px;line-height:1.6;color:#62606b;margin-top:24px'>
        Estimado tutor(a): este mensaje confirma un registro realizado en el plantel.
        Si tiene dudas, comuníquese con la escuela.
      </p>
    </div>
    <div style='background:#51081f;color:#ffffff;padding:18px 30px;font-size:12px;line-height:1.8'>
      <strong>COBACAM · Plantel 10 Chicbul</strong><br>
      Clave: 04ECB0010U · Turno matutino<br>
      Teléfono: (982) 82 4-03-20 · plantel10@cobacam.edu.mx
    </div>
  </div>
</body>
</html>"""
        msg.attach(MIMEText(html, 'html', 'utf-8'))

        with smtplib.SMTP('smtp.gmail.com', 587, timeout=15) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.ehlo()
            smtp.login(user, password)
            smtp.send_message(msg)
        logging.info('Notificación enviada para %s', student_name)
        return True
    except Exception:
        logging.exception('No se pudo enviar notificación para %s', student_name)
        return False

