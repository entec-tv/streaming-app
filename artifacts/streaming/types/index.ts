export interface Channel {
  id: string;
  name: string;
  logo: string;
  category: string;
  categoryId?: string;
  streamUrl: string;
  current: string;
  next: string;
  quality: '4K' | 'FHD' | 'HD' | 'SD';
  isLive: boolean;
  type: 'live' | 'vod' | 'series';
  hasArchive?: boolean;
  archiveDuration?: number;
  num?: string | number;
  title?: string;
  poster?: string;
  backdrop?: string;
  description?: string;
}

export interface Playlist {
  id: string;
  name: string;
  url: string;
  channels: number;
  updated: string;
  lastUpdatedTimestamp: number;
  isDemo?: boolean;
}

export interface PlaylistCategories {
  live: { id: string; name: string; count?: number }[];
  vod: { id: string; name: string; count?: number }[];
  series: { id: string; name: string; count?: number }[];
}

export interface Movie {
  id: string;
  title: string;
  poster: string;
  backdrop: string;
  rating: number;
  year: number;
  duration: string;
  quality: '4K' | 'FHD' | 'HD' | 'SD';
  genres: string[];
  description: string;
  streamUrl: string;
}

export interface Series {
  id: string;
  title: string;
  poster: string;
  backdrop: string;
  rating: number;
  year: number;
  seasons: number;
  genres: string[];
  description: string;
  episodes: SeriesEpisode[];
}

export interface SeriesEpisode {
  id: string;
  season: number;
  number: number;
  title: string;
  duration: string;
  thumbnail: string;
  streamUrl: string;
}

export interface FeaturedHero {
  id: string;
  title: string;
  subtitle: string;
  backdrop: any;
  poster: any;
  description: string;
  rating: number;
  year: number;
  duration: string;
  genres: string[];
  streamUrl?: string;
  originalItem?: Channel;
}
