import { google } from 'googleapis';

interface SendEmailParams {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
}

export async function sendEmail(authClient: any, params: SendEmailParams) {
  const gmail = google.gmail({ version: 'v1', auth: authClient });

  const { to, cc, bcc, subject, body } = params;

  // Construct standard RFC 2822 email
  const messageParts = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: text/html; charset="UTF-8"`,
  ];

  if (cc) messageParts.push(`Cc: ${cc}`);
  if (bcc) messageParts.push(`Bcc: ${bcc}`);
  
  messageParts.push(''); // Empty line between headers and body
  messageParts.push(body);

  const rawMessage = messageParts.join('\n');
  
  // Encode string to base64url format
  const encodedMessage = Buffer.from(rawMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  try {
    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });
    
    return {
      success: true,
      messageId: res.data.id,
    };
  } catch (error: any) {
    console.error('Error sending email:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}
