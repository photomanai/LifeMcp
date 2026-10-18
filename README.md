# Life MCP Server

Personal assistant MCP server. OpenCode (or any MCP client) connects to the `/mcp` endpoint with `Authorization: Bearer <MCP_API_KEY>` header.

## Available tools

| Tool | What it does | Required service |
|---|---|---|
| `web_search` | Free web search via DuckDuckGo (no API key required) | — |
| `gmail_send` | Sends email from Gmail | Gmail App Password |
| `gmail_read` | Lists emails from Gmail inbox + returns UID | Gmail App Password |
| `gmail_get_message` | Reads full content (body text) of a message via UID | Gmail App Password |
| `telegram_send` | Sends message via Telegram bot | Telegram Bot |
| `notion_add_note` | Adds a note to Notion database | Notion Integration |

To add a new service, create a new file in `tools/` and add it to the list in `tools/index.js` — the architecture is designed for this.

## 1) Installation

```bash
npm install
cp .env.example .env
```

Write a strong, random value in the `MCP_API_KEY` field in `.env`. You'll use this value on the MCP client side (in OpenCode config) as `Authorization: Bearer ...`.

## 2) Gmail connection — App Password (optional, skip if you won't use it)

The App Password method is much simpler than OAuth: no Google Cloud project is needed, just having 2FA (Two-Factor Authentication) enabled in your account is enough.

1. Go to https://myaccount.google.com/security, enable **2-Step Verification** (2FA) (you can't create App Passwords if 2FA is disabled).
2. Go to https://myaccount.google.com/apppasswords.
3. Enter a name (e.g., "life-mcp"), click **Create**.
4. You'll receive a 16-character password without spaces (e.g., `abcdabcdabcdabcd`) — copy it.
5. Write the following in the `.env` file:

   ```
   GMAIL_USER=kendi.mailin@gmail.com
   GMAIL_APP_PASSWORD=abcdabcdabcdabcd
   ```

This App Password is different from your normal Gmail password; it's unique to this application and can be revoked anytime from the same page. `gmail_send` uses SMTP (`smtp.gmail.com:465`), and `gmail_read` uses IMAP (`imap.gmail.com:993`) with these credentials.

> Note: Google Workspace (corporate) accounts may have App Passwords disabled by the administrator — in such a case, you need to talk to your IT admin.

## 3) Telegram connection (optional)

1. In Telegram, message **@BotFather** with `/newbot`, create a bot, and write the token you receive to `.env` as `TELEGRAM_BOT_TOKEN`.
2. Send a message to the bot from Telegram (the bot won't send you messages until you send one first).
3. Go to this address and find the `chat.id` value: `https://api.telegram.org/bot<TOKEN>/getUpdates`
4. Write the found ID to `.env` as `TELEGRAM_CHAT_ID`.

## 4) Notion connection (optional)

1. From https://www.notion.so/my-integrations, create a new **Internal Integration**, and write the given "Internal Integration Secret" value to `.env` as `NOTION_API_KEY`.
2. Create a Notion database (to keep your notes) and, from the "..." menu at the top right, add your new integration under **Connections** (this step is mandatory, otherwise you'll get an "unauthorized" error).
3. Write the 32-character ID from the Notion database URL to `.env` as `NOTION_DATABASE_ID`.
4. If the title column of the database is not named "Name", change the `Name:` field in `tools/notion.js` to your column name.

## 5) Running

```bash
npm start
```

The server starts at `http://0.0.0.0:9898/mcp`.

## 6) Connecting from OpenCode / MCP client side

In the client config, set the endpoint as `http://<server-ip>:9898/mcp`, and use the header:

```
Authorization: Bearer <MCP_API_KEY>
```

## Security notes

- Never share or commit the `.env` file (it's already excluded via `.gitignore`).
- No requests are accepted without `MCP_API_KEY`.
- If you'll open the server to the general internet (0.0.0.0), definitely run it behind a reverse proxy (nginx/caddy) with HTTPS, and consider adding IP restrictions — currently only Bearer token protection is in place.
- Each new integration (Gmail, Telegram, Notion, etc.) only connects to the accounts it's authorized for; the tokens are stored in your machine's `.env` file and are never sent anywhere.