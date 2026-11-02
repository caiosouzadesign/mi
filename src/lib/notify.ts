/**
 * E-mail opcional via Resend (https://resend.com). Sem RESEND_API_KEY, os avisos
 * ficam só no portal e no WhatsApp.
 */
export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
}

export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  if (!emailConfigured()) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, text }),
  });
  if (!res.ok) console.error("Falha ao enviar e-mail", res.status, await res.text());
  return res.ok;
}
