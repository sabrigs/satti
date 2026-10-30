// Exportação genérica dos dados do usuário em JSON: perfil, streamings e listas com seus títulos.
// Cada título traz o id e o tipo da TMDB API, para permitir importação em outras ferramentas.
import { supabase } from '../supabase.js';
import { getListItems, getListSummaries, getUserStreamings, type SystemKind } from './store';

const LIST_KINDS: { kind: SystemKind; name: string }[] = [
  { kind: 'to_watch', name: 'To watch' },
  { kind: 'watched', name: 'Watched' },
  { kind: 'favorites', name: 'Favorites' },
];

// Só há o que exportar se existir algum título em listas ou algum streaming salvo.
export async function hasExportableData(): Promise<boolean> {
  const [summaries, streamings] = await Promise.all([getListSummaries(), getUserStreamings()]);
  return streamings.length > 0 || summaries.some((summary) => summary.count > 0);
}

export async function buildExport() {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) throw new Error('not_authenticated');

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('display_name, created_at')
    .eq('user_id', session.user.id)
    .single();
  if (profileError) throw profileError;

  const [lists, streamings] = await Promise.all([
    Promise.all(
      LIST_KINDS.map(async ({ kind, name }) => {
        const items = await getListItems(kind);
        return {
          kind,
          name,
          items: items.map((item) => ({
            title: item.title,
            mediaType: item.mediaType,
            tmdbId: item.tmdbId,
            addedAt: item.addedAt,
          })),
        };
      }),
    ),
    getUserStreamings(),
  ]);

  return {
    format: 'aurora-export',
    version: 1,
    exportedAt: new Date().toISOString(),
    user: {
      displayName: profile.display_name,
      memberSince: profile.created_at,
    },
    streamings: streamings.map((row) => ({
      providerId: row.providerId,
      name: row.providerName,
    })),
    lists,
  };
}

export async function downloadExport() {
  const data = await buildExport();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `aurora-export-${date}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
