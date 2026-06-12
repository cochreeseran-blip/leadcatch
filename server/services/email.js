import { Resend } from 'resend';

const FROM = 'KnockTrakr <notifications@useleadcatch.com>';

function buildLeadHtml({ repName, companyName, address, homeownerName, phone, outcome, timestamp }) {
  const outcomeLabel = outcome === 'inspection_set' ? 'Inspection Set' : outcome;
  const dt = new Date(timestamp).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  });

  return `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;color:#1c1917;background:#f9fafb;margin:0;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e7e5e4;padding:32px;">
    <div style="margin-bottom:24px;">
      <span style="font-size:18px;font-weight:700;color:#ea580c;">KnockTrakr</span>
      <span style="margin-left:10px;color:#78716c;font-size:14px;">· ${companyName}</span>
    </div>
    <h2 style="font-size:20px;font-weight:700;margin:0 0 20px;">New ${outcomeLabel}</h2>
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="padding:8px 0;color:#78716c;font-size:13px;width:130px;">Rep</td>
        <td style="padding:8px 0;font-weight:600;">${repName}</td>
      </tr>
      <tr style="border-top:1px solid #f5f5f4;">
        <td style="padding:8px 0;color:#78716c;font-size:13px;">Outcome</td>
        <td style="padding:8px 0;font-weight:600;">${outcomeLabel}</td>
      </tr>
      <tr style="border-top:1px solid #f5f5f4;">
        <td style="padding:8px 0;color:#78716c;font-size:13px;">Address</td>
        <td style="padding:8px 0;">${address || '—'}</td>
      </tr>
      ${homeownerName ? `
      <tr style="border-top:1px solid #f5f5f4;">
        <td style="padding:8px 0;color:#78716c;font-size:13px;">Homeowner</td>
        <td style="padding:8px 0;">${homeownerName}</td>
      </tr>` : ''}
      ${phone ? `
      <tr style="border-top:1px solid #f5f5f4;">
        <td style="padding:8px 0;color:#78716c;font-size:13px;">Phone</td>
        <td style="padding:8px 0;">${phone}</td>
      </tr>` : ''}
      <tr style="border-top:1px solid #f5f5f4;">
        <td style="padding:8px 0;color:#78716c;font-size:13px;">Time</td>
        <td style="padding:8px 0;font-size:13px;color:#57534e;">${dt}</td>
      </tr>
    </table>
    <div style="margin-top:28px;padding-top:20px;border-top:1px solid #f5f5f4;color:#a8a29e;font-size:12px;">
      Sent by KnockTrakr · LeadCatch Solutions
    </div>
  </div>
</body>
</html>`;
}

function buildInviteHtml({ firstName, companyName, username, inviteUrl }) {
  return `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;color:#1c1917;background:#f9fafb;margin:0;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e7e5e4;padding:32px;">
    <div style="margin-bottom:24px;">
      <span style="font-size:18px;font-weight:700;color:#ea580c;">KnockTrakr</span>
      <span style="margin-left:10px;color:#78716c;font-size:14px;">· ${companyName}</span>
    </div>
    <h2 style="font-size:20px;font-weight:700;margin:0 0 8px;">You're invited to join KnockTrakr</h2>
    <p style="color:#57534e;margin:0 0 20px;">Hi ${firstName}, ${companyName} has added you to their KnockTrakr team. Click the button below to set up your account.</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr>
        <td style="padding:8px 0;color:#78716c;font-size:13px;width:130px;">Your username</td>
        <td style="padding:8px 0;font-weight:700;font-family:monospace;font-size:15px;">${username}</td>
      </tr>
    </table>
    <a href="${inviteUrl}" style="display:inline-block;background:#ea580c;color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 28px;border-radius:10px;">Set Up Your Account →</a>
    <p style="color:#a8a29e;font-size:12px;margin-top:24px;">This link expires in 48 hours. If you didn't expect this invitation, you can ignore this email.</p>
    <div style="margin-top:28px;padding-top:20px;border-top:1px solid #f5f5f4;color:#a8a29e;font-size:12px;">
      Sent by KnockTrakr · LeadCatch Solutions
    </div>
  </div>
</body>
</html>`;
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
    subject: `You're invited to join KnockTrakr — ${companyName}`,
    html: buildInviteHtml({ firstName, companyName, username, inviteUrl }),
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
  const subject = `New Inspection Lead — ${companyName}`;
  const html = buildLeadHtml({ repName, companyName, address, homeownerName, phone, outcome, timestamp });

  const to = rows.map(r => r.email);
  const { error } = await resend.emails.send({ from: FROM, to, subject, html });

  if (error) throw new Error(error.message || JSON.stringify(error));
  console.log(`Email: lead notification sent to ${to.join(', ')} for company ${companyId}`);
}
