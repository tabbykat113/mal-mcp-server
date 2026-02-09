// ─── MAL API Response Types ───

export interface MalPaging {
  previous?: string;
  next?: string;
}

export interface MalListResponse<T> {
  data: T[];
  paging: MalPaging;
}

// ─── Anime Types ───

export interface MalAnimePicture {
  medium?: string;
  large?: string;
}

export interface MalAnimeGenre {
  id: number;
  name: string;
}

export interface MalAnimeSeason {
  year: number;
  season: string;
}

export interface MalAnimeBroadcast {
  day_of_the_week?: string;
  start_time?: string;
}

export interface MalAnimeStudio {
  id: number;
  name: string;
}

export interface MalRelatedEntry {
  node: MalAnimeNode;
  relation_type: string;
  relation_type_formatted: string;
}

export interface MalRecommendation {
  node: MalAnimeNode;
  num_recommendations: number;
}

export interface MalAnimeStatistics {
  status: {
    watching: string;
    completed: string;
    on_hold: string;
    dropped: string;
    plan_to_watch: string;
  };
  num_list_users: number;
}

export interface MalAnimeNode {
  id: number;
  title: string;
  main_picture?: MalAnimePicture;
  alternative_titles?: {
    synonyms?: string[];
    en?: string;
    ja?: string;
  };
  start_date?: string;
  end_date?: string;
  synopsis?: string;
  mean?: number;
  rank?: number;
  popularity?: number;
  num_list_users?: number;
  num_scoring_users?: number;
  nsfw?: string;
  created_at?: string;
  updated_at?: string;
  media_type?: string;
  status?: string;
  genres?: MalAnimeGenre[];
  num_episodes?: number;
  start_season?: MalAnimeSeason;
  broadcast?: MalAnimeBroadcast;
  source?: string;
  average_episode_duration?: number;
  rating?: string;
  pictures?: MalAnimePicture[];
  background?: string;
  related_anime?: MalRelatedEntry[];
  related_manga?: MalRelatedEntry[];
  recommendations?: MalRecommendation[];
  studios?: MalAnimeStudio[];
  statistics?: MalAnimeStatistics;
}

export interface MalAnimeListItem {
  node: MalAnimeNode;
}

export interface MalAnimeRankingItem {
  node: MalAnimeNode;
  ranking: {
    rank: number;
  };
}

// ─── Manga Types ───

export interface MalMangaAuthor {
  node: {
    id: number;
    first_name: string;
    last_name: string;
  };
  role: string;
}

export interface MalMangaSerialization {
  node: {
    id: number;
    name: string;
  };
}

export interface MalMangaNode {
  id: number;
  title: string;
  main_picture?: MalAnimePicture;
  alternative_titles?: {
    synonyms?: string[];
    en?: string;
    ja?: string;
  };
  start_date?: string;
  end_date?: string;
  synopsis?: string;
  mean?: number;
  rank?: number;
  popularity?: number;
  num_list_users?: number;
  num_scoring_users?: number;
  nsfw?: string;
  created_at?: string;
  updated_at?: string;
  media_type?: string;
  status?: string;
  genres?: MalAnimeGenre[];
  num_volumes?: number;
  num_chapters?: number;
  authors?: MalMangaAuthor[];
  pictures?: MalAnimePicture[];
  background?: string;
  related_anime?: MalRelatedEntry[];
  related_manga?: MalRelatedEntry[];
  recommendations?: MalRecommendation[];
  serialization?: MalMangaSerialization[];
}

export interface MalMangaListItem {
  node: MalMangaNode;
}

export interface MalMangaRankingItem {
  node: MalMangaNode;
  ranking: {
    rank: number;
  };
}
