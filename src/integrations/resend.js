// Resend Email Integration
// Activates when VITE_RESEND_API_KEY is present in .env
// Get your key: https://resend.com/api-keys

const RESEND_KEY = import.meta.env.VITE_RESEND_API_KEY;
const FROM_EMAIL = import.meta.env.VITE_FROM_EMAIL || 'outreach@amaleads.org';
const FROM_NAME  = import.meta.env.VITE_FROM_NAME  || 'Ali @ AMA Leads';

export function isResendConnected() {
  return !!RESEND_KEY;
}

/**
 * Send a single email via Resend
 */
export async function sendEmail({ to, toName, subject, body }) {
  if (!isResendConnected()) {
    throw new Error('Resend not connected. Add VITE_RESEND_API_KEY to .env.');
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_KEY}`,
    },
    body: JSON.stringify({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to:   [toName ? `${toName} <${to}>` : to],
      subject,
      text: body,
      html: body.replace(/\n/g, '<br>'),
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `Resend ${res.status}`);
  return { id: data.id, success: true };
}

/**
 * Queue an email in Supabase (sends immediately if Resend connected,
 * stores as 'waiting_for_api' otherwise so it fires when key is added)
 */
export async function queueEmail(supabase, { prospectId, toName, toEmail, subject, body }) {
  const status = isResendConnected() ? 'pending' : 'waiting_for_api';

  if (supabase) {
    await supabase.from('email_queue').insert({
      prospect_id: prospectId,
      to_name: toName,
      to_email: toEmail,
      subject,
      body,
      status,
    });
  }

  if (isResendConnected() && toEmail) {
    try {
      await sendEmail({ to: toEmail, toName, subject, body });
      if (supabase) {
        await supabase
          .from('email_queue')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('prospect_id', prospectId)
          .eq('status', 'pending');
      }
      return { sent: true };
    } catch (err) {
      if (supabase) {
        await supabase
          .from('email_queue')
          .update({ status: 'failed', error: err.message })
          .eq('prospect_id', prospectId)
          .eq('status', 'pending');
      }
      throw err;
    }
  }

  return { queued: true, waitingForApi: !isResendConnected() };
}
