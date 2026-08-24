import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

function getEnv() {
  const { GMAIL_USER, GMAIL_APP_PASSWORD } = process.env;
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    throw new Error(
      "Gmail yapılandırılmamış. .env dosyasına GMAIL_USER ve GMAIL_APP_PASSWORD eklemelisin (bkz. README)."
    );
  }
  return { GMAIL_USER, GMAIL_APP_PASSWORD };
}

// -------- Gönderme (SMTP + App Password) --------
export const sendDefinition = {
  name: "gmail_send",
  description: "Gmail hesabından App Password kullanarak (SMTP üzerinden) e-posta gönderir.",
  inputSchema: {
    type: "object",
    properties: {
      to: { type: "string", description: "Alıcı e-posta adresi" },
      subject: { type: "string", description: "Konu" },
      body: { type: "string", description: "Düz metin e-posta içeriği" },
    },
    required: ["to", "subject", "body"],
  },
};

export async function sendHandler(args) {
  const { GMAIL_USER, GMAIL_APP_PASSWORD } = getEnv();
  const { to, subject, body } = args;

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  });

  const info = await transporter.sendMail({
    from: GMAIL_USER,
    to,
    subject,
    text: body,
  });

  return {
    content: [{ type: "text", text: `E-posta gönderildi. Message ID: ${info.messageId}` }],
  };
}

// -------- Okuma (IMAP + App Password) --------
export const readDefinition = {
  name: "gmail_read",
  description: "Gmail gelen kutusundan (INBOX) son e-postaları okur.",
  inputSchema: {
    type: "object",
    properties: {
      max_results: { type: "number", description: "Kaç e-posta getirileceği (varsayılan 5)" },
      unread_only: { type: "boolean", description: "Sadece okunmamışları getir (varsayılan false)" },
    },
  },
};

export async function readHandler(args) {
  const { GMAIL_USER, GMAIL_APP_PASSWORD } = getEnv();
  const { max_results = 5, unread_only = false } = args;
  const limit = Math.min(Number(max_results) || 5, 20);

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    logger: false,
  });

  const results = [];

  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      // En yeni mesajlardan başlamak için mailbox boyutunu al
      const total = client.mailbox.exists;
      if (total === 0) return { content: [{ type: "text", text: "Gelen kutusu boş." }] };

      const start = Math.max(1, total - limit * 3 + 1); // biraz fazla çek, unread filtrelenince eksik kalmasın
      const range = `${start}:${total}`;

      for await (const msg of client.fetch(range, { envelope: true, flags: true, uid: true, source: false })) {
        const isUnread = !msg.flags.has("\\Seen");
        if (unread_only && !isUnread) continue;

        results.push({
          uid: msg.uid,
          from: msg.envelope.from?.[0]?.address || "",
          subject: msg.envelope.subject || "(konu yok)",
          date: msg.envelope.date,
          unread: isUnread,
        });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }

  const sorted = results.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, limit);

  return {
    content: [
      {
        type: "text",
        text: sorted.length ? JSON.stringify(sorted, null, 2) : "Hiç e-posta bulunamadı.",
      },
    ],
  };
}

// -------- Tek bir mesajın tam içeriğini okuma --------
export const getMessageDefinition = {
  name: "gmail_get_message",
  description:
    "Belirli bir e-postanın tam içeriğini (gövde metni dahil) okur. Önce gmail_read ile mesajın 'uid' değerini al, sonra bu araca ver.",
  inputSchema: {
    type: "object",
    properties: {
      uid: { type: "number", description: "gmail_read çıktısındaki 'uid' değeri" },
    },
    required: ["uid"],
  },
};

export async function getMessageHandler(args) {
  const { GMAIL_USER, GMAIL_APP_PASSWORD } = getEnv();
  const { uid } = args;

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    logger: false,
  });

  let result;

  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const msg = await client.fetchOne(uid, { source: true, uid: true });
      if (!msg || !msg.source) {
        return { content: [{ type: "text", text: `UID ${uid} için mesaj bulunamadı.` }] };
      }

      const parsed = await simpleParser(msg.source);
      result = {
        from: parsed.from?.text || "",
        to: parsed.to?.text || "",
        subject: parsed.subject || "(konu yok)",
        date: parsed.date,
        text: parsed.text || parsed.html?.replace(/<[^>]+>/g, " ").trim() || "(içerik boş)",
      };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }

  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
}
