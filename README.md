# mal-mcp-server

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server that connects AI assistants to the [MyAnimeList API v2](https://myanimelist.net/apiconfig/references/api/v2). Search anime, browse seasonal charts, check rankings, look up manga — all from your AI chat.

## What It Does

This server exposes 7 read-only tools to any MCP-compatible client (Claude Desktop, Claude Code, Cursor, etc.):

| Tool | Description |
|------|-------------|
| `mal_search_anime` | Search anime by title or keywords |
| `mal_get_anime_details` | Get full details for an anime by MAL ID |
| `mal_anime_ranking` | Browse anime rankings (top, airing, upcoming, movies, etc.) |
| `mal_anime_seasonal` | Get anime for a specific season/year |
| `mal_search_manga` | Search manga by title or keywords |
| `mal_get_manga_details` | Get full details for a manga by MAL ID |
| `mal_manga_ranking` | Browse manga rankings (top, novels, manhwa, etc.) |

All tools return human-readable formatted text with scores, genres, synopses, MAL links, and more.

## Prerequisites

- **Node.js** 18+ (uses native `fetch`)
- A **MyAnimeList API Client ID** (free, takes 2 minutes)

## Getting Your MAL Client ID

1. Go to [https://myanimelist.net/apiconfig/create](https://myanimelist.net/apiconfig/create) (you'll need a MAL account)
2. Fill in:
   - **App Name**: anything you want (e.g. "My MCP Server")
   - **App Type**: "other"
   - **App Description**: anything (e.g. "Personal MCP server for anime lookup")
   - **App Redirect URL**: `http://localhost` (not used for Client ID auth, but the field is required)
   - **Homepage URL**: optional
   - **Commercial / Non-Commercial**: Non-Commercial
3. Submit. You'll get a **Client ID** on the next page. Copy it.

> **Keep your Client ID private.** Don't commit it to git or share it publicly.

## Installation

```bash
# Clone or download this repo
cd mal-mcp-server

# Install dependencies
npm install

# Build
npm run build
```

## Configuration

The server needs one environment variable:

```
MAL_CLIENT_ID=your_client_id_here
```

You can set this in your MCP client config (see below), in your shell profile, or in a `.env` file (if you add `dotenv` support yourself).

## Using with Claude Desktop

Add to your Claude Desktop config file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "mal": {
      "command": "node",
      "args": ["/absolute/path/to/mal-mcp-server/dist/index.js"],
      "env": {
        "MAL_CLIENT_ID": "your_client_id_here"
      }
    }
  }
}
```

Restart Claude Desktop after editing.

## Using with Claude Code

Add from your project directory:

```bash
claude mcp add mal -- node /absolute/path/to/mal-mcp-server/dist/index.js
```

Then set the environment variable in your shell before running Claude Code, or add it to the command:

```bash
MAL_CLIENT_ID=your_client_id_here claude
```

Alternatively, add to your Claude Code MCP config (`~/.claude/claude_code_config.json` or project-level `.mcp.json`):

```json
{
  "mcpServers": {
    "mal": {
      "command": "node",
      "args": ["/absolute/path/to/mal-mcp-server/dist/index.js"],
      "env": {
        "MAL_CLIENT_ID": "your_client_id_here"
      }
    }
  }
}
```

## Example Queries

Once connected, you can ask your AI things like:

- *"Search MAL for anime about cute cats"*
- *"What's the top rated anime right now?"*
- *"Show me what's airing this season sorted by score"*
- *"Get me the details on Frieren (anime ID 154587)"*
- *"What are the top rated manga?"*
- *"Look up the manga Berserk on MAL"*
- *"What anime aired in summer 2024?"*

The AI will call the appropriate tool(s) and present the results.

## Tool Details

### mal_search_anime

Search by keywords. Returns title, score, status, type, episodes, genres, studios, season, and MAL link.

Parameters:
- `query` (string, required): Search text, 2-200 chars
- `limit` (number): 1-100, default 10
- `offset` (number): pagination, default 0
- `nsfw` (boolean): include NSFW results, default false

### mal_get_anime_details

Fetch comprehensive details by MAL anime ID. Returns everything `search` does plus: synopsis, background, alternative titles, airing dates, broadcast info, rating, related anime, recommendations, and list statistics.

Parameters:
- `anime_id` (number, required): MAL anime ID

### mal_anime_ranking

Ranked lists. Available ranking types:
- `all` — overall top anime
- `airing` — top currently airing
- `upcoming` — top upcoming
- `tv` — top TV series
- `ova` — top OVAs
- `movie` — top movies
- `special` — top specials
- `bypopularity` — most members
- `favorite` — most favorited

Parameters:
- `ranking_type` (string): default "all"
- `limit` (number): 1-100, default 10
- `offset` (number): default 0

### mal_anime_seasonal

Browse anime by season. Defaults to the current season if year/season are omitted.

Parameters:
- `year` (number): 1900-2100, optional
- `season` (string): "winter" | "spring" | "summer" | "fall", optional
- `sort` (string): "anime_score" | "anime_num_list_users" | "", default ""
- `limit` (number): 1-100, default 10
- `offset` (number): default 0

### mal_search_manga

Like anime search, but for manga. Returns title, score, type, volumes, chapters, genres, authors.

Parameters:
- `query` (string, required): 2-200 chars
- `limit` (number): 1-100, default 10
- `offset` (number): default 0
- `nsfw` (boolean): default false

### mal_get_manga_details

Full manga details by MAL ID. Synopsis, authors, serialization, related works, recommendations.

Parameters:
- `manga_id` (number, required): MAL manga ID

### mal_manga_ranking

Ranked manga lists. Available types: `all`, `manga`, `novels`, `oneshots`, `doujin`, `manhwa`, `manhua`, `bypopularity`, `favorite`.

Parameters:
- `ranking_type` (string): default "all"
- `limit` (number): 1-100, default 10
- `offset` (number): default 0

## Architecture

```
src/
├── index.ts     # MCP server setup + all 7 tool registrations
├── client.ts    # MAL API client (typed fetch wrapper)
├── format.ts    # Response formatting (API data → readable text)
└── types.ts     # TypeScript interfaces for MAL API responses
```

- **Transport**: stdio (runs as a subprocess of your MCP client)
- **Auth**: Uses `X-MAL-CLIENT-ID` header (no OAuth needed for read-only access)
- **No external HTTP library** — uses Node.js native `fetch`
- **Zero runtime dependencies** beyond the MCP SDK and Zod

## Future Work (Phase 2)

These features would require OAuth 2.0 authentication (PKCE flow):

- `mal_get_my_animelist` — view your anime list
- `mal_update_anime_status` — add/update entries on your list
- `mal_anime_suggestions` — MAL's personalized suggestions
- `mal_get_my_mangalist` — view your manga list
- `mal_update_manga_status` — add/update manga entries
- `mal_get_user_info` — get your profile info

The MAL API uses OAuth 2.0 with PKCE. The general flow would be:
1. Generate a PKCE code_verifier + code_challenge
2. Open browser to MAL's auth URL
3. User authorizes → callback receives an auth code
4. Exchange code for access_token + refresh_token
5. Store tokens and auto-refresh when expired

## API Agreement

By using the MAL API you agree to their [API License and Developer Agreement](https://myanimelist.net/static/apiagreement.html). Key points:

- Keep your Client ID secret
- Don't scrape — only access data through the API
- Non-commercial personal use is fine
- Don't store MAL user personal info server-side
- Don't impersonate the MAL experience

## License

MIT
