import type {
  MalAnimeNode,
  MalAnimeListItem,
  MalAnimeRankingItem,
  MalMangaNode,
  MalMangaListItem,
  MalMangaRankingItem,
  MalPaging,
} from "./types.js";
import type { FilterMeta } from "./filters.js";

// ─── Shared Helpers ───

function formatScore(mean: number | undefined): string {
  return mean !== undefined ? `★ ${mean.toFixed(2)}` : "unrated";
}

function formatGenres(genres: { name: string }[] | undefined): string {
  if (!genres || genres.length === 0) return "";
  return genres.map((g) => g.name).join(", ");
}

function formatStatus(status: string | undefined): string {
  if (!status) return "unknown";
  return status.replace(/_/g, " ");
}

function formatDuration(seconds: number | undefined): string {
  if (!seconds) return "unknown";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function malUrl(type: "anime" | "manga", id: number): string {
  return `https://myanimelist.net/${type}/${id}`;
}

function paginationInfo(paging: MalPaging): string {
  const parts: string[] = [];
  if (paging.next) parts.push("More results available (increase offset).");
  return parts.length > 0 ? `\n${parts.join(" ")}` : "";
}

// ─── Anime Formatting ───

function formatAnimeCompact(node: MalAnimeNode, prefix: string = ""): string {
  const parts = [
    `${prefix}${node.title}`,
    `  ID: ${node.id} | ${formatScore(node.mean)} | ${formatStatus(node.status)}`,
    `  Type: ${node.media_type ?? "unknown"} | Episodes: ${node.num_episodes ?? "?"}`,
  ];

  if (node.genres && node.genres.length > 0) {
    parts.push(`  Genres: ${formatGenres(node.genres)}`);
  }
  if (node.start_season) {
    parts.push(`  Season: ${node.start_season.season} ${node.start_season.year}`);
  }
  if (node.studios && node.studios.length > 0) {
    parts.push(`  Studios: ${node.studios.map((s) => s.name).join(", ")}`);
  }
  parts.push(`  ${malUrl("anime", node.id)}`);

  return parts.join("\n");
}

export function formatAnimeList(
  items: MalAnimeListItem[],
  paging: MalPaging,
): string {
  if (items.length === 0) return "No anime found.";

  const lines = items.map((item, i) =>
    formatAnimeCompact(item.node, `${i + 1}. `)
  );
  return lines.join("\n\n") + paginationInfo(paging);
}

export function formatAnimeRanking(
  items: MalAnimeRankingItem[],
  paging: MalPaging,
): string {
  if (items.length === 0) return "No anime found.";

  const lines = items.map((item) =>
    formatAnimeCompact(item.node, `#${item.ranking.rank} `)
  );
  return lines.join("\n\n") + paginationInfo(paging);
}

export function formatAnimeDetails(anime: MalAnimeNode): string {
  const parts = [
    `${anime.title}`,
    `${"═".repeat(Math.min(anime.title.length, 60))}`,
    `MAL ID: ${anime.id} | ${malUrl("anime", anime.id)}`,
    `Score: ${formatScore(anime.mean)} (${anime.num_scoring_users ?? 0} votes) | Rank: #${anime.rank ?? "?"} | Popularity: #${anime.popularity ?? "?"}`,
    `Type: ${anime.media_type ?? "unknown"} | Episodes: ${anime.num_episodes ?? "?"} | Duration: ${formatDuration(anime.average_episode_duration)}`,
    `Status: ${formatStatus(anime.status)} | Rating: ${anime.rating ?? "unknown"}`,
  ];

  if (anime.alternative_titles) {
    const alt = anime.alternative_titles;
    if (alt.en) parts.push(`English: ${alt.en}`);
    if (alt.ja) parts.push(`Japanese: ${alt.ja}`);
    if (alt.synonyms && alt.synonyms.length > 0) {
      parts.push(`Synonyms: ${alt.synonyms.join(", ")}`);
    }
  }

  if (anime.start_season) {
    parts.push(`Season: ${anime.start_season.season} ${anime.start_season.year}`);
  }
  if (anime.start_date || anime.end_date) {
    parts.push(`Aired: ${anime.start_date ?? "?"} → ${anime.end_date ?? "?"}`);
  }

  if (anime.source) parts.push(`Source: ${anime.source.replace(/_/g, " ")}`);

  if (anime.studios && anime.studios.length > 0) {
    parts.push(`Studios: ${anime.studios.map((s) => s.name).join(", ")}`);
  }
  if (anime.genres && anime.genres.length > 0) {
    parts.push(`Genres: ${formatGenres(anime.genres)}`);
  }

  if (anime.synopsis) {
    parts.push("", "Synopsis:", anime.synopsis);
  }

  if (anime.background) {
    parts.push("", "Background:", anime.background);
  }

  if (anime.related_anime && anime.related_anime.length > 0) {
    parts.push(
      "",
      "Related Anime:",
      ...anime.related_anime.map(
        (r) => `  ${r.relation_type_formatted}: ${r.node.title} (${malUrl("anime", r.node.id)})`
      ),
    );
  }

  if (anime.recommendations && anime.recommendations.length > 0) {
    const top = anime.recommendations.slice(0, 5);
    parts.push(
      "",
      "Recommendations:",
      ...top.map(
        (r) => `  ${r.node.title} (${r.num_recommendations} recs) — ${malUrl("anime", r.node.id)}`
      ),
    );
  }

  if (anime.statistics) {
    const s = anime.statistics.status;
    parts.push(
      "",
      "List Statistics:",
      `  Watching: ${s.watching} | Completed: ${s.completed} | On Hold: ${s.on_hold}`,
      `  Dropped: ${s.dropped} | Plan to Watch: ${s.plan_to_watch}`,
      `  Total list users: ${anime.statistics.num_list_users}`,
    );
  }

  return parts.join("\n");
}

// ─── Manga Formatting ───

function formatMangaCompact(node: MalMangaNode, prefix: string = ""): string {
  const parts = [
    `${prefix}${node.title}`,
    `  ID: ${node.id} | ${formatScore(node.mean)} | ${formatStatus(node.status)}`,
    `  Type: ${node.media_type ?? "unknown"} | Volumes: ${node.num_volumes ?? "?"} | Chapters: ${node.num_chapters ?? "?"}`,
  ];

  if (node.genres && node.genres.length > 0) {
    parts.push(`  Genres: ${formatGenres(node.genres)}`);
  }
  if (node.authors && node.authors.length > 0) {
    parts.push(
      `  Authors: ${node.authors.map((a) => `${a.node.first_name} ${a.node.last_name} (${a.role})`).join(", ")}`
    );
  }
  parts.push(`  ${malUrl("manga", node.id)}`);

  return parts.join("\n");
}

export function formatMangaList(
  items: MalMangaListItem[],
  paging: MalPaging,
): string {
  if (items.length === 0) return "No manga found.";

  const lines = items.map((item, i) =>
    formatMangaCompact(item.node, `${i + 1}. `)
  );
  return lines.join("\n\n") + paginationInfo(paging);
}

export function formatMangaRanking(
  items: MalMangaRankingItem[],
  paging: MalPaging,
): string {
  if (items.length === 0) return "No manga found.";

  const lines = items.map((item) =>
    formatMangaCompact(item.node, `#${item.ranking.rank} `)
  );
  return lines.join("\n\n") + paginationInfo(paging);
}

export function formatMangaDetails(manga: MalMangaNode): string {
  const parts = [
    `${manga.title}`,
    `${"═".repeat(Math.min(manga.title.length, 60))}`,
    `MAL ID: ${manga.id} | ${malUrl("manga", manga.id)}`,
    `Score: ${formatScore(manga.mean)} (${manga.num_scoring_users ?? 0} votes) | Rank: #${manga.rank ?? "?"} | Popularity: #${manga.popularity ?? "?"}`,
    `Type: ${manga.media_type ?? "unknown"} | Volumes: ${manga.num_volumes ?? "?"} | Chapters: ${manga.num_chapters ?? "?"}`,
    `Status: ${formatStatus(manga.status)}`,
  ];

  if (manga.alternative_titles) {
    const alt = manga.alternative_titles;
    if (alt.en) parts.push(`English: ${alt.en}`);
    if (alt.ja) parts.push(`Japanese: ${alt.ja}`);
    if (alt.synonyms && alt.synonyms.length > 0) {
      parts.push(`Synonyms: ${alt.synonyms.join(", ")}`);
    }
  }

  if (manga.start_date || manga.end_date) {
    parts.push(`Published: ${manga.start_date ?? "?"} → ${manga.end_date ?? "?"}`);
  }

  if (manga.authors && manga.authors.length > 0) {
    parts.push(
      `Authors: ${manga.authors.map((a) => `${a.node.first_name} ${a.node.last_name} (${a.role})`).join(", ")}`
    );
  }
  if (manga.genres && manga.genres.length > 0) {
    parts.push(`Genres: ${formatGenres(manga.genres)}`);
  }
  if (manga.serialization && manga.serialization.length > 0) {
    parts.push(`Serialization: ${manga.serialization.map((s) => s.node.name).join(", ")}`);
  }

  if (manga.synopsis) {
    parts.push("", "Synopsis:", manga.synopsis);
  }

  if (manga.background) {
    parts.push("", "Background:", manga.background);
  }

  if (manga.related_manga && manga.related_manga.length > 0) {
    parts.push(
      "",
      "Related Manga:",
      ...manga.related_manga.map(
        (r) => `  ${r.relation_type_formatted}: ${r.node.title}`
      ),
    );
  }

  if (manga.recommendations && manga.recommendations.length > 0) {
    const top = manga.recommendations.slice(0, 5);
    parts.push(
      "",
      "Recommendations:",
      ...top.map(
        (r) => `  ${r.node.title} (${r.num_recommendations} recs)`
      ),
    );
  }

  return parts.join("\n");
}

// ─── Filter Metadata ───

export function formatFilterMeta(meta: FilterMeta): string {
  const filterStr = meta.activeFilters.join(", ");
  const pages = meta.pagesScanned > 1 ? `${meta.pagesScanned} pages` : "1 page";
  const showing = `Showing ${meta.totalMatched} results (filtered from ${meta.totalScanned} scanned, ${pages})`;
  const more = meta.hasMorePages
    ? " | More results may exist beyond scanned pages."
    : "";
  return `${showing} | Filters: ${filterStr}${more}`;
}
