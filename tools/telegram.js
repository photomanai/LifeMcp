export const definition = {
  name: "telegram_send",
  description: "Sends a message via Telegram bot.",
  inputSchema: {
    type: "object",
    properties: {
      message: { type: "string", description: "Message text to send" },
    },
    required: ["message"],
  },
};

export async function handler(args) {
  const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    throw new Error(
      "Telegram not configured. Add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID to .env."
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
    throw new Error(`Telegram API error: ${data.description}`);
  }

  return { content: [{ type: "text", text: "Telegram message sent." }] };
}
