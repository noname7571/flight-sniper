import nodemailer from 'nodemailer';

export interface EmailAlertPayload {
  to: string;
  origin: string;
  destination: string;
  price: number;
  maxPrice: number;
  currency: string;
  airline: string;
  departureDate: string;
  direct: boolean;
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn('[Email] SMTP not configured. Email alerts disabled.');
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port: parseInt(port || '587'),
    secure: parseInt(port || '587') === 465,
    auth: { user, pass },
  });

  return transporter;
}

export async function sendEmailAlert(payload: EmailAlertPayload): Promise<boolean> {
  const transport = getTransporter();
  if (!transport) return false;

  const stopsText = payload.direct ? 'Direct flight' : 'With stops';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #1a73e8; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0;">Flight Price Alert!</h1>
      </div>
      <div style="border: 1px solid #ddd; border-top: none; padding: 20px; border-radius: 0 0 8px 8px;">
        <h2 style="color: #333;">${payload.origin} -> ${payload.destination}</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">Price</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">${payload.price} ${payload.currency}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">Target</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">Under ${payload.maxPrice} ${payload.currency}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">Airline</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">${payload.airline}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">Date</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">${payload.departureDate}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold;">Type</td>
            <td style="padding: 10px;">${stopsText}</td>
          </tr>
        </table>
        <p style="color: #666; font-size: 12px; margin-top: 20px;">
          This is an automated alert from Flight Sniper. Check the airline website for the most up-to-date pricing.
        </p>
      </div>
    </div>
  `;

  try {
    await transport.sendMail({
      from: `"Flight Sniper" <${process.env.SMTP_USER}>`,
      to: payload.to,
      subject: `Flight Price Alert! ${payload.origin} -> ${payload.destination} - ${payload.price} ${payload.currency}`,
      html,
    });

    console.log(`[Email] Alert sent to ${payload.to} for ${payload.origin} -> ${payload.destination}`);
    return true;
  } catch (error) {
    console.error('[Email] Failed to send alert:', error);
    return false;
  }
}
