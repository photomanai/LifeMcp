import open from "open";

export const definition = {
  name: "open_website",
  description:
    "Bilgisayarda varsayılan tarayıcı ile bir web sitesi açar. URL'yi doğrudan veya arama motoru üzerinden açabilir.",
  inputSchema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description:
          "Açılacak URL veya arama sorgusu (örn: 'youtube.com', 'https://google.com', 'nodejs tutorial')",
      },
    },
    required: ["url"],
  },
};

export async function handler(args) {
  let { url } = args;
  if (!url) {
    throw new Error("URL parametresi gerekli.");
  }

  url = url.trim();

  if (
    !url.startsWith("http://") &&
    !url.startsWith("https://") &&
    !url.includes(".")
  ) {
    url = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
  } else if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }

  try {
    await open(url);
    return {
      content: [
        {
          type: "text",
          text: `Tarayıcıda açıldı: ${url}`,
        },
      ],
    };
  } catch (err) {
    throw new Error(`Tarayıcı açılamadı: ${err.message}`);
  }
}
