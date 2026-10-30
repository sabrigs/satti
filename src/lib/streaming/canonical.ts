// Marca principal de cada streaming. A TMDB lista também variações e canais de parceiros
// (ex.: "Netflix Standard with Ads", "Amazon Channel"). Aqui essas variações viram a marca
// que o usuário abre de fato. Para ajustar, edite as regras abaixo.
const BRAND_RULES: { pattern: RegExp; brand: string }[] = [
  { pattern: /^netflix\b/i, brand: 'Netflix' },
  { pattern: /^(hbo max|max)\b/i, brand: 'HBO Max' },
  { pattern: /^(amazon prime video|prime video|amazon channel)\b/i, brand: 'Prime Video' },
  { pattern: /^disney( plus|\+)?\b/i, brand: 'Disney+' },
  { pattern: /^crunchyroll\b/i, brand: 'Crunchyroll' },
  { pattern: /^apple tv\b/i, brand: 'Apple TV' },
  { pattern: /^paramount( ?\+|\s+plus)?\b/i, brand: 'Paramount+' },
  { pattern: /^globoplay\b/i, brand: 'Globoplay' },
  { pattern: /^plex\b/i, brand: 'Plex' },
];

// Nome da marca principal. Sem regra específica, remove sufixos de plano e "Channel".
export function brandName(providerName: string): string {
  const trimmed = providerName.trim();
  const rule = BRAND_RULES.find((item) => item.pattern.test(trimmed));
  if (rule) return rule.brand;

  return trimmed
    .replace(/\s+(standard|basic|premium)?\s*with ads$/i, '')
    .replace(/\s+channel$/i, '')
    .trim();
}

export interface BrandedProvider {
  id: number;
  name: string;
  logoPath: string | null;
  displayPriority: number;
}

// Agrupa providers pela marca, mantendo um por marca: o que tem o nome da própria marca,
// ou, se não houver, o de maior prioridade.
export function groupByBrand<T extends BrandedProvider>(providers: T[]): T[] {
  const groups = new Map<string, T>();

  for (const provider of providers) {
    const brand = brandName(provider.name);
    const current = groups.get(brand);
    const isOwnName = provider.name.trim().toLowerCase() === brand.toLowerCase();
    const currentIsOwnName = current !== undefined && current.name.trim().toLowerCase() === brand.toLowerCase();

    if (!current || (isOwnName && !currentIsOwnName) || (isOwnName === currentIsOwnName && provider.displayPriority < current.displayPriority)) {
      groups.set(brand, { ...provider, name: brand });
    }
  }

  return [...groups.values()].sort((a, b) => a.displayPriority - b.displayPriority);
}
