import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) return null;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporter;
}

interface AlertEmailData {
  entityName: string;
  severity: string;
  description: string;
  analysisUrl: string;
  orgName?: string;
}

export async function sendCorruptionAlertEmail(to: string, alert: AlertEmailData): Promise<boolean> {
  const t = getTransporter();
  if (!t) { console.log('[email] SMTP not configured — skipping email'); return false; }

  const from = process.env.SMTP_FROM || '"PaperTrail" <noreply@papertrail.io>';
  const severityColor = alert.severity === 'CRITICAL' ? '#dc2626' : alert.severity === 'HIGH' ? '#ea580c' : '#d97706';

  try {
    await t.sendMail({
      from,
      to,
      subject: `⚠️ ${alert.severity} Risk Alert: ${alert.entityName}`,
      html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <tr>
    <td style="background:#0f172a;padding:24px 32px;">
      <span style="color:#ffffff;font-size:20px;font-weight:700;">Paper</span>
      <span style="color:#3b82f6;font-size:20px;font-weight:700;">Trail</span>
      <span style="color:#64748b;font-size:13px;margin-left:12px;">Corruption Detection</span>
    </td>
  </tr>
  <tr>
    <td style="padding:32px;">
      <div style="background:${severityColor}15;border-left:4px solid ${severityColor};border-radius:8px;padding:16px 20px;margin-bottom:24px;">
        <p style="margin:0 0 4px;color:${severityColor};font-weight:700;font-size:14px;text-transform:uppercase;">
          ⚠️ ${alert.severity} Risk Detected
        </p>
        <p style="margin:0;color:#1e293b;font-size:22px;font-weight:700;">${alert.entityName}</p>
      </div>

      <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px;">${alert.description}</p>

      ${alert.orgName ? `<p style="color:#94a3b8;font-size:13px;margin:0 0 24px;">Detected by your PaperTrail monitoring for <strong>${alert.orgName}</strong></p>` : ''}

      <a href="${alert.analysisUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;font-weight:600;font-size:15px;padding:14px 28px;border-radius:10px;text-decoration:none;">
        View Full Analysis →
      </a>

      <p style="color:#94a3b8;font-size:12px;margin:32px 0 0;border-top:1px solid #e2e8f0;padding-top:20px;">
        PaperTrail AI Corruption Monitor · <a href="${alert.analysisUrl.split('/analysis')[0]}/alerts" style="color:#3b82f6;">Manage Alerts</a>
        <br>Risk scores reflect objective pattern analysis, not proven wrongdoing.
      </p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`,
    });
    return true;
  } catch (e) {
    console.error('[email] Failed to send alert:', e);
    return false;
  }
}
