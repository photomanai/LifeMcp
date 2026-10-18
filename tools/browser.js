import open from "open";

export const definition = {
  name: "open_website",
  description:
    "Opens a website in the default browser. Opens URL directly or via search engine.",
  inputSchema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description:
          "URL or search query to open (e.g., 'youtube.com', 'https://google.com', 'nodejs tutorial')",
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
          text: "Opened in browser: ${url}",
        },
      ],
    };
  } catch (err) {
    throw new Error(`Could not open browser: ${err.message}`);
  }
}
