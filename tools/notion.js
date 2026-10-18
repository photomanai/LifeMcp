import { Client } from "@notionhq/client";

export const definition = {
  name: "notion_add_note",
  description: "Adds a new note (page) to your specified Notion database.",
  inputSchema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Note title" },
      content: { type: "string", description: "Note content" },
    },
    required: ["title", "content"],
  },
};

export async function handler(args) {
  const { NOTION_API_KEY, NOTION_DATABASE_ID } = process.env;

  if (!NOTION_API_KEY || !NOTION_DATABASE_ID) {
    throw new Error(
      "Notion not configured. Add NOTION_API_KEY and NOTION_DATABASE_ID to .env."
    );
  }

  const notion = new Client({ auth: NOTION_API_KEY });

  const response = await notion.pages.create({
    parent: { database_id: NOTION_DATABASE_ID },
    properties: {
      // Update if the title column name in your Notion database is not "Name"
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
