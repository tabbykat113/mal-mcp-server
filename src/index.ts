#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { MalApiClient } from "./client.js";
import {
  formatAnimeList,
  formatAnimeRanking,
  formatAnimeDetails,
  formatMangaList,
  formatMangaRanking,
  formatMangaDetails,
} from "./format.js";

// ─── Config ───

const MAL_CLIENT_ID = process.env.MAL_CLIENT_ID;

if (!MAL_CLIENT_ID) {
  console.error(
    "Error: MAL_CLIENT_ID environment variable is required.\n" +
    "Get one at https://myanimelist.net/apiconfig/create"
  );
  process.exit(1);
}

const client = new MalApiClient(MAL_CLIENT_ID);

// ─── Server ───

const server = new McpServer({
  name: "mal-mcp-server",
  version: "1.0.0",
});

// ─── Helper to wrap tool handlers with error handling ───

function toolResult(text: string, isError: boolean = false) {
  return {
    content: [{ type: "text" as const, text }],
    ...(isError ? { isError: true } : {}),
  };
}

async function handleToolError(fn: () => Promise<string>): Promise<ReturnType<typeof toolResult>> {
  try {
    const text = await fn();
    return toolResult(text);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return toolResult(`Error: ${message}`, true);
  }
}

// ─── Current Season Helper ───

function getCurrentSeason(): { year: number; season: string } {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const year = now.getFullYear();
  let season: string;
  if (month <= 3) season = "winter";
  else if (month <= 6) season = "spring";
  else if (month <= 9) season = "summer";
  else season = "fall";
  return { year, season };
}

// ═══════════════════════════════════
//  ANIME TOOLS
// ═══════════════════════════════════

server.registerTool(
  "mal_search_anime",
  {
    title: "Search Anime on MAL",
    description: `Search for anime on MyAnimeList by title/keywords.

Returns a list of matching anime with scores, genres, episode counts, studios, and MAL links.

Args:
  - query: Search text (min 2 chars). Can be a title, keyword, or phrase.
  - limit: Max results to return, 1-100 (default: 10)
  - offset: Pagination offset (default: 0)
  - nsfw: Include NSFW results (default: false)

Examples:
  - "cute animals anime" -> finds anime matching those keywords
  - "Spy x Family" -> finds that specific anime
  - "studio ghibli" -> finds Ghibli works`,
    inputSchema: {
      query: z.string().min(2).max(200).describe("Search text (anime title or keywords)"),
      limit: z.number().int().min(1).max(100).default(10).describe("Max results (default: 10)"),
      offset: z.number().int().min(0).default(0).describe("Pagination offset"),
      nsfw: z.boolean().default(false).describe("Include NSFW results"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async ({ query, limit, offset, nsfw }) => {
    return handleToolError(async () => {
      const result = await client.searchAnime(query, limit, offset, nsfw);
      return formatAnimeList(result.data, result.paging);
    });
  },
);

server.registerTool(
  "mal_get_anime_details",
  {
    title: "Get Anime Details from MAL",
    description: `Get full details for a specific anime by its MAL ID.

Returns comprehensive info: title, score, synopsis, genres, studios, episodes, airing dates, related anime, recommendations, and list statistics.

Args:
  - anime_id: The MyAnimeList anime ID (a positive integer).

Use after searching to get the full picture of a specific anime.`,
    inputSchema: {
      anime_id: z.number().int().positive().describe("MAL anime ID"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async ({ anime_id }) => {
    return handleToolError(async () => {
      const anime = await client.getAnimeDetails(anime_id);
      return formatAnimeDetails(anime);
    });
  },
);

server.registerTool(
  "mal_anime_ranking",
  {
    title: "Get Anime Rankings from MAL",
    description: `Get ranked anime lists from MyAnimeList.

Args:
  - ranking_type: One of "all", "airing", "upcoming", "tv", "ova", "movie", "special", "bypopularity", "favorite" (default: "all")
  - limit: Max results, 1-100 (default: 10)
  - offset: Pagination offset (default: 0)

Ranking types:
  - "all": Overall top anime
  - "airing": Currently airing top anime
  - "upcoming": Top upcoming anime
  - "tv": Top TV series
  - "movie": Top anime movies
  - "bypopularity": Most popular (by number of list users)
  - "favorite": Most favorited`,
    inputSchema: {
      ranking_type: z.enum([
        "all", "airing", "upcoming", "tv", "ova",
        "movie", "special", "bypopularity", "favorite",
      ]).default("all").describe("Type of ranking"),
      limit: z.number().int().min(1).max(100).default(10).describe("Max results (default: 10)"),
      offset: z.number().int().min(0).default(0).describe("Pagination offset"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async ({ ranking_type, limit, offset }) => {
    return handleToolError(async () => {
      const result = await client.getAnimeRanking(ranking_type, limit, offset);
      return formatAnimeRanking(result.data, result.paging);
    });
  },
);

server.registerTool(
  "mal_anime_seasonal",
  {
    title: "Get Seasonal Anime from MAL",
    description: `Get anime for a specific season and year.

Args:
  - year: The year (e.g. 2025). Defaults to the current year.
  - season: One of "winter", "spring", "summer", "fall". Defaults to the current season.
  - sort: Sort by "anime_score", "anime_num_list_users", or "" for default (default: "")
  - limit: Max results, 1-100 (default: 10)
  - offset: Pagination offset (default: 0)

Season months:
  - winter: Jan-Mar
  - spring: Apr-Jun
  - summer: Jul-Sep
  - fall: Oct-Dec`,
    inputSchema: {
      year: z.number().int().min(1900).max(2100).optional().describe("Year (defaults to current)"),
      season: z.enum(["winter", "spring", "summer", "fall"]).optional().describe("Season (defaults to current)"),
      sort: z.enum(["anime_score", "anime_num_list_users", ""]).default("").describe("Sort order"),
      limit: z.number().int().min(1).max(100).default(10).describe("Max results (default: 10)"),
      offset: z.number().int().min(0).default(0).describe("Pagination offset"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async ({ year, season, sort, limit, offset }) => {
    return handleToolError(async () => {
      const current = getCurrentSeason();
      const y = year ?? current.year;
      const s = season ?? current.season;
      const result = await client.getSeasonalAnime(y, s, sort, limit, offset);
      return `Seasonal Anime: ${s} ${y}\n${"─".repeat(30)}\n\n` +
        formatAnimeList(result.data, result.paging);
    });
  },
);

// ═══════════════════════════════════
//  MANGA TOOLS
// ═══════════════════════════════════

server.registerTool(
  "mal_search_manga",
  {
    title: "Search Manga on MAL",
    description: `Search for manga on MyAnimeList by title/keywords.

Returns a list of matching manga with scores, genres, volumes, chapters, authors, and MAL links.

Args:
  - query: Search text (min 2 chars).
  - limit: Max results, 1-100 (default: 10)
  - offset: Pagination offset (default: 0)
  - nsfw: Include NSFW results (default: false)`,
    inputSchema: {
      query: z.string().min(2).max(200).describe("Search text (manga title or keywords)"),
      limit: z.number().int().min(1).max(100).default(10).describe("Max results (default: 10)"),
      offset: z.number().int().min(0).default(0).describe("Pagination offset"),
      nsfw: z.boolean().default(false).describe("Include NSFW results"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async ({ query, limit, offset, nsfw }) => {
    return handleToolError(async () => {
      const result = await client.searchManga(query, limit, offset, nsfw);
      return formatMangaList(result.data, result.paging);
    });
  },
);

server.registerTool(
  "mal_get_manga_details",
  {
    title: "Get Manga Details from MAL",
    description: `Get full details for a specific manga by its MAL ID.

Returns comprehensive info: title, score, synopsis, genres, authors, volumes, chapters, related manga, recommendations.

Args:
  - manga_id: The MyAnimeList manga ID (a positive integer).`,
    inputSchema: {
      manga_id: z.number().int().positive().describe("MAL manga ID"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async ({ manga_id }) => {
    return handleToolError(async () => {
      const manga = await client.getMangaDetails(manga_id);
      return formatMangaDetails(manga);
    });
  },
);

server.registerTool(
  "mal_manga_ranking",
  {
    title: "Get Manga Rankings from MAL",
    description: `Get ranked manga lists from MyAnimeList.

Args:
  - ranking_type: One of "all", "manga", "novels", "oneshots", "doujin", "manhwa", "manhua", "bypopularity", "favorite" (default: "all")
  - limit: Max results, 1-100 (default: 10)
  - offset: Pagination offset (default: 0)

Ranking types:
  - "all": Overall top
  - "manga": Top manga specifically
  - "novels": Top light novels
  - "oneshots": Top one-shots
  - "manhwa": Top Korean manhwa
  - "manhua": Top Chinese manhua
  - "bypopularity": Most popular
  - "favorite": Most favorited`,
    inputSchema: {
      ranking_type: z.enum([
        "all", "manga", "novels", "oneshots", "doujin",
        "manhwa", "manhua", "bypopularity", "favorite",
      ]).default("all").describe("Type of ranking"),
      limit: z.number().int().min(1).max(100).default(10).describe("Max results (default: 10)"),
      offset: z.number().int().min(0).default(0).describe("Pagination offset"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async ({ ranking_type, limit, offset }) => {
    return handleToolError(async () => {
      const result = await client.getMangaRanking(ranking_type, limit, offset);
      return formatMangaRanking(result.data, result.paging);
    });
  },
);

// ─── Start Server ───

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("mal-mcp-server running on stdio");
}

main().catch((error: unknown) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
