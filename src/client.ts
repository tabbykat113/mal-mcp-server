import type {
  MalListResponse,
  MalAnimeNode,
  MalAnimeListItem,
  MalAnimeRankingItem,
  MalMangaNode,
  MalMangaListItem,
  MalMangaRankingItem,
} from "./types.js";

const MAL_API_BASE = "https://api.myanimelist.net/v2";

// ─── Fields ───

const ANIME_LIST_FIELDS = [
  "id", "title", "main_picture", "alternative_titles",
  "start_date", "end_date", "synopsis", "mean", "rank",
  "popularity", "num_list_users", "media_type", "status",
  "genres", "num_episodes", "start_season", "source",
  "average_episode_duration", "rating", "studios",
].join(",");

const ANIME_DETAIL_FIELDS = [
  "id", "title", "main_picture", "alternative_titles",
  "start_date", "end_date", "synopsis", "mean", "rank",
  "popularity", "num_list_users", "num_scoring_users",
  "nsfw", "media_type", "status", "genres", "num_episodes",
  "start_season", "broadcast", "source",
  "average_episode_duration", "rating", "pictures",
  "background", "related_anime", "related_manga",
  "recommendations", "studios", "statistics",
].join(",");

const MANGA_LIST_FIELDS = [
  "id", "title", "main_picture", "alternative_titles",
  "start_date", "end_date", "synopsis", "mean", "rank",
  "popularity", "num_list_users", "media_type", "status",
  "genres", "num_volumes", "num_chapters", "authors{first_name,last_name}",
].join(",");

const MANGA_DETAIL_FIELDS = [
  "id", "title", "main_picture", "alternative_titles",
  "start_date", "end_date", "synopsis", "mean", "rank",
  "popularity", "num_list_users", "num_scoring_users",
  "nsfw", "media_type", "status", "genres", "num_volumes",
  "num_chapters", "authors{first_name,last_name}", "pictures",
  "background", "related_anime", "related_manga",
  "recommendations", "serialization{name}",
].join(",");

// ─── Client ───

export class MalApiClient {
  private clientId: string;

  constructor(clientId: string) {
    this.clientId = clientId;
  }

  private async request<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${MAL_API_BASE}${path}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, value);
      }
    }

    const response = await fetch(url.toString(), {
      headers: {
        "X-MAL-CLIENT-ID": this.clientId,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `MAL API error ${response.status} ${response.statusText}: ${body}`
      );
    }

    return response.json() as Promise<T>;
  }

  // ─── Anime Endpoints ───

  async searchAnime(
    query: string,
    limit: number = 10,
    offset: number = 0,
    nsfw: boolean = false,
  ): Promise<MalListResponse<MalAnimeListItem>> {
    return this.request<MalListResponse<MalAnimeListItem>>("/anime", {
      q: query,
      limit: String(limit),
      offset: String(offset),
      fields: ANIME_LIST_FIELDS,
      nsfw: String(nsfw),
    });
  }

  async getAnimeDetails(animeId: number): Promise<MalAnimeNode> {
    return this.request<MalAnimeNode>(`/anime/${animeId}`, {
      fields: ANIME_DETAIL_FIELDS,
    });
  }

  async getAnimeRanking(
    rankingType: string = "all",
    limit: number = 10,
    offset: number = 0,
  ): Promise<MalListResponse<MalAnimeRankingItem>> {
    return this.request<MalListResponse<MalAnimeRankingItem>>("/anime/ranking", {
      ranking_type: rankingType,
      limit: String(limit),
      offset: String(offset),
      fields: ANIME_LIST_FIELDS,
    });
  }

  async getSeasonalAnime(
    year: number,
    season: string,
    sort: string = "",
    limit: number = 10,
    offset: number = 0,
  ): Promise<MalListResponse<MalAnimeListItem>> {
    return this.request<MalListResponse<MalAnimeListItem>>(
      `/anime/season/${year}/${season}`,
      {
        sort,
        limit: String(limit),
        offset: String(offset),
        fields: ANIME_LIST_FIELDS,
      },
    );
  }

  // ─── Manga Endpoints ───

  async searchManga(
    query: string,
    limit: number = 10,
    offset: number = 0,
    nsfw: boolean = false,
  ): Promise<MalListResponse<MalMangaListItem>> {
    return this.request<MalListResponse<MalMangaListItem>>("/manga", {
      q: query,
      limit: String(limit),
      offset: String(offset),
      fields: MANGA_LIST_FIELDS,
      nsfw: String(nsfw),
    });
  }

  async getMangaDetails(mangaId: number): Promise<MalMangaNode> {
    return this.request<MalMangaNode>(`/manga/${mangaId}`, {
      fields: MANGA_DETAIL_FIELDS,
    });
  }

  async getMangaRanking(
    rankingType: string = "all",
    limit: number = 10,
    offset: number = 0,
  ): Promise<MalListResponse<MalMangaRankingItem>> {
    return this.request<MalListResponse<MalMangaRankingItem>>("/manga/ranking", {
      ranking_type: rankingType,
      limit: String(limit),
      offset: String(offset),
      fields: MANGA_LIST_FIELDS,
    });
  }
}
