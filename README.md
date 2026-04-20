# Solution Hub MCP Server

基于 [Model Context Protocol](https://modelcontextprotocol.io) 的 Notion 方案库管理服务，让 AI 助手可以直接在 Notion 数据库中创建、查询和读取技术方案。

## 功能

- `save_solution` — 创建新方案（支持富文本内容块、类型/领域/状态标签）
- `list_solutions` — 按类型、领域、状态筛选查询方案列表
- `get_solution` — 读取指定方案的完整属性和内容

### 支持的内容块类型

heading_1 ~ heading_3、paragraph、bulleted_list_item、numbered_list_item、callout、divider、code、quote

### 方案属性

| 属性     | 可选值                                         |
| -------- | ---------------------------------------------- |
| 方案类型 | 技术方案、架构设计、产品方案、运维方案、其他     |
| 领域     | 前端、后端、基础设施、数据、安全、移动端、AI/ML |
| 状态     | 进行中、待评审、已完成、已归档                   |

## 快速开始

### 1. 前置准备

- Node.js >= 18
- 一个 [Notion Integration Token](https://www.notion.so/my-integrations)
- 一个 Notion 数据库（需包含以下属性：方案名称(title)、方案类型(select)、领域(multi_select)、状态(select)、创建时间(date)）

### 2. 安装

```bash
git clone git@github.com:deankwankkk/notion-edit-mcp.git
cd notion-edit-mcp
npm install
```

### 3. 配置环境变量

复制 `.env.example` 并填入你的实际值：

```bash
cp .env.example .env
```

```env
NOTION_TOKEN=ntn_your_token_here
SOLUTION_HUB_DB_ID=your_database_id_here
```

**获取 Database ID：** 打开 Notion 数据库页面，URL 格式为 `https://www.notion.so/<workspace>/<database_id>?v=...`，中间那段就是 Database ID。

### 4. 接入 MCP 客户端

本服务基于 MCP 标准协议，兼容所有支持 MCP 的 AI 客户端。以下是各客户端的配置方式：

#### Claude Code

添加到 `~/.claude/settings.json`：

```json
{
  "mcpServers": {
    "solution-hub": {
      "command": "npx",
      "args": ["tsx", "/path/to/solution-hub-mcp/src/server.ts"],
      "cwd": "/path/to/solution-hub-mcp",
      "env": {
        "NOTION_TOKEN": "ntn_your_token_here",
        "SOLUTION_HUB_DB_ID": "your_database_id_here"
      }
    }
  }
}
```

#### Cursor

添加到 `~/.cursor/mcp.json`：

```json
{
  "mcpServers": {
    "solution-hub": {
      "command": "npx",
      "args": ["tsx", "/path/to/solution-hub-mcp/src/server.ts"],
      "cwd": "/path/to/solution-hub-mcp",
      "env": {
        "NOTION_TOKEN": "ntn_your_token_here",
        "SOLUTION_HUB_DB_ID": "your_database_id_here"
      }
    }
  }
}
```

#### Windsurf

添加到 `~/.codeium/windsurf/mcp_config.json`：

```json
{
  "mcpServers": {
    "solution-hub": {
      "command": "npx",
      "args": ["tsx", "/path/to/solution-hub-mcp/src/server.ts"],
      "cwd": "/path/to/solution-hub-mcp",
      "env": {
        "NOTION_TOKEN": "ntn_your_token_here",
        "SOLUTION_HUB_DB_ID": "your_database_id_here"
      }
    }
  }
}
```

#### VS Code (GitHub Copilot)

在项目根目录创建 `.vscode/mcp.json`：

```json
{
  "servers": {
    "solution-hub": {
      "command": "npx",
      "args": ["tsx", "/path/to/solution-hub-mcp/src/server.ts"],
      "cwd": "/path/to/solution-hub-mcp",
      "env": {
        "NOTION_TOKEN": "ntn_your_token_here",
        "SOLUTION_HUB_DB_ID": "your_database_id_here"
      }
    }
  }
}
```

#### 其他 MCP 客户端

任何支持 MCP stdio 传输的客户端均可接入，启动命令为：

```bash
NOTION_TOKEN=ntn_xxx SOLUTION_HUB_DB_ID=xxx npx tsx /path/to/solution-hub-mcp/src/server.ts
```

## 多 Token / 多工作区管理

Notion MCP 单实例只支持一个 Token。如果需要访问不同工作区的页面，有两种方案：

### 方案一：单 Token 多页面（推荐）

同一个 Notion 工作区下，一个 Integration Token 可以访问多个页面/数据库。只需在 Notion 中将目标页面 **Connect** 到对应的 Integration 即可。

适用场景：所有数据库在同一个工作区内。

### 方案二：多实例配置

为不同工作区分别配置独立的 MCP Server 实例：

```json
{
  "mcpServers": {
    "solution-hub-work": {
      "command": "npx",
      "args": ["tsx", "/path/to/solution-hub-mcp/src/server.ts"],
      "cwd": "/path/to/solution-hub-mcp",
      "env": {
        "NOTION_TOKEN": "ntn_work_token",
        "SOLUTION_HUB_DB_ID": "work_database_id"
      }
    },
    "solution-hub-personal": {
      "command": "npx",
      "args": ["tsx", "/path/to/solution-hub-mcp/src/server.ts"],
      "cwd": "/path/to/solution-hub-mcp",
      "env": {
        "NOTION_TOKEN": "ntn_personal_token",
        "SOLUTION_HUB_DB_ID": "personal_database_id"
      }
    }
  }
}
```

也可以搭配官方 Notion MCP Server 使用，实现通用读写 + 方案库专用的组合：

```json
{
  "mcpServers": {
    "solution-hub": {
      "command": "npx",
      "args": ["tsx", "/path/to/solution-hub-mcp/src/server.ts"],
      "env": {
        "NOTION_TOKEN": "ntn_your_token",
        "SOLUTION_HUB_DB_ID": "your_db_id"
      }
    },
    "notionApi": {
      "command": "npx",
      "args": ["-y", "@notionhq/notion-mcp-server"],
      "env": {
        "NOTION_TOKEN": "ntn_your_token"
      }
    }
  }
}
```

## 技术栈

- [Model Context Protocol SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Notion API Client](https://github.com/makenotion/notion-sdk-js)
- TypeScript + tsx

## License

MIT
