import { z } from "zod";
import type { MalListResponse, MalPaging } from "./types.js";

// ─── Filter Metadata ───

export interface FilterMeta {
  totalScanned: number;
  totalMatched: number;
  pagesScanned: number;
  activeFilters: string[];
  hasMorePages: boolean;
  nextOffset?: number;
}

// ─── Zod Schemas (spread into tool inputSchemas) ───

const baseFilterSchema = {
  genres_include: z.array(z.string()).optional()
    .describe("Only include items matching these genres (case-insensitive, e.g. ['Action', 'Romance'])"),
  genres_exclude: z.array(z.string()).optional()
    .describe("Exclude items with ANY of these genres (case-insensitive)"),
  genre_mode: z.enum(["or", "and"]).default("or")
    .describe("How genres_include matches: 'or' = any genre matches (default), 'and' = all genres must match"),
  min_score: z.number().min(0).max(10).optional()
    .describe("Minimum mean score (0-10)"),
  min_members: z.number().int().min(0).optional()
    .describe("Minimum number of MAL list members"),
};

export const animeFilterSchema = {
  ...baseFilterSchema,
  media_type: z.array(
    z.enum(["tv", "ova", "movie", "ona", "special", "music"]),
  ).optional().describe("Only include these media types"),
  status: z.enum([
    "currently_airing", "finished_airing", "not_yet_aired",
  ]).optional().describe("Only include anime with this airing status"),
  source: z.array(
    z.enum(["manga", "light_novel", "original", "visual_novel", "game", "other"]),
  ).optional().describe("Only include anime from these source materials"),
};

export const seasonalAnimeFilterSchema = {
  ...animeFilterSchema,
  current_season_only: z.boolean().default(false)
    .describe("Only show anime that premiered this season (filters out continuing shows)"),
};

export const mangaFilterSchema = {
  ...baseFilterSchema,
  media_type: z.array(
    z.enum(["manga", "novel", "one_shot", "doujinshi", "manhwa", "manhua", "oel"]),
  ).optional().describe("Only include these manga types"),
  status: z.enum([
    "currently_publishing", "finished", "not_yet_published",
  ]).optional().describe("Only include manga with this publication status"),
};

// ─── Filter Key Lists (for pickFilters) ───

export const ANIME_FILTER_KEYS = [
  "genres_include", "genres_exclude", "genre_mode", "min_score", "min_members",
  "media_type", "status", "source",
];

export const SEASONAL_FILTER_KEYS = [...ANIME_FILTER_KEYS, "current_season_only"];

export const MANGA_FILTER_KEYS = [
  "genres_include", "genres_exclude", "genre_mode", "min_score", "min_members",
  "media_type", "status",
];

// ─── Filter Helpers ───

export function pickFilters(
  args: Record<string, unknown>,
  filterKeys: string[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of filterKeys) {
    if (args[key] !== undefined) result[key] = args[key];
  }
  return result;
}

// Keys that modify filter behavior but aren't filters themselves
const MODIFIER_KEYS = new Set(["genre_mode"]);

export function hasActiveFilters(filters: Record<string, unknown>): boolean {
  return Object.entries(filters).some(([key, value]) => {
    if (MODIFIER_KEYS.has(key)) return false;
    if (value === undefined || value === false) return false;
    if (Array.isArray(value) && value.length === 0) return false;
    return true;
  });
}

// ─── Predicate ───

interface FilterableNode {
  genres?: { name: string }[];
  mean?: number;
  media_type?: string;
  status?: string;
  num_list_users?: number;
  source?: string;
  start_season?: { year: number; season: string };
}

interface FilterParams {
  genres_include?: string[];
  genres_exclude?: string[];
  genre_mode?: "or" | "and";
  min_score?: number;
  min_members?: number;
  media_type?: string[];
  status?: string;
  source?: string[];
  current_season_only?: boolean;
}

interface SeasonContext {
  queriedYear: number;
  queriedSeason: string;
}

function matchesFilters(
  node: FilterableNode,
  filters: FilterParams,
  seasonContext?: SeasonContext,
): boolean {
  const genreNames = (node.genres ?? []).map((g) => g.name.toLowerCase());

  if (filters.genres_include && filters.genres_include.length > 0) {
    const wanted = filters.genres_include.map((g) => g.toLowerCase());
    const mode = filters.genre_mode ?? "or";
    if (mode === "and") {
      if (!wanted.every((w) => genreNames.includes(w))) return false;
    } else {
      if (!wanted.some((w) => genreNames.includes(w))) return false;
    }
  }

  if (filters.genres_exclude && filters.genres_exclude.length > 0) {
    const excluded = filters.genres_exclude.map((g) => g.toLowerCase());
    if (excluded.some((e) => genreNames.includes(e))) return false;
  }

  if (filters.min_score !== undefined) {
    if (node.mean === undefined || node.mean < filters.min_score) return false;
  }

  if (filters.min_members !== undefined) {
    if ((node.num_list_users ?? 0) < filters.min_members) return false;
  }

  if (filters.media_type && filters.media_type.length > 0) {
    if (!node.media_type || !filters.media_type.includes(node.media_type)) return false;
  }

  if (filters.status) {
    if (node.status !== filters.status) return false;
  }

  if (filters.source && filters.source.length > 0) {
    if (!node.source || !filters.source.includes(node.source)) return false;
  }

  if (filters.current_season_only && seasonContext) {
    if (!node.start_season) return false;
    if (
      node.start_season.year !== seasonContext.queriedYear ||
      node.start_season.season !== seasonContext.queriedSeason
    ) return false;
  }

  return true;
}

// ─── Filter Description Builder ───

function buildActiveFilterDescriptions(filters: Record<string, unknown>): string[] {
  const parts: string[] = [];

  const arr = (key: string) => filters[key] as string[] | undefined;
  const str = (key: string) => filters[key] as string | undefined;
  const num = (key: string) => filters[key] as number | undefined;

  if (arr("genres_include")?.length) {
    const mode = (str("genre_mode") ?? "or").toUpperCase();
    parts.push(`genres(${mode})=${arr("genres_include")!.join(",")}`);
  }
  if (arr("genres_exclude")?.length)
    parts.push(`exclude_genres=${arr("genres_exclude")!.join(",")}`);
  if (num("min_score") !== undefined)
    parts.push(`min_score>=${num("min_score")}`);
  if (num("min_members") !== undefined)
    parts.push(`min_members>=${num("min_members")}`);
  if (arr("media_type")?.length)
    parts.push(`media_type=${arr("media_type")!.join(",")}`);
  if (str("status"))
    parts.push(`status=${str("status")}`);
  if (arr("source")?.length)
    parts.push(`source=${arr("source")!.join(",")}`);
  if (filters.current_season_only)
    parts.push("current_season_only");

  return parts;
}

// ─── Auto-Paginating Filtered Fetch ───

const FILTERED_PAGE_SIZE = 100;

export async function filteredFetch<T extends { node: FilterableNode }>(options: {
  fetchPage: (limit: number, offset: number) => Promise<MalListResponse<T>>;
  filters: Record<string, unknown>;
  requestedLimit: number;
  initialOffset: number;
  seasonContext?: SeasonContext;
}): Promise<{ items: T[]; meta: FilterMeta }> {
  const { fetchPage, filters, requestedLimit, initialOffset, seasonContext } = options;

  // No filters active: single fetch at user's requested limit (current behavior)
  if (!hasActiveFilters(filters)) {
    const result = await fetchPage(requestedLimit, initialOffset);
    return {
      items: result.data,
      meta: {
        totalScanned: result.data.length,
        totalMatched: result.data.length,
        pagesScanned: 1,
        activeFilters: [],
        hasMorePages: !!result.paging.next,
      },
    };
  }

  // Filters active: single fetch of 100, filter client-side
  const typedFilters = filters as FilterParams;
  const result = await fetchPage(FILTERED_PAGE_SIZE, initialOffset);
  const matched: T[] = [];

  for (const item of result.data) {
    if (matchesFilters(item.node, typedFilters, seasonContext)) {
      matched.push(item);
      if (matched.length >= requestedLimit) break;
    }
  }

  // Only report more pages if the API says so AND we got a full page back.
  // If we got fewer than FILTERED_PAGE_SIZE items, the API has no more data
  // regardless of what paging.next says.
  const hasMore = !!result.paging.next && result.data.length >= FILTERED_PAGE_SIZE;

  return {
    items: matched.slice(0, requestedLimit),
    meta: {
      totalScanned: result.data.length,
      totalMatched: matched.length,
      pagesScanned: 1,
      activeFilters: buildActiveFilterDescriptions(filters),
      hasMorePages: hasMore,
      nextOffset: hasMore ? initialOffset + result.data.length : undefined,
    },
  };
}
