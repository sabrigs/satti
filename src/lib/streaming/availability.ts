// Disponibilidade de títulos por streaming, usando os "watch providers" da TMDB.
// Os dados vêm do JustWatch, que é a fonte de disponibilidade da TMDB.
import { tmdbFetch, type MediaType } from '../tmdb/client';
import { groupByBrand } from './canonical';

export interface StreamingProvider {
  id: number;
  name: string;
  logoPath: string | null;
  displayPriority: number;
}

interface RawProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
  display_priority: number;
}

interface ProvidersResponse {
  results: RawProvider[];
}

interface TitleProvidersResponse {
  results: Record<string, { flatrate?: RawProvider[] } | undefined>;
}

const toProvider = (raw: RawProvider): StreamingProvider => ({
  id: raw.provider_id,
  name: raw.provider_name,
  logoPath: raw.logo_path,
  displayPriority: raw.display_priority,
});

// Escopo do onboarding e do menu "My streamings": os streamings mais usados no Brasil.
export async function getTopBrazilProviders(
  mediaType: MediaType = 'movie',
  limit = 5,
): Promise<StreamingProvider[]> {
  const data = await tmdbFetch<ProvidersResponse>(`/watch/providers/${mediaType}`, {
    watch_region: 'BR',
  });

  return groupByBrand(data.results.map(toProvider)).slice(0, limit);
}

// Detalhes → "Available on" e filtro das listas: streamings com assinatura no Brasil.
export async function getTitleStreamingProviders(
  mediaType: MediaType,
  id: number,
): Promise<StreamingProvider[]> {
  const data = await tmdbFetch<TitleProvidersResponse>(`/${mediaType}/${id}/watch/providers`);
  const brazil = data.results.BR?.flatrate ?? [];

  return groupByBrand(brazil.map(toProvider));
}
