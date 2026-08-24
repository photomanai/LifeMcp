export const definition = {
  name: "telegram_send",
  description: "Telegram botu üzerinden sana mesaj gönderir.",
  inputSchema: {
    type: "object",
    properties: {
      message: { type: "string", description: "Gönderilecek mesaj metni" },
    },
    required: ["message"],
  },
};

export async function handler(args) {
  const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    throw new Error(
      "Telegram yapılandırılmamış. .env dosyasına TELEGRAM_BOT_TOKEN ve TELEGRAM_CHAT_ID eklemelisin."
    );
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: args.message }),
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Telegram API hatası: ${data.description}`);
  }

  return { content: [{ type: "text", text: "Telegram mesajı gönderildi." }] };
}
