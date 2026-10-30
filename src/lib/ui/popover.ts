// Dropdown compartilhado, em <dialog>.
// Desktop: modal e ancorado ao gatilho, bloqueia a interação com o conteúdo de trás.
// Mobile: bottom sheet não modal, então a tela embaixo continua interativa;
// tocar fora do sheet fecha ele.

const DESKTOP_QUERY = '(min-width: 768px)';

let removeOutsideListener: (() => void) | null = null;

export function openPopover(dialog: HTMLDialogElement, anchor: HTMLElement) {
  const isDesktop = window.matchMedia(DESKTOP_QUERY).matches;

  if (!isDesktop) {
    openSheet(dialog, anchor);
    return;
  }

  dialog.showModal();
  const rect = anchor.getBoundingClientRect();
  const left = rect.right - dialog.offsetWidth;
  dialog.style.top = `${rect.bottom + 8}px`;
  dialog.style.left = `${Math.max(8, Math.min(left, window.innerWidth - dialog.offsetWidth - 8))}px`;
}

function openSheet(dialog: HTMLDialogElement, anchor: HTMLElement) {
  removeOutsideListener?.();
  dialog.style.top = '';
  dialog.style.left = '';
  dialog.show();

  const onPointerDown = (event: PointerEvent) => {
    const target = event.target as Node;
    if (dialog.contains(target) || anchor.contains(target)) return;
    dialog.close();
  };

  document.addEventListener('pointerdown', onPointerDown, true);
  removeOutsideListener = () => document.removeEventListener('pointerdown', onPointerDown, true);
  dialog.addEventListener('close', () => removeOutsideListener?.(), { once: true });
}

// Fecha ao clicar fora da caixa do dropdown modal (o clique no backdrop cai no próprio <dialog>).
export function enableLightDismiss(dialog: HTMLDialogElement) {
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    const outside =
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom;
    if (outside) dialog.close();
  });
}
