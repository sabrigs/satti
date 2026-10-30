// Lógica do botão Add/status: "+ Add" vira badge verde com dropdown conforme o estado do título.
// Usado pelo componente AddStatusButton e pelos cards criados dinamicamente (Explore).
import {
  addToWatch,
  getTitleStatus,
  markFavorite,
  markWatched,
  removeFromFavorites,
  removeFromToWatch,
  removeFromWatched,
  type SystemKind,
  type TitleRef,
} from './store';
import { enableLightDismiss, openPopover } from '../ui/popover';

type Action = (ref: TitleRef, status: Set<SystemKind>) => Promise<void>;

const ACTIONS: Record<string, { label: string; run: Action }> = {
  'remove-to-watch': { label: 'Remove from to watch', run: (ref) => removeFromToWatch(ref) },
  'mark-watched': { label: 'Mark as watched', run: (ref) => markWatched(ref) },
  'mark-favorite': { label: 'Mark as favorite', run: (ref, status) => markFavorite(ref, status) },
  'remove-watched': { label: 'Remove from watched', run: (ref) => removeFromWatched(ref) },
  'remove-favorite': { label: 'Remove from favorites', run: (ref) => removeFromFavorites(ref) },
};

// Opções mudam conforme o estado atual do título.
const menuFor = (status: Set<SystemKind>): string[] => {
  const keys: string[] = [];
  if (status.has('to_watch')) {
    keys.push('remove-to-watch', 'mark-watched', 'mark-favorite');
  }
  if (status.has('watched')) {
    keys.push('remove-watched');
    keys.push(status.has('favorites') ? 'remove-favorite' : 'mark-favorite');
  }
  return keys;
};

const refFrom = (root: HTMLElement): TitleRef => ({
  tmdbId: Number(root.dataset.tmdbId),
  mediaType: root.dataset.mediaType as TitleRef['mediaType'],
  title: root.dataset.title ?? '',
  posterPath: root.dataset.posterPath || null,
});

export const initAddStatus = async (root: HTMLElement) => {
  const addButton = root.querySelector<HTMLButtonElement>('[data-add]')!;
  const badge = root.querySelector<HTMLButtonElement>('[data-badge]')!;
  const dialog = root.querySelector<HTMLDialogElement>('[data-menu]')!;
  const itemsBox = root.querySelector<HTMLElement>('[data-menu-items]')!;
  const ref = refFrom(root);

  // Rótulos de acessibilidade com o título real (os cards são criados dinamicamente).
  badge.setAttribute('aria-label', `${ref.title} is in your lists. Open options`);
  dialog.setAttribute('aria-label', `Options for ${ref.title}`);

  enableLightDismiss(dialog);

  const render = (status: Set<SystemKind>, justAdded = false) => {
    const added = status.size > 0;
    addButton.hidden = added;
    badge.hidden = !added;
    if (added && justAdded) {
      badge.classList.remove('is-entering');
      void badge.offsetWidth;
      badge.classList.add('is-entering');
    }

    itemsBox.replaceChildren(
      ...menuFor(status).map((key) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'menu-item';
        button.textContent = ACTIONS[key].label;
        button.addEventListener('click', () => runAction(key, status));
        return button;
      }),
    );
  };

  const refresh = async (justAdded = false) => {
    const status = await getTitleStatus(ref);
    render(status, justAdded);
    return status;
  };

  const runAction = async (key: string, status: Set<SystemKind>) => {
    const buttons = itemsBox.querySelectorAll<HTMLButtonElement>('button');
    buttons.forEach((button) => (button.disabled = true));
    try {
      await ACTIONS[key].run(ref, status);
      dialog.close();
    } catch (error) {
      console.error(error);
      buttons.forEach((button) => (button.disabled = false));
    }
    await refresh();
  };

  addButton.addEventListener('click', async () => {
    addButton.disabled = true;
    try {
      await addToWatch(ref);
      await refresh(true);
    } catch (error) {
      console.error(error);
    } finally {
      addButton.disabled = false;
    }
  });

  badge.addEventListener('click', () => openPopover(dialog, badge));

  try {
    await refresh();
  } catch (error) {
    // Sem sessão ou sem rede: o botão fica oculto em vez de mostrar um estado errado.
    console.error(error);
  }
};
