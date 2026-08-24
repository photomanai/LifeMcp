# Life MCP Server

Kişisel asistan MCP sunucusu. OpenCode (ya da herhangi bir MCP client) `/mcp` uç noktasına
`Authorization: Bearer <MCP_API_KEY>` header'ı ile bağlanır.

## Mevcut araçlar

| Araç | Ne yapar | Gerekli servis |
|---|---|---|
| `web_search` | DuckDuckGo üzerinden ücretsiz web araması (API key gerekmez) | — |
| `gmail_send` | Gmail'den e-posta gönderir | Gmail App Password |
| `gmail_read` | Gmail gelen kutusundan liste + UID getirir | Gmail App Password |
| `gmail_get_message` | Bir mesajın tam içeriğini (gövde metni) UID ile okur | Gmail App Password |
| `telegram_send` | Telegram botu ile mesaj gönderir | Telegram Bot |
| `notion_add_note` | Notion veritabanına not ekler | Notion Integration |

Yeni bir servis eklemek için `tools/` altına yeni bir dosya oluşturup `tools/index.js`
içindeki listeye eklemen yeterli — mimari bunun için modüler tasarlandı.

## 1) Kurulum

```bash
npm install
cp .env.example .env
```

`.env` içindeki `MCP_API_KEY` alanına kendi belirleyeceğin güçlü, rastgele bir değer yaz.
Bu değeri MCP client tarafında (OpenCode config'inde) `Authorization: Bearer ...` olarak kullanacaksın.

## 2) Gmail bağlantısı — App Password (opsiyonel, kullanmayacaksan atla)

App Password yöntemi OAuth'a göre çok daha basit: Google Cloud projesi gerekmez,
sadece hesabında 2 Adımlı Doğrulama (2FA) açık olması yeterli.

1. https://myaccount.google.com/security adresine git, **2 Adımlı Doğrulama**'yı
   aç (kapalıysa App Password oluşturamazsın).
2. https://myaccount.google.com/apppasswords adresine git.
3. Bir isim yaz (örn. "life-mcp"), **Oluştur**'a bas.
4. Sana 16 haneli boşluksuz bir şifre verecek (örn. `abcdabcdabcdabcd`) — bunu kopyala.
5. `.env` dosyasına şunları yaz:

   ```
   GMAIL_USER=kendi.mailin@gmail.com
   GMAIL_APP_PASSWORD=abcdabcdabcdabcd
   ```

Bu App Password normal Gmail şifrenden farklıdır, sadece bu uygulamaya özeldir ve
istediğin zaman aynı sayfadan iptal edebilirsin. `gmail_send` SMTP (`smtp.gmail.com:465`),
`gmail_read` ise IMAP (`imap.gmail.com:993`) üzerinden bu bilgilerle bağlanır.

> Not: Google Workspace (kurumsal) hesaplarında yönetici App Password'leri kapatmış
> olabilir — öyle bir durumda IT yöneticinle konuşman gerekir.

## 3) Telegram bağlantısı (opsiyonel)

1. Telegram'da **@BotFather**'a `/newbot` yaz, bir bot oluştur, sana verdiği token'ı
   `.env` içine `TELEGRAM_BOT_TOKEN` olarak yaz.
2. Botuna Telegram'dan bir mesaj at (bot ilk mesajı sen atmadan sana yazamaz).
3. Şu adrese git ve `chat.id` değerini bul:
   `https://api.telegram.org/bot<TOKEN>/getUpdates`
4. Bulduğun ID'yi `.env` içine `TELEGRAM_CHAT_ID` olarak yaz.

## 4) Notion bağlantısı (opsiyonel)

1. https://www.notion.so/my-integrations adresinden yeni bir **Internal Integration**
   oluştur, verilen "Internal Integration Secret" değerini `.env` içine `NOTION_API_KEY`
   olarak yaz.
2. Notlarını tutmak istediğin bir Notion veritabanı (database) oluştur ve sağ üstteki
   "..." menüsünden **Connections** kısmına yeni integration'ını ekle (bu adım şart,
   yoksa "unauthorized" hatası alırsın).
3. Veritabanının URL'sindeki 32 karakterlik ID'yi `.env` içine `NOTION_DATABASE_ID`
   olarak yaz.
4. Veritabanının başlık kolonunun adı "Name" değilse `tools/notion.js` içindeki
   `Name:` alanını kendi kolon adınla değiştir.

## 5) Çalıştırma

```bash
npm start
```

Sunucu `http://0.0.0.0:9898/mcp` adresinde ayağa kalkar.

## 6) OpenCode / MCP client tarafında bağlanma

Client config'inde uç nokta olarak `http://<sunucu-ip>:9898/mcp` ver, header olarak:

```
Authorization: Bearer <MCP_API_KEY>
```

## Güvenlik notları

- `.env` dosyanı asla paylaşma veya git'e commit etme (`.gitignore` içinde zaten hariç tutuldu).
- `MCP_API_KEY` olmadan hiçbir istek kabul edilmez.
- Sunucuyu genel internete açacaksan (0.0.0.0) mutlaka bir reverse proxy (nginx/caddy) arkasında
  HTTPS ile çalıştır ve mümkünse IP kısıtlaması da ekle — şu an sadece Bearer token koruması var.
- Her yeni entegrasyon (Gmail, Telegram, Notion vb.) sadece kendi izin verdiğin hesaplara
  bağlanır; token'lar `.env` dosyasında senin makinende tutulur, hiçbir yere gönderilmez.
