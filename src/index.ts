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
  formatFilterMeta,
} from "./format.js";
import {
  animeFilterSchema,
  seasonalAnimeFilterSchema,
  mangaFilterSchema,
  ANIME_FILTER_KEYS,
  SEASONAL_FILTER_KEYS,
  MANGA_FILTER_KEYS,
  pickFilters,
  filteredFetch,
} from "./filters.js";

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

Supports server-side filters: genres_include, genres_exclude, min_score, media_type, status, source, min_members. When filters are active, auto-paginates up to 150 results internally to fill your requested limit.

Examples:
  - "cute animals anime" -> finds anime matching those keywords
  - "Spy x Family" -> finds that specific anime
  - query: "fantasy", genres_include: ["Action"], min_score: 7.5 -> top-rated action fantasy anime`,
    inputSchema: {
      query: z.string().min(2).max(200).describe("Search text (anime title or keywords)"),
      limit: z.number().int().min(1).max(100).default(10).describe("Max results (default: 10)"),
      offset: z.number().int().min(0).default(0).describe("Pagination offset"),
      nsfw: z.boolean().default(false).describe("Include NSFW results"),
      ...animeFilterSchema,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async ({ query, limit, offset, nsfw, ...rest }) => {
    return handleToolError(async () => {
      const filters = pickFilters(rest as Record<string, unknown>, ANIME_FILTER_KEYS);
      const { items, meta } = await filteredFetch({
        fetchPage: (l, o) => client.searchAnime(query, l, o, nsfw),
        filters,
        requestedLimit: limit,
        initialOffset: offset,
      });
      const body = formatAnimeList(items, { next: meta.hasMorePages ? "yes" : undefined });
      if (meta.activeFilters.length > 0) {
        return formatFilterMeta(meta) + "\n\n" + body;
      }
      return body;
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
  - "favorite": Most favorited

Supports server-side filters: genres_include, genres_exclude, min_score, media_type, status, source, min_members. Filtered results keep their original MAL rank numbers.`,
    inputSchema: {
      ranking_type: z.enum([
        "all", "airing", "upcoming", "tv", "ova",
        "movie", "special", "bypopularity", "favorite",
      ]).default("all").describe("Type of ranking"),
      limit: z.number().int().min(1).max(100).default(10).describe("Max results (default: 10)"),
      offset: z.number().int().min(0).default(0).describe("Pagination offset"),
      ...animeFilterSchema,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async ({ ranking_type, limit, offset, ...rest }) => {
    return handleToolError(async () => {
      const filters = pickFilters(rest as Record<string, unknown>, ANIME_FILTER_KEYS);
      const { items, meta } = await filteredFetch({
        fetchPage: (l, o) => client.getAnimeRanking(ranking_type, l, o),
        filters,
        requestedLimit: limit,
        initialOffset: offset,
      });
      const body = formatAnimeRanking(items, { next: meta.hasMorePages ? "yes" : undefined });
      if (meta.activeFilters.length > 0) {
        return formatFilterMeta(meta) + "\n\n" + body;
      }
      return body;
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
  - fall: Oct-Dec

Supports server-side filters: genres_include, genres_exclude, min_score, media_type, status, source, min_members, current_season_only. Use current_season_only to filter out continuing shows and only show new premieres.`,
    inputSchema: {
      year: z.number().int().min(1900).max(2100).optional().describe("Year (defaults to current)"),
      season: z.enum(["winter", "spring", "summer", "fall"]).optional().describe("Season (defaults to current)"),
      sort: z.enum(["anime_score", "anime_num_list_users", ""]).default("").describe("Sort order"),
      limit: z.number().int().min(1).max(100).default(10).describe("Max results (default: 10)"),
      offset: z.number().int().min(0).default(0).describe("Pagination offset"),
      ...seasonalAnimeFilterSchema,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async ({ year, season, sort, limit, offset, ...rest }) => {
    return handleToolError(async () => {
      const current = getCurrentSeason();
      const y = year ?? current.year;
      const s = season ?? current.season;
      const filters = pickFilters(rest as Record<string, unknown>, SEASONAL_FILTER_KEYS);
      const { items, meta } = await filteredFetch({
        fetchPage: (l, o) => client.getSeasonalAnime(y, s, sort, l, o),
        filters,
        requestedLimit: limit,
        initialOffset: offset,
        seasonContext: { queriedYear: y, queriedSeason: s },
      });
      const header = `Seasonal Anime: ${s} ${y}\n${"─".repeat(30)}\n\n`;
      const body = formatAnimeList(items, { next: meta.hasMorePages ? "yes" : undefined });
      if (meta.activeFilters.length > 0) {
        return header + formatFilterMeta(meta) + "\n\n" + body;
      }
      return header + body;
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
  - nsfw: Include NSFW results (default: false)

Supports server-side filters: genres_include, genres_exclude, min_score, media_type, status, min_members. When filters are active, auto-paginates up to 150 results internally to fill your requested limit.`,
    inputSchema: {
      query: z.string().min(2).max(200).describe("Search text (manga title or keywords)"),
      limit: z.number().int().min(1).max(100).default(10).describe("Max results (default: 10)"),
      offset: z.number().int().min(0).default(0).describe("Pagination offset"),
      nsfw: z.boolean().default(false).describe("Include NSFW results"),
      ...mangaFilterSchema,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async ({ query, limit, offset, nsfw, ...rest }) => {
    return handleToolError(async () => {
      const filters = pickFilters(rest as Record<string, unknown>, MANGA_FILTER_KEYS);
      const { items, meta } = await filteredFetch({
        fetchPage: (l, o) => client.searchManga(query, l, o, nsfw),
        filters,
        requestedLimit: limit,
        initialOffset: offset,
      });
      const body = formatMangaList(items, { next: meta.hasMorePages ? "yes" : undefined });
      if (meta.activeFilters.length > 0) {
        return formatFilterMeta(meta) + "\n\n" + body;
      }
      return body;
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
  - "favorite": Most favorited

Supports server-side filters: genres_include, genres_exclude, min_score, media_type, status, min_members. Filtered results keep their original MAL rank numbers.`,
    inputSchema: {
      ranking_type: z.enum([
        "all", "manga", "novels", "oneshots", "doujin",
        "manhwa", "manhua", "bypopularity", "favorite",
      ]).default("all").describe("Type of ranking"),
      limit: z.number().int().min(1).max(100).default(10).describe("Max results (default: 10)"),
      offset: z.number().int().min(0).default(0).describe("Pagination offset"),
      ...mangaFilterSchema,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async ({ ranking_type, limit, offset, ...rest }) => {
    return handleToolError(async () => {
      const filters = pickFilters(rest as Record<string, unknown>, MANGA_FILTER_KEYS);
      const { items, meta } = await filteredFetch({
        fetchPage: (l, o) => client.getMangaRanking(ranking_type, l, o),
        filters,
        requestedLimit: limit,
        initialOffset: offset,
      });
      const body = formatMangaRanking(items, { next: meta.hasMorePages ? "yes" : undefined });
      if (meta.activeFilters.length > 0) {
        return formatFilterMeta(meta) + "\n\n" + body;
      }
      return body;
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
