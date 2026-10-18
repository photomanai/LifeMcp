import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

function getEnv() {
  const { GMAIL_USER, GMAIL_APP_PASSWORD } = process.env;
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    throw new Error(
      "Gmail not configured. Add GMAIL_USER and GMAIL_APP_PASSWORD to .env (see README)."
    );
  }
  return { GMAIL_USER, GMAIL_APP_PASSWORD };
}

// -------- Sending (SMTP + App Password) --------
export const sendDefinition = {
  name: "gmail_send",
  description: "Sends email from Gmail using App Password (via SMTP).",
  inputSchema: {
    type: "object",
    properties: {
      to: { type: "string", description: "Recipient email address" },
      subject: { type: "string", description: "Konu" },
      body: { type: "string", description: "Plain text email content" },
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
    content: [{ type: "text", text: `Email sent. Message ID: ${info.messageId}` }],
  };
}

// -------- Reading (IMAP + App Password) --------
export const readDefinition = {
  name: "gmail_read",
  description: "Reads recent emails from Gmail inbox (INBOX).",
  inputSchema: {
    type: "object",
    properties: {
      max_results: { type: "number", description: "Number of emails to retrieve (default 5)" },
      unread_only: { type: "boolean", description: "Only retrieve unread (default false)" },
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
      // Get mailbox size to start from newest messages
      const total = client.mailbox.exists;
      if (total === 0) return { content: [{ type: "text", text: "Inbox is empty." }] };

      const start = Math.max(1, total - limit * 3 + 1); // fetch a bit more, so unread filter doesn't miss any
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
        text: sorted.length ? JSON.stringify(sorted, null, 2) : "No emails found.",
      },
    ],
  };
}

// -------- Reading a single message's full content --------
export const getMessageDefinition = {
  name: "gmail_get_message",
  description:
    "Reads full content (including body text) of a message. First get the message 'uid' via gmail_read, then pass it to this tool.",
  inputSchema: {
    type: "object",
    properties: {
      uid: { type: "number", description: "UID from gmail_read output" },
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
        return { content: [{ type: "text", text: "Message not found for UID ${uid}." }] };
      }

      const parsed = await simpleParser(msg.source);
      result = {
        from: parsed.from?.text || "",
        to: parsed.to?.text || "",
        subject: parsed.subject || "(konu yok)",
        date: parsed.date,
        text: parsed.text || parsed.html?.replace(/<[^>]+>/g, " ").trim() || "(content empty)",
      };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }

  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
}
