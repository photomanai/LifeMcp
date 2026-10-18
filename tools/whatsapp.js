import {
  default as makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";
import path from "path";
import fs from "fs";

const SESSION_DIR = path.join(process.cwd(), "whatsapp-session");

let sock = null;
let connectionPromise = null;
let isLoggedIn = false;

async function ensureConnection() {
  if (sock && isLoggedIn) return sock;
  if (connectionPromise) return connectionPromise;

  connectionPromise = (async () => {
    if (!fs.existsSync(SESSION_DIR)) {
      fs.mkdirSync(SESSION_DIR, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      browser: ["Life MCP Server", "Chrome", "1.0.0"],
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log("\n📱 WhatsApp QR code scan:\n");
        qrcode.generate(qr, { small: true });
        console.log("\nScan the QR code with your phone.\n");
      }

      if (connection === "close") {
        const statusCode =
          lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        console.log(
          `WhatsApp connection closed. Code: ${statusCode}. Reconnecting: ${shouldReconnect}`
        );
        isLoggedIn = false;
        sock = null;
        connectionPromise = null;
        if (shouldReconnect) {
          setTimeout(() => ensureConnection(), 3000);
        }
      }

      if (connection === "open") {
        console.log("✅ WhatsApp connection successful!");
        isLoggedIn = true;
      }
    });

    return sock;
  })();

  return connectionPromise;
}

export const sendDefinition = {
  name: "whatsapp_send",
  description:
    "Sends a message via WhatsApp. Phone number must be in international format (e.g., 994xxxxxxxxx).",
  inputSchema: {
    type: "object",
    properties: {
      to: {
        type: "string",
        description:
          "Recipient's phone number (international, without +, e.g., 994XXXXXXXXX) or group ID",
      },
      message: { type: "string", description: "Message text to send" },
    },
    required: ["to", "message"],
  },
};

export async function sendHandler(args) {
  const { to, message } = args;

  if (!to || !message) {
    throw new Error("'to' ve 'message' parametreleri gerekli.");
  }

  const sock = await ensureConnection();
  if (!isLoggedIn) {
    throw new Error(
      "WhatsApp not connected. Please scan the QR code or wait for the connection to open."
    );
  }

  const jid = to.includes("@") ? to : `${to}@s.whatsapp.net`;

  try {
    await sock.sendMessage(jid, { text: message });
    return {
      content: [
        {
          type: "text",
          text: `WhatsApp message sent: ${to}`,
        },
      ],
    };
  } catch (err) {
    throw new Error(`WhatsApp message could not be sent: ${err.message}`);
  }
}

export const readDefinition = {
  name: "whatsapp_read",
  description:
    "Reads the latest messages from WhatsApp. Lists the most recent incoming messages.",
  inputSchema: {
    type: "object",
    properties: {
      max_results: {
        type: "number",
        description:
      "Number of messages to retrieve (default 10)",
      },
    },
    required: [],
  },
};

export async function readHandler(args) {
  const limit = args.max_results || 10;

  const sock = await ensureConnection();
  if (!isLoggedIn) {
    throw new Error(
      "WhatsApp not connected. Please scan the QR code or wait for the connection to open."
    );
  }

  try {
    const messages = [];
    const chats = Array.from(sock.store?.messages || {}).slice(-limit);

    for (const [jid, msgs] of chats) {
      const recentMsgs = Array.isArray(msgs) ? msgs.slice(-limit) : [];
      for (const msg of recentMsgs) {
        if (msg.message && !msg.key.fromMe) {
          messages.push({
            from: msg.key.remoteJid,
            sender:
              msg.pushName || msg.key.remoteJid,
            text:
              msg.message.conversation ||
              msg.message.extendedTextMessage?.text ||
              "[medya/mesaj]",
            timestamp: msg.messageTimestamp,
            fromMe: false,
          });
        }
        if (msg.key.fromMe) {
          messages.push({
            from: "me",
            to: msg.key.remoteJid,
            text:
              msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text ||
              "[medya/mesaj]",
            timestamp: msg.messageTimestamp,
            fromMe: true,
          });
        }
      }
    }

    messages.sort((a, b) => {
      const ta =
        typeof a.timestamp === "object"
          ? a.timestamp.toSeconds?.() || 0
          : a.timestamp || 0;
      const tb =
        typeof b.timestamp === "object"
          ? b.timestamp.toSeconds?.() || 0
          : b.timestamp || 0;
      return tb - ta;
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(messages.slice(0, limit), null, 2),
        },
      ],
    };
  } catch (err) {
    throw new Error(`WhatsApp messages could not be read: ${err.message}`);
  }
}
