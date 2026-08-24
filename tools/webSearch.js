import * as cheerio from "cheerio";

export const definition = {
  name: "web_search",
  description:
    "DuckDuckGo üzerinden ücretsiz web araması yapar (API key gerekmez). Başlık, kısa açıklama ve URL döner.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Arama sorgusu" },
      max_results: {
        type: "number",
        description: "Maksimum sonuç sayısı (varsayılan 5, üst limit 10)",
      },
    },
    required: ["query"],
  },
};

export async function handler(args) {
  const { query, max_results = 5 } = args;
  const limit = Math.min(Math.max(Number(max_results) || 5, 1), 10);

  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    },
  });

  if (!res.ok) {
    throw new Error(`DuckDuckGo isteği başarısız: HTTP ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  const results = [];

  $(".result").each((_, el) => {
    if (results.length >= limit) return;

    const titleEl = $(el).find(".result__title a");
    const title = titleEl.text().trim();
    let link = titleEl.attr("href") || "";

    // DuckDuckGo yönlendirme linkini gerçek URL'e çevir
    const match = link.match(/uddg=([^&]+)/);
    if (match) link = decodeURIComponent(match[1]);

    const snippet = $(el).find(".result__snippet").text().trim();

    if (title && link) {
      results.push({ title, url: link, snippet });
    }
  });

  return {
    content: [
      {
        type: "text",
        text: results.length
          ? JSON.stringify(results, null, 2)
          : "Sonuç bulunamadı.",
      },
    ],
  };
}
