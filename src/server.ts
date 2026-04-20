import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Client } from "@notionhq/client";
import { z } from "zod";

const NOTION_TOKEN = process.env.NOTION_TOKEN!;
const DATABASE_ID = process.env.SOLUTION_HUB_DB_ID!;

const notion = new Client({ auth: NOTION_TOKEN });
const server = new McpServer({ name: "solution-hub", version: "1.0.0" });

const SOLUTION_TYPES = ["技术方案", "架构设计", "产品方案", "运维方案", "其他"] as const;
const DOMAINS = ["前端", "后端", "基础设施", "数据", "安全", "移动端", "AI/ML"] as const;
const STATUSES = ["进行中", "待评审", "已完成", "已归档"] as const;
const BLOCK_TYPES = [
  "heading_1", "heading_2", "heading_3",
  "paragraph", "bulleted_list_item", "numbered_list_item",
  "callout", "divider", "code", "quote",
] as const;

type ContentBlock = {
  type: (typeof BLOCK_TYPES)[number];
  text?: string;
  language?: string;
  icon?: string;
  color?: string;
};

function contentToBlocks(content: ContentBlock[]): any[] {
  return content.map((block) => {
    const richText = block.text
      ? [{ type: "text" as const, text: { content: block.text } }]
      : [];

    switch (block.type) {
      case "heading_1":
        return { type: "heading_1", heading_1: { rich_text: richText } };
      case "heading_2":
        return { type: "heading_2", heading_2: { rich_text: richText } };
      case "heading_3":
        return { type: "heading_3", heading_3: { rich_text: richText } };
      case "paragraph":
        return { type: "paragraph", paragraph: { rich_text: richText } };
      case "bulleted_list_item":
        return { type: "bulleted_list_item", bulleted_list_item: { rich_text: richText } };
      case "numbered_list_item":
        return { type: "numbered_list_item", numbered_list_item: { rich_text: richText } };
      case "callout":
        return {
          type: "callout",
          callout: {
            rich_text: richText,
            icon: { type: "emoji", emoji: block.icon || "💡" },
            color: block.color || "gray_background",
          },
        };
      case "divider":
        return { type: "divider", divider: {} };
      case "code":
        return {
          type: "code",
          code: { rich_text: richText, language: block.language || "plain text" },
        };
      case "quote":
        return { type: "quote", quote: { rich_text: richText } };
      default:
        return { type: "paragraph", paragraph: { rich_text: richText } };
    }
  });
}

function blocksToText(blocks: any[]): string {
  return blocks
    .map((b: any) => {
      const getText = (rt: any[]) =>
        (rt || []).map((t: any) => t.plain_text || "").join("");
      switch (b.type) {
        case "heading_1": return `# ${getText(b.heading_1?.rich_text)}`;
        case "heading_2": return `## ${getText(b.heading_2?.rich_text)}`;
        case "heading_3": return `### ${getText(b.heading_3?.rich_text)}`;
        case "paragraph": return getText(b.paragraph?.rich_text);
        case "bulleted_list_item": return `- ${getText(b.bulleted_list_item?.rich_text)}`;
        case "numbered_list_item": return `1. ${getText(b.numbered_list_item?.rich_text)}`;
        case "callout": return `> ${getText(b.callout?.rich_text)}`;
        case "divider": return "---";
        case "code": return `\`\`\`${b.code?.language || ""}\n${getText(b.code?.rich_text)}\n\`\`\``;
        case "quote": return `> ${getText(b.quote?.rich_text)}`;
        default: return "";
      }
    })
    .join("\n");
}

// ========== save_solution ==========
server.tool(
  "save_solution",
  "创建新方案到方案库（含属性标签和富文本内容）",
  {
    name: z.string().describe("方案名称"),
    content: z.array(z.object({
      type: z.enum(BLOCK_TYPES).describe("Block 类型"),
      text: z.string().optional().describe("文本内容（divider 不需要）"),
      language: z.string().optional().describe("代码块语言"),
      icon: z.string().optional().describe("Callout emoji"),
      color: z.string().optional().describe("Callout 背景色"),
    })).describe("富文本内容块数组"),
    type: z.enum(SOLUTION_TYPES).optional().describe("方案类型"),
    domains: z.array(z.enum(DOMAINS)).optional().describe("领域标签"),
    status: z.enum(STATUSES).optional().default("进行中").describe("状态"),
  },
  async ({ name, content, type, domains, status }) => {
    try {
      const properties: any = {
        "方案名称": { title: [{ text: { content: name } }] },
        "创建时间": { date: { start: new Date().toISOString().split("T")[0] } },
      };
      if (type) properties["方案类型"] = { select: { name: type } };
      if (status) properties["状态"] = { select: { name: status } };
      if (domains?.length) properties["领域"] = { multi_select: domains.map((d) => ({ name: d })) };

      const page = await notion.pages.create({
        parent: { database_id: DATABASE_ID },
        properties,
      });

      if (content?.length) {
        const blocks = contentToBlocks(content);
        for (let i = 0; i < blocks.length; i += 100) {
          await notion.blocks.children.append({
            block_id: page.id,
            children: blocks.slice(i, i + 100),
          });
        }
      }

      return {
        content: [{ type: "text" as const, text: `方案已创建: ${name}\nID: ${page.id}\nURL: ${(page as any).url}` }],
      };
    } catch (e: any) {
      return { content: [{ type: "text" as const, text: `创建失败: ${e.message}` }], isError: true };
    }
  }
);

// ========== list_solutions ==========
server.tool(
  "list_solutions",
  "查询方案库，支持按类型/领域/状态筛选",
  {
    type: z.enum(SOLUTION_TYPES).optional().describe("按方案类型筛选"),
    domain: z.enum(DOMAINS).optional().describe("按领域筛选"),
    status: z.enum(STATUSES).optional().describe("按状态筛选"),
    page_size: z.number().min(1).max(100).optional().default(20).describe("返回数量"),
  },
  async ({ type, domain, status, page_size }) => {
    try {
      const conditions: any[] = [];
      if (type) conditions.push({ property: "方案类型", select: { equals: type } });
      if (domain) conditions.push({ property: "领域", multi_select: { contains: domain } });
      if (status) conditions.push({ property: "状态", select: { equals: status } });

      const filter = conditions.length > 1
        ? { and: conditions }
        : conditions.length === 1
          ? conditions[0]
          : undefined;

      const res = await notion.databases.query({
        database_id: DATABASE_ID,
        filter,
        page_size,
        sorts: [{ property: "创建时间", direction: "descending" }],
      });

      const items = res.results.map((p: any) => ({
        id: p.id,
        name: p.properties["方案名称"]?.title?.[0]?.plain_text || "",
        type: p.properties["方案类型"]?.select?.name || "",
        domains: (p.properties["领域"]?.multi_select || []).map((s: any) => s.name),
        status: p.properties["状态"]?.select?.name || "",
        created: p.properties["创建时间"]?.date?.start || "",
        url: p.url,
      }));

      return {
        content: [{ type: "text" as const, text: JSON.stringify(items, null, 2) }],
      };
    } catch (e: any) {
      return { content: [{ type: "text" as const, text: `查询失败: ${e.message}` }], isError: true };
    }
  }
);

// ========== get_solution ==========
server.tool(
  "get_solution",
  "读取指定方案的属性和完整内容",
  {
    page_id: z.string().describe("方案的 Notion page ID"),
  },
  async ({ page_id }) => {
    try {
      const page: any = await notion.pages.retrieve({ page_id });
      const props = {
        name: page.properties["方案名称"]?.title?.[0]?.plain_text || "",
        type: page.properties["方案类型"]?.select?.name || "",
        domains: (page.properties["领域"]?.multi_select || []).map((s: any) => s.name),
        status: page.properties["状态"]?.select?.name || "",
        created: page.properties["创建时间"]?.date?.start || "",
      };

      let allBlocks: any[] = [];
      let cursor: string | undefined;
      do {
        const res: any = await notion.blocks.children.list({
          block_id: page_id,
          start_cursor: cursor,
          page_size: 100,
        });
        allBlocks = allBlocks.concat(res.results);
        cursor = res.has_more ? res.next_cursor : undefined;
      } while (cursor);

      const text = blocksToText(allBlocks);

      return {
        content: [{
          type: "text" as const,
          text: `# ${props.name}\n类型: ${props.type} | 领域: ${props.domains.join(", ")} | 状态: ${props.status} | 创建: ${props.created}\n\n${text}`,
        }],
      };
    } catch (e: any) {
      return { content: [{ type: "text" as const, text: `读取失败: ${e.message}` }], isError: true };
    }
  }
);

// ========== Start ==========
const transport = new StdioServerTransport();
await server.connect(transport);
