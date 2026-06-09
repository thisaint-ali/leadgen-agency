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
  const unsubFooter = `\n\n---\nTo unsubscribe, reply with "unsubscribe" in the subject line.`;
  const fullBody = body + unsubFooter;

  // Insert row and get back its id so we update by exact row (not by prospect_id
  // which could match multiple rows and corrupt unrelated emails)
  let rowId = null;
  if (supabase) {
    const { data } = await supabase.from('email_queue').insert({
      prospect_id: prospectId,
      to_name:     toName,
      to_email:    toEmail,
      subject,
      body:        fullBody,
      status:      'waiting_for_api',
    }).select('id').single();
    rowId = data?.id;
  }

  if (isResendConnected() && toEmail) {
    try {
      const result = await sendEmail({ to: toEmail, toName, subject, body: fullBody });
      if (supabase && rowId) {
        await supabase
          .from('email_queue')
          .update({ status: 'sent', sent_at: new Date().toISOString(), resend_message_id: result.id || null })
          .eq('id', rowId);
      }
      return { sent: true };
    } catch (err) {
      if (supabase && rowId) {
        await supabase
          .from('email_queue')
          .update({ status: 'failed', error: err.message })
          .eq('id', rowId);
      }
      throw err;
    }
  }

  // Not sending now — mark as pending so processEmailQueue picks it up later
  if (supabase && rowId) {
    await supabase.from('email_queue').update({ status: toEmail ? 'pending' : 'waiting_for_api' }).eq('id', rowId);
  }

  return { queued: true, waitingForApi: !isResendConnected() };
}
