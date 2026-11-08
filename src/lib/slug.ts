/**
 * Book slugs end up in shared links, so they stay ASCII. A Marathi title has
 * no Latin letters to keep, so it falls back to the kind and edition date.
 */
export function slugify(title: string, fallback: { kind?: string; date?: string | null } = {}): string {
  const latin = title
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (latin.length >= 3) return latin.slice(0, 60)
  const date = (fallback.date ?? new Date().toISOString().slice(0, 10)).replace(/-/g, '')
  return `${fallback.kind ?? 'book'}-${date}`
}
