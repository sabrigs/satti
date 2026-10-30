import {
  slate,
  slateDark,
  green,
  greenDark,
  grass,
  grassDark,
  teal,
  tealDark,
  jade,
  jadeDark,
  mint,
  mintDark,
  red,
  redDark,
  blue,
  blueDark,
  violet,
  violetDark,
  amber,
  amberDark,
} from '@radix-ui/colors';

// Tokens semânticos da Aurora, construídos sobre as escalas do Radix Colors.
// Os passos seguem as regras de acessibilidade do Radix:
//   1–2  fundos · 3–5 superfícies e estados · 6–8 bordas e foco
//   9    cor sólida · 11 texto de baixo contraste · 12 texto principal

export type Theme = 'dark' | 'light';
export type Palette = Record<string, string>;

// Escalas de cor de destaque selecionáveis (estados positivos, ex.: "assistido").
export const successPalettes = {
  green: { dark: greenDark, light: green },
  grass: { dark: grassDark, light: grass },
  teal: { dark: tealDark, light: teal },
  jade: { dark: jadeDark, light: jade },
  mint: { dark: mintDark, light: mint },
} as const;

export type SuccessPaletteName = keyof typeof successPalettes;

// Escalas auxiliares (não selecionáveis no catálogo por enquanto).
const neutral = { dark: slateDark, light: slate };
const danger = { dark: redDark, light: red };
const info = { dark: blueDark, light: blue };
const accent = { dark: violetDark, light: violet };
const warning = { dark: amberDark, light: amber };

// Tokens de destaque de estado positivo, derivados de uma escala à escolha.
export const successTokens = (
  theme: Theme,
  success: SuccessPaletteName,
): Record<string, string> => {
  const s: Palette = successPalettes[success][theme];

  return {
    '--color-success-bg': s[`${success}3`] ?? '',
    '--color-success-border': s[`${success}6`] ?? '',
    '--color-success-solid': s[`${success}9`] ?? '',
    '--color-success-text': s[`${success}11`] ?? '',
  };
};

export const semanticTokens = (
  theme: Theme,
  success: SuccessPaletteName,
): Record<string, string> => {
  const n: Palette = neutral[theme];
  const d: Palette = danger[theme];
  const i: Palette = info[theme];
  const a: Palette = accent[theme];
  const w: Palette = warning[theme];

  return {
    // Superfícies
    '--color-bg': n.slate1,
    '--color-surface': n.slate2,
    '--color-surface-raised': n.slate3,
    '--color-surface-hover': n.slate4,
    '--color-border': n.slate6,
    '--color-border-strong': n.slate7,
    '--color-focus': n.slate8,

    // Texto
    '--color-text': n.slate12,
    '--color-text-muted': n.slate11,

    // Ação primária: branco sobre fundo escuro (no tema dark)
    '--color-solid': n.slate12,
    '--color-solid-hover': n.slate11,
    '--color-on-solid': n.slate1,

    // Destaque (estados positivos, ex.: badge "adicionado" / "assistido")
    ...successTokens(theme, success),

    // Erro (ex.: mensagem abaixo do campo de e-mail)
    '--color-danger-bg': d.red3,
    '--color-danger-border': d.red6,
    '--color-danger-text': d.red11,

    // Informação, aviso e acento (reservados para uso futuro)
    '--color-info-text': i.blue11,
    '--color-warning-text': w.amber11,
    '--color-accent-solid': a.violet9,
    '--color-accent-text': a.violet11,
  };
};

const toCss = (selector: string, tokens: Record<string, string>) =>
  `${selector} {\n${Object.entries(tokens)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n')}\n}`;

// Fontes: Source Serif 4 para títulos e Inter para o corpo (Google Fonts, carregadas no Layout).
const fontTokens = {
  '--font-serif': "'Source Serif 4', Georgia, serif",
  '--font-sans': "'Inter', system-ui, -apple-system, sans-serif",
};

// CSS completo dos tokens: dark por padrão, light via [data-theme="light"].
export const themeCss = (success: SuccessPaletteName = 'green') =>
  [
    toCss(':root', { ...fontTokens, ...semanticTokens('dark', success) }),
    toCss(':root[data-theme="light"]', semanticTokens('light', success)),
  ].join('\n\n');
