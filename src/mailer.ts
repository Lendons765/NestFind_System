// Sends email through Resend when RESEND_API_KEY is set.
// Without it, the message is printed to the terminal so you can test.
export async function sendEmail(to: string, subject: string, text: string) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log(
      `\n--- Email (not sent: RESEND_API_KEY is not set) ---\nTo: ${to}\nSubject: ${subject}\n\n${text}\n---\n`
    );
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.MAIL_FROM ?? "NestFind <onboarding@resend.dev>",
      to: [to],
      subject,
      text,
    }),
  });

  if (!res.ok) {
    throw new Error(`Email failed (${res.status}): ${await res.text()}`);
  }
}