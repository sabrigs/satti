// Dropdown compartilhado: usa <dialog> modal, então bloqueia a interação com o conteúdo de trás.
// No desktop abre ancorado ao gatilho; no mobile o CSS transforma em bottom sheet.

const DESKTOP_QUERY = '(min-width: 768px)';

export function openPopover(dialog: HTMLDialogElement, anchor: HTMLElement) {
  dialog.showModal();

  if (window.matchMedia(DESKTOP_QUERY).matches) {
    const rect = anchor.getBoundingClientRect();
    const left = rect.right - dialog.offsetWidth;
    dialog.style.top = `${rect.bottom + 8}px`;
    dialog.style.left = `${Math.max(8, Math.min(left, window.innerWidth - dialog.offsetWidth - 8))}px`;
  } else {
    dialog.style.top = '';
    dialog.style.left = '';
  }
}

// Fecha ao clicar fora da caixa do dropdown (o clique no backdrop cai no próprio <dialog>).
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
