// Navegação de volta: restaura o estado da tela anterior quando o usuário volta pelo histórico.

// True quando a página foi aberta pelo botão voltar/avançar do navegador.
export function isBackNavigation(): boolean {
  const [entry] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
  return entry?.type === 'back_forward';
}

// Estado guardado por tela (aba, filtros, itens já carregados) entre navegações.
export function saveScreenState<T>(key: string, value: T) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Armazenamento indisponível (modo privado, bloqueio): a tela só não é restaurada.
  }
}

export function loadScreenState<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

// Botão "Back" de um título: volta no histórico quando a página anterior é do próprio app.
export function bindBackLink(link: HTMLAnchorElement) {
  link.addEventListener('click', (event) => {
    const cameFromApp = document.referrer !== '' && new URL(document.referrer).origin === window.location.origin;
    if (cameFromApp && history.length > 1) {
      event.preventDefault();
      history.back();
    }
  });
}
