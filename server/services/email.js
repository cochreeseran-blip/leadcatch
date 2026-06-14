import { Resend } from 'resend';

// ⚠️  FLAG: Add mail.knocktrakr.com as a verified sending domain in Resend (DNS TXT record),
// then this FROM address will work and emails will land in inbox instead of spam.
const FROM = 'KnockTrakr <noreply@mail.knocktrakr.com>';

const NAVY  = '#0A2540';
const RED   = '#C8102E';
const MIST  = '#F5F6F8';
const MUTED = '#6B7280';
const LINE  = '#E5E8ED';

function wordmark() {
  return `<span style="font-size:20px;font-weight:800;letter-spacing:-0.03em;">
    <span style="color:${NAVY};">Knock</span><span style="color:${RED};">Trakr</span>
  </span>`;
}

function buildLeadHtml({ repName, companyName, address, homeownerName, phone, outcome, timestamp }) {
  const outcomeLabel = outcome === 'inspection_set' ? 'Inspection Set' : outcome;
  const dt = new Date(timestamp).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  });

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1c1917;background:${MIST};margin:0;padding:24px 16px;">
  <div style="max-width:520px;margin:0 auto;">
    <div style="padding:20px 0 16px;">
      ${wordmark()}
      <span style="margin-left:10px;color:${MUTED};font-size:13px;">· ${companyName}</span>
    </div>
    <div style="background:#fff;border-radius:16px;border:1px solid ${LINE};overflow:hidden;">
      <div style="padding:24px 28px 20px;border-bottom:1px solid ${LINE};">
        <div style="display:inline-block;background:${MIST};color:${NAVY};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;padding:4px 10px;border-radius:20px;margin-bottom:12px;">New Lead</div>
        <h2 style="font-size:20px;font-weight:700;margin:0;color:${NAVY};">${outcomeLabel} — ${address || 'Address not logged'}</h2>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:12px 28px;color:${MUTED};font-size:13px;width:120px;vertical-align:top;border-bottom:1px solid ${MIST};">Rep</td>
          <td style="padding:12px 28px;font-weight:600;border-bottom:1px solid ${MIST};">${repName}</td>
        </tr>
        ${homeownerName ? `
        <tr>
          <td style="padding:12px 28px;color:${MUTED};font-size:13px;vertical-align:top;border-bottom:1px solid ${MIST};">Homeowner</td>
          <td style="padding:12px 28px;font-weight:600;border-bottom:1px solid ${MIST};">${homeownerName}</td>
        </tr>` : ''}
        ${phone ? `
        <tr>
          <td style="padding:12px 28px;color:${MUTED};font-size:13px;vertical-align:top;border-bottom:1px solid ${MIST};">Phone</td>
          <td style="padding:12px 28px;border-bottom:1px solid ${MIST};"><a href="tel:${phone}" style="color:${RED};font-weight:600;text-decoration:none;">${phone}</a></td>
        </tr>` : ''}
        <tr>
          <td style="padding:12px 28px;color:${MUTED};font-size:13px;vertical-align:top;">Time</td>
          <td style="padding:12px 28px;color:${MUTED};font-size:13px;">${dt}</td>
        </tr>
      </table>
    </div>
    <p style="color:${MUTED};font-size:11px;text-align:center;margin-top:20px;">Sent by KnockTrakr · LeadCatch Solutions · <a href="https://knocktrakr.com" style="color:${MUTED};">knocktrakr.com</a></p>
  </div>
</body>
</html>`;
}

function buildLeadText({ repName, companyName, address, homeownerName, phone, outcome, timestamp }) {
  const outcomeLabel = outcome === 'inspection_set' ? 'Inspection Set' : outcome;
  const dt = new Date(timestamp).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  });
  return [
    `KnockTrakr · ${companyName}`,
    ``,
    `NEW LEAD — ${outcomeLabel}`,
    ``,
    `Rep: ${repName}`,
    `Address: ${address || '—'}`,
    homeownerName ? `Homeowner: ${homeownerName}` : null,
    phone ? `Phone: ${phone}` : null,
    `Time: ${dt}`,
    ``,
    `--`,
    `KnockTrakr · LeadCatch Solutions`,
    `https://knocktrakr.com`,
  ].filter(l => l !== null).join('\n');
}

function buildInviteHtml({ firstName, companyName, username, inviteUrl }) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1c1917;background:${MIST};margin:0;padding:24px 16px;">
  <div style="max-width:520px;margin:0 auto;">
    <div style="padding:20px 0 16px;">
      ${wordmark()}
    </div>
    <div style="background:#fff;border-radius:16px;border:1px solid ${LINE};padding:32px 28px;">
      <h2 style="font-size:22px;font-weight:700;margin:0 0 10px;color:${NAVY};">You're on the team.</h2>
      <p style="color:${MUTED};font-size:15px;margin:0 0 24px;line-height:1.6;">
        Hi ${firstName}, <strong style="color:${NAVY};">${companyName}</strong> has added you to KnockTrakr.
        Set up your account to start logging knocks.
      </p>
      <div style="background:${MIST};border-radius:10px;padding:14px 18px;margin-bottom:24px;">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${MUTED};margin-bottom:4px;">Your username</div>
        <div style="font-family:'SF Mono',Monaco,monospace;font-size:17px;font-weight:700;color:${NAVY};">${username}</div>
      </div>
      <a href="${inviteUrl}" style="display:block;text-align:center;background:${RED};color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:15px 28px;border-radius:12px;letter-spacing:-0.01em;">Set Up Your Account →</a>
      <p style="color:${MUTED};font-size:12px;margin-top:20px;margin-bottom:0;line-height:1.5;">
        This link expires in 48 hours. If you didn't expect this invitation, you can safely ignore this email.
      </p>
    </div>
    <p style="color:${MUTED};font-size:11px;text-align:center;margin-top:20px;">KnockTrakr · LeadCatch Solutions · <a href="https://knocktrakr.com" style="color:${MUTED};">knocktrakr.com</a></p>
  </div>
</body>
</html>`;
}

function buildInviteText({ firstName, companyName, username, inviteUrl }) {
  return [
    `KnockTrakr`,
    ``,
    `Hi ${firstName},`,
    ``,
    `${companyName} has added you to KnockTrakr. Set up your account to start logging knocks.`,
    ``,
    `Your username: ${username}`,
    ``,
    `Set up your account here:`,
    inviteUrl,
    ``,
    `This link expires in 48 hours. If you didn't expect this, you can ignore this email.`,
    ``,
    `--`,
    `KnockTrakr · LeadCatch Solutions`,
    `https://knocktrakr.com`,
  ].join('\n');
}

export async function sendInviteEmail({ email, firstName, companyName, username, inviteUrl }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log('Email: RESEND_API_KEY not set, skipping invite email');
    return;
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: FROM,
    to: [email],
    subject: `You're on the team — set up your KnockTrakr account`,
    html: buildInviteHtml({ firstName, companyName, username, inviteUrl }),
    text: buildInviteText({ firstName, companyName, username, inviteUrl }),
  });

  if (error) throw new Error(error.message || JSON.stringify(error));
  console.log(`Email: invite sent to ${email} (username: ${username})`);
}

export async function notifyManagersOfLead(pool, { companyId, companyName, repName, address, homeownerName, phone, outcome, timestamp }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log('Email: RESEND_API_KEY not set, skipping notification');
    return;
  }

  const { rows } = await pool.query(
    `SELECT email FROM users WHERE company_id = $1 AND role = 'manager' AND email IS NOT NULL AND email != ''`,
    [companyId]
  );

  if (rows.length === 0) {
    console.log(`Email: no manager emails configured for company ${companyId}`);
    return;
  }

  const resend = new Resend(apiKey);
  const subject = `New lead — ${companyName}`;
  const html = buildLeadHtml({ repName, companyName, address, homeownerName, phone, outcome, timestamp });
  const text = buildLeadText({ repName, companyName, address, homeownerName, phone, outcome, timestamp });

  const to = rows.map(r => r.email);
  const { error } = await resend.emails.send({ from: FROM, to, subject, html, text });

  if (error) throw new Error(error.message || JSON.stringify(error));
  console.log(`Email: lead notification sent to ${to.join(', ')} for company ${companyId}`);
}
