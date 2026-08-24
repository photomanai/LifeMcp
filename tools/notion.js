import { Client } from "@notionhq/client";

export const definition = {
  name: "notion_add_note",
  description: "Belirlediğin Notion veritabanına yeni bir not (sayfa) ekler.",
  inputSchema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Not başlığı" },
      content: { type: "string", description: "Not içeriği" },
    },
    required: ["title", "content"],
  },
};

export async function handler(args) {
  const { NOTION_API_KEY, NOTION_DATABASE_ID } = process.env;

  if (!NOTION_API_KEY || !NOTION_DATABASE_ID) {
    throw new Error(
      "Notion yapılandırılmamış. .env dosyasına NOTION_API_KEY ve NOTION_DATABASE_ID eklemelisin."
    );
  }

  const notion = new Client({ auth: NOTION_API_KEY });

  const response = await notion.pages.create({
    parent: { database_id: NOTION_DATABASE_ID },
    properties: {
      // Notion veritabanındaki başlık kolonunun adı "Name" değilse burayı güncelle
      Name: { title: [{ text: { content: args.title } }] },
    },
    children: [
      {
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: [{ type: "text", text: { content: args.content } }] },
      },
    ],
  });

  return {
    content: [
      { type: "text", text: `Not Notion'a eklendi: ${response.url || response.id}` },
    ],
  };
}
