import { Resend } from "resend";
import type { AlertResult } from "./alert-engine";

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return new Resend(key);
}

export async function sendAlertEmail(alert: AlertResult, toEmail: string): Promise<boolean> {
  try {
    const urgencyColor = {
      high: "#FF4D4D",
      medium: "#F59E0B",
      low: "#B8E15A",
    }[alert.urgency];

    const urgencyLabel = {
      high: "HOCH",
      medium: "MITTEL",
      low: "NIEDRIG",
    }[alert.urgency];

    const typeLabel = {
      entry: "Einstiegs-Alert",
      event: "Event-Alert",
      spike: "VIX-Spike-Alert",
      trailingStop: "Trailing Stop Alert",
      stddev: "Statistischer Alert",
    }[alert.type];

    await getResend().emails.send({
      from: "VIX Trading <onboarding@resend.dev>",
      to: toEmail,
      subject: `[${urgencyLabel}] ${typeLabel}: ${alert.message.slice(0, 60)}`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0C0C0F; color: #FFFFFF; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; }
    .header { background: #141418; border: 1px solid #1E1E28; border-radius: 12px; padding: 24px; margin-bottom: 16px; }
    .logo { font-size: 20px; font-weight: 700; color: #B8E15A; margin-bottom: 8px; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; background: ${urgencyColor}22; color: ${urgencyColor}; border: 1px solid ${urgencyColor}44; }
    .message { font-size: 18px; font-weight: 600; margin: 16px 0; line-height: 1.4; }
    .card { background: #141418; border: 1px solid #1E1E28; border-radius: 12px; padding: 20px; margin-bottom: 12px; }
    .label { font-size: 12px; color: #8B8FA8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .value { font-size: 16px; font-weight: 600; color: #FFFFFF; }
    .footer { text-align: center; color: #8B8FA8; font-size: 12px; margin-top: 24px; }
    .vix-value { font-size: 32px; font-weight: 700; color: #B8E15A; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">⚡ VIX Trading Dashboard</div>
      <div class="badge">${urgencyLabel} PRIORITÄT — ${typeLabel}</div>
      <div class="message">${alert.message}</div>
      ${alert.vixLevel ? `<div class="vix-value">VIX: ${alert.vixLevel.toFixed(2)}</div>` : ""}
    </div>

    <div class="card">
      <div class="label">Zeitpunkt</div>
      <div class="value">${new Date().toLocaleString("de-DE")}</div>
    </div>

    ${
      alert.details
        ? `<div class="card">
      <div class="label">Details</div>
      <pre style="color: #8B8FA8; font-size: 13px; margin: 8px 0 0; white-space: pre-wrap;">${JSON.stringify(alert.details, null, 2)}</pre>
    </div>`
        : ""
    }

    <div class="footer">
      <p>VIX Personal Trading Dashboard — Kein automatischer Trade-Ausführung</p>
      <p>Alle Entscheidungen liegen beim Nutzer.</p>
    </div>
  </div>
</body>
</html>`,
    });

    return true;
  } catch (err) {
    console.error("Error sending alert email:", err);
    return false;
  }
}

export async function sendTestEmail(toEmail: string): Promise<boolean> {
  try {
    await getResend().emails.send({
      from: "VIX Trading <onboarding@resend.dev>",
      to: toEmail,
      subject: "✅ VIX Dashboard — E-Mail Test erfolgreich",
      html: `
<html>
<body style="font-family: sans-serif; background: #0C0C0F; color: #FFF; padding: 20px;">
  <div style="max-width: 400px; margin: 0 auto; background: #141418; border-radius: 12px; padding: 24px; border: 1px solid #1E1E28;">
    <div style="font-size: 20px; font-weight: 700; color: #B8E15A; margin-bottom: 12px;">⚡ VIX Trading Dashboard</div>
    <p>E-Mail-Benachrichtigungen sind korrekt konfiguriert.</p>
    <p style="color: #8B8FA8; font-size: 14px;">Gesendet: ${new Date().toLocaleString("de-DE")}</p>
  </div>
</body>
</html>`,
    });
    return true;
  } catch {
    return false;
  }
}
