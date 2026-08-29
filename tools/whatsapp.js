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
        console.log("\n📱 WhatsApp QR kodu taratın:\n");
        qrcode.generate(qr, { small: true });
        console.log("\nQR kodu telefonunuzdan tarayın.\n");
      }

      if (connection === "close") {
        const statusCode =
          lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        console.log(
          `WhatsApp bağlantısı kesildi. Kod: ${statusCode}. Yeniden bağlanılıyor: ${shouldReconnect}`
        );
        isLoggedIn = false;
        sock = null;
        connectionPromise = null;
        if (shouldReconnect) {
          setTimeout(() => ensureConnection(), 3000);
        }
      }

      if (connection === "open") {
        console.log("✅ WhatsApp bağlantısı başarılı!");
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
    "WhatsApp üzerinden bir kişiye veya gruba mesaj gönderir. Telefon numarası uluslararası formatta olmalı (örn: 994xxxxxxxxx).",
  inputSchema: {
    type: "object",
    properties: {
      to: {
        type: "string",
        description:
          "Alıcının telefon numarası (uluslararası, başta + olmadan, ör: 994XXXXXXXXX) veya grup ID'si",
      },
      message: { type: "string", description: "Gönderilecek mesaj metni" },
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
      "WhatsApp henüz bağlı değil. Lütfen QR kodunu taratın veya bağlantının açılmasını bekleyin."
    );
  }

  const jid = to.includes("@") ? to : `${to}@s.whatsapp.net`;

  try {
    await sock.sendMessage(jid, { text: message });
    return {
      content: [
        {
          type: "text",
          text: `WhatsApp mesajı gönderildi: ${to}`,
        },
      ],
    };
  } catch (err) {
    throw new Error(`WhatsApp mesaj gönderilemedi: ${err.message}`);
  }
}

export const readDefinition = {
  name: "whatsapp_read",
  description:
    "WhatsApp'taki son mesajları okur. En son gelen mesajları listeler.",
  inputSchema: {
    type: "object",
    properties: {
      max_results: {
        type: "number",
        description: "Kaç mesaj getirileceği (varsayılan 10)",
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
      "WhatsApp henüz bağlı değil. Lütfen QR kodunu taratın veya bağlantının açılmasını bekleyin."
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
    throw new Error(`WhatsApp mesajları okunamadı: ${err.message}`);
  }
}
