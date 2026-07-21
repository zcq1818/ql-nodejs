// 通知：微信 Server 酱 + 邮件（SMTP）
import { storeGet } from '@/lib/store';
import https from 'https';

export async function sendServerChan(key, title, desp) {
  if (!key) return;
  const body = new URLSearchParams({ title, desp }).toString();
  await new Promise((resolve) => {
    const req = https.request(
      'https://sctapi.ftqq.com/' + key + '.send',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        res.resume();
        res.on('end', resolve);
      }
    );
    req.on('error', () => resolve());
    req.end(body);
  });
}

export async function sendEmail(smtp, title, text) {
  if (!smtp || !smtp.host || !smtp.user || !smtp.pass || !smtp.to) return;
  try {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: Number(smtp.port) || 465,
      secure: (Number(smtp.port) || 465) === 465,
      auth: { user: smtp.user, pass: smtp.pass },
    });
    await transporter.sendMail({ from: smtp.user, to: smtp.to, subject: title, text });
  } catch (e) {}
}

export async function notifyScript(script, ok, logs) {
  const settings = await storeGet('panel:settings', {});
  const title = `[${ok ? '成功' : '失败'}] ${script.name}`;
  const desp = (logs || '').slice(0, 4000);
  if (settings.serverKey) await sendServerChan(settings.serverKey, title, desp);
  if (settings.smtp && settings.smtp.host && settings.notifyTo) {
    await sendEmail({ ...settings.smtp, to: settings.notifyTo }, title, desp);
  }
}
