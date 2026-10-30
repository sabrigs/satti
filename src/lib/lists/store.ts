// Acesso às listas do usuário no Supabase (RLS garante que só o dono lê e altera).
// As regras entre listas também são validadas no banco pelo trigger `list_items_enforce_rules`.
import { supabase } from '../supabase.js';

export type SystemKind = 'to_watch' | 'watched' | 'favorites';
export type MediaType = 'movie' | 'tv';

export interface TitleRef {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  posterPath: string | null;
}

export interface ListSummary {
  kind: SystemKind;
  count: number;
  recent: { title: string; posterPath: string | null }[];
}

export interface StreamingRow {
  providerId: number;
  providerName: string;
  logoPath: string | null;
}

export const LISTS_CHANGED_EVENT = 'aurora:lists-changed';

// Cache em memória das listas. Vale durante a sessão da aba (a navegação não recarrega o JS),
// e é descartado sempre que uma lista muda.
const CACHE_TTL_MS = 5 * 60 * 1000;
let summaryCache: { value: Promise<ListSummary[]>; expires: number } | null = null;
const itemsCache = new Map<SystemKind, { value: Promise<ListItem[]>; expires: number }>();

const invalidateListCache = () => {
  summaryCache = null;
  itemsCache.clear();
};

const notifyListsChanged = () => {
  invalidateListCache();
  window.dispatchEvent(new Event(LISTS_CHANGED_EVENT));
};

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) {
    throw new Error('not_authenticated');
  }
  return userId;
}

async function listIdFor(kind: SystemKind): Promise<string> {
  const { data, error } = await supabase.from('lists').select('id').eq('kind', kind).single();
  if (error) throw error;
  return data.id;
}

async function insertItem(kind: SystemKind, ref: TitleRef) {
  const userId = await currentUserId();
  const listId = await listIdFor(kind);
  const { error } = await supabase.from('list_items').insert({
    user_id: userId,
    list_id: listId,
    tmdb_id: ref.tmdbId,
    media_type: ref.mediaType,
    title: ref.title,
    poster_path: ref.posterPath,
  });
  if (error) throw error;
}

async function deleteItem(kind: SystemKind, ref: TitleRef) {
  const listId = await listIdFor(kind);
  const { error } = await supabase
    .from('list_items')
    .delete()
    .eq('list_id', listId)
    .eq('tmdb_id', ref.tmdbId)
    .eq('media_type', ref.mediaType);
  if (error) throw error;
}

// Listas em que o título está (to_watch, watched, favorites).
// As consultas feitas no mesmo ciclo (ex.: todos os cards de uma página) viram uma só.
type StatusRequest = {
  ref: Pick<TitleRef, 'tmdbId' | 'mediaType'>;
  resolve: (status: Set<SystemKind>) => void;
  reject: (error: unknown) => void;
};

let pendingStatus: StatusRequest[] = [];
let statusFlushScheduled = false;

const statusKey = (ref: Pick<TitleRef, 'tmdbId' | 'mediaType'>) => `${ref.mediaType}:${ref.tmdbId}`;

async function flushStatusRequests() {
  const batch = pendingStatus;
  pendingStatus = [];
  statusFlushScheduled = false;

  const ids = [...new Set(batch.map((request) => request.ref.tmdbId))];
  const { data, error } = await supabase
    .from('list_items')
    .select('tmdb_id, media_type, lists(kind)')
    .in('tmdb_id', ids);

  if (error) {
    batch.forEach((request) => request.reject(error));
    return;
  }

  const kindsByTitle = new Map<string, Set<SystemKind>>();
  const rows = (data ?? []) as unknown as {
    tmdb_id: number;
    media_type: MediaType;
    lists: { kind: SystemKind } | null;
  }[];
  for (const row of rows) {
    const key = `${row.media_type}:${row.tmdb_id}`;
    const kinds = kindsByTitle.get(key) ?? new Set<SystemKind>();
    if (row.lists?.kind) kinds.add(row.lists.kind);
    kindsByTitle.set(key, kinds);
  }

  for (const request of batch) {
    request.resolve(new Set(kindsByTitle.get(statusKey(request.ref)) ?? []));
  }
}

export function getTitleStatus(ref: Pick<TitleRef, 'tmdbId' | 'mediaType'>): Promise<Set<SystemKind>> {
  return new Promise((resolve, reject) => {
    pendingStatus.push({ ref, resolve, reject });
    if (!statusFlushScheduled) {
      statusFlushScheduled = true;
      // Espera o restante do ciclo síncrono (criação dos cards) antes de consultar.
      queueMicrotask(() => void flushStatusRequests());
    }
  });
}

// Ações do dropdown de "Add/status". Cada uma respeita as regras de exclusividade.
export const addToWatch = async (ref: TitleRef) => {
  await insertItem('to_watch', ref);
  notifyListsChanged();
};

export const removeFromToWatch = async (ref: TitleRef) => {
  await deleteItem('to_watch', ref);
  notifyListsChanged();
};

// "Mark as watched": troca de "To watch" para "Watched" (delete antes do insert,
// porque o banco não aceita o mesmo título nas duas listas ao mesmo tempo).
export const markWatched = async (ref: TitleRef) => {
  await deleteItem('to_watch', ref);
  await insertItem('watched', ref);
  notifyListsChanged();
};

export const removeFromWatched = async (ref: TitleRef) => {
  await deleteItem('watched', ref);
  notifyListsChanged();
};

// "Mark as favorite": favorito exige "Watched". Se o título ainda estiver em "To watch",
// ele passa para "Watched" antes de entrar em "Favorites".
export const markFavorite = async (ref: TitleRef, status: Set<SystemKind>) => {
  if (!status.has('watched')) {
    await markWatched(ref);
  }
  await insertItem('favorites', ref);
  notifyListsChanged();
};

export const removeFromFavorites = async (ref: TitleRef) => {
  await deleteItem('favorites', ref);
  notifyListsChanged();
};

// Resumo para a Home: contador e últimos 3 títulos adicionados de cada lista de sistema.
export function getListSummaries(): Promise<ListSummary[]> {
  if (summaryCache && summaryCache.expires > Date.now()) {
    return summaryCache.value;
  }

  const value = fetchListSummaries();
  summaryCache = { value, expires: Date.now() + CACHE_TTL_MS };
  // Falha não fica em cache: a próxima visita tenta de novo.
  value.catch(() => {
    summaryCache = null;
  });
  return value;
}

async function fetchListSummaries(): Promise<ListSummary[]> {
  const { data, error } = await supabase
    .from('lists')
    .select('id, kind, list_items(count)')
    .neq('kind', 'custom');
  if (error) throw error;

  const order: SystemKind[] = ['to_watch', 'favorites', 'watched'];
  const lists = (data ?? []) as { id: string; kind: SystemKind; list_items: { count: number }[] }[];

  return Promise.all(
    order.map(async (kind) => {
      const list = lists.find((item) => item.kind === kind);
      if (!list) {
        return { kind, count: 0, recent: [] };
      }

      const { data: recent, error: recentError } = await supabase
        .from('list_items')
        .select('title, poster_path')
        .eq('list_id', list.id)
        .order('added_at', { ascending: false })
        .limit(3);
      if (recentError) throw recentError;

      return {
        kind,
        count: list.list_items?.[0]?.count ?? 0,
        recent: (recent ?? []).map((row: { title: string; poster_path: string | null }) => ({
          title: row.title,
          posterPath: row.poster_path,
        })),
      };
    }),
  );
}

// Streamings do usuário (tabela user_streamings).
export async function getUserStreamings(): Promise<StreamingRow[]> {
  const { data, error } = await supabase
    .from('user_streamings')
    .select('provider_id, provider_name, logo_path')
    .order('created_at', { ascending: true });
  if (error) throw error;

  return (data ?? []).map((row: { provider_id: number; provider_name: string; logo_path: string | null }) => ({
    providerId: row.provider_id,
    providerName: row.provider_name,
    logoPath: row.logo_path,
  }));
}

export async function addStreaming(provider: { id: number; name: string; logoPath: string | null }) {
  const userId = await currentUserId();
  const { error } = await supabase.from('user_streamings').insert({
    user_id: userId,
    provider_id: provider.id,
    provider_name: provider.name,
    logo_path: provider.logoPath,
  });
  if (error) throw error;
}

export async function removeStreaming(providerId: number) {
  const { error } = await supabase.from('user_streamings').delete().eq('provider_id', providerId);
  if (error) throw error;
}

export interface ListItem {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  posterPath: string | null;
  addedAt: string;
}

// Itens de uma lista de sistema, do mais recente para o mais antigo.
export function getListItems(kind: SystemKind): Promise<ListItem[]> {
  const cached = itemsCache.get(kind);
  if (cached && cached.expires > Date.now()) {
    return cached.value;
  }

  const value = fetchListItems(kind);
  itemsCache.set(kind, { value, expires: Date.now() + CACHE_TTL_MS });
  value.catch(() => itemsCache.delete(kind));
  return value;
}

async function fetchListItems(kind: SystemKind): Promise<ListItem[]> {
  const listId = await listIdFor(kind);
  const { data, error } = await supabase
    .from('list_items')
    .select('tmdb_id, media_type, title, poster_path, added_at')
    .eq('list_id', listId)
    .order('added_at', { ascending: false });
  if (error) throw error;

  return (data ?? []).map(
    (row: { tmdb_id: number; media_type: MediaType; title: string; poster_path: string | null; added_at: string }) => ({
      tmdbId: row.tmdb_id,
      mediaType: row.media_type,
      title: row.title,
      posterPath: row.poster_path,
      addedAt: row.added_at,
    }),
  );
}
