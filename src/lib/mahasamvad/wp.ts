/**
 * Mahasamvad (mahasamvad.in) is WordPress; its REST API is public.
 * Adapted from ai-newssharing's importer — but the body is kept as sanitised
 * HTML with its inline photos, since a book lays them out.
 */
import { DISTRICTS, districtName, resolveDistrict } from '../districts'
import { decodeEntities, excerptOf, isPlaceholderImage, sanitizeArticleHtml } from '../sanitize'
import type { ArticleInput } from '../types'

const API = 'https://mahasamvad.in/wp-json/wp/v2'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

interface WpTerm {
  id: number
  name: string
  slug: string
  taxonomy: string
}

export interface WpPost {
  id: number
  date: string
  date_gmt?: string
  link: string
  title?: { rendered: string }
  content?: { rendered: string }
  excerpt?: { rendered: string }
  categories?: number[]
  _embedded?: {
    'wp:featuredmedia'?: Array<{
      source_url?: string
      caption?: { rendered?: string }
      media_details?: { sizes?: Record<string, { source_url?: string }> }
    }>
    'wp:term'?: WpTerm[][]
  }
}

export interface WpCategory {
  id: number
  name: string
  count: number
}

async function getJson<T>(url: string, attempts = 3): Promise<{ data: T; total: number }> {
  let last: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
        cache: 'no-store',
      })
      // Past the last page WordPress answers 400 rest_post_invalid_page_number.
      if (res.status === 400) return { data: [] as T, total: 0 }
      if (res.status === 404) throw Object.assign(new Error('महासंवादवर ही बातमी सापडली नाही'), { fatal: true })
      if (!res.ok) throw new Error(`Mahasamvad API: HTTP ${res.status}`)
      return { data: (await res.json()) as T, total: Number(res.headers.get('x-wp-total') ?? 0) }
    } catch (err) {
      last = err
      if ((err as { fatal?: boolean }).fatal) throw err
      if (attempt < attempts) await new Promise((r) => setTimeout(r, attempt * 1500))
    }
  }
  throw last
}

/** "https://mahasamvad.in/218916/" or a bare "218916" → 218916. */
export function wpIdFromUrl(input: string): number | null {
  const s = input.trim()
  if (/^\d+$/.test(s)) return Number(s)
  try {
    const u = new URL(s)
    if (!/(^|\.)mahasamvad\.in$/.test(u.hostname)) return null
    const p = u.searchParams.get('p')
    if (p && /^\d+$/.test(p)) return Number(p)
    const m = u.pathname.match(/\/(\d{3,})\/?$/)
    return m ? Number(m[1]) : null
  } catch {
    return null
  }
}

/** Posts whose URL is a slug rather than an id are looked up by slug. */
function wpSlugFromUrl(input: string): string | null {
  try {
    const u = new URL(input.trim())
    const seg = u.pathname.split('/').filter(Boolean).pop()
    return seg && !/^\d+$/.test(seg) ? decodeURIComponent(seg) : null
  } catch {
    return null
  }
}

export async function fetchPost(id: number): Promise<WpPost> {
  const { data } = await getJson<WpPost>(`${API}/posts/${id}?_embed=wp:featuredmedia,wp:term`)
  return data
}

export async function fetchPostByUrl(url: string): Promise<WpPost> {
  const id = wpIdFromUrl(url)
  if (id) return fetchPost(id)
  const slug = wpSlugFromUrl(url)
  if (!slug) throw new Error(`ओळखता न येणारी लिंक: ${url}`)
  const { data } = await getJson<WpPost[]>(`${API}/posts?slug=${encodeURIComponent(slug)}&_embed=wp:featuredmedia,wp:term`)
  if (!data.length) throw new Error(`महासंवादवर ही बातमी सापडली नाही: ${url}`)
  return data[0]
}

export interface BrowseResult {
  posts: Array<{ id: number; title: string; date: string; link: string; image: string | null; kicker: string | null; excerpt: string }>
  total: number
}

export async function browsePosts(opts: { search?: string; category?: number; page?: number; perPage?: number }): Promise<BrowseResult> {
  const qs = new URLSearchParams({
    per_page: String(opts.perPage ?? 20),
    page: String(opts.page ?? 1),
    _embed: 'wp:featuredmedia,wp:term',
  })
  if (opts.search) qs.set('search', opts.search)
  if (opts.category) qs.set('categories', String(opts.category))
  const { data, total } = await getJson<WpPost[]>(`${API}/posts?${qs}`)
  return {
    total,
    posts: data.map((p) => {
      const m = mapPost(p)
      return {
        id: p.id,
        title: m.title,
        date: m.publishedAt ?? p.date,
        link: p.link,
        image: m.heroImage ?? null,
        kicker: m.kicker ?? null,
        excerpt: m.excerpt ?? '',
      }
    }),
  }
}

let categoryCache: { at: number; data: WpCategory[] } | null = null

export async function listCategories(): Promise<WpCategory[]> {
  if (categoryCache && Date.now() - categoryCache.at < 3_600_000) return categoryCache.data
  const { data } = await getJson<WpCategory[]>(`${API}/categories?per_page=100&orderby=count&order=desc&_fields=id,name,count`)
  const cats = data.map((c) => ({ ...c, name: decodeEntities(c.name) })).filter((c) => c.count > 0)
  categoryCache = { at: Date.now(), data: cats }
  return cats
}

/** Category names that say nothing about the story. */
const GENERIC = /^(uncategorized|बातम्या|ताज्या बातम्या|मुख्य बातम्या|slider|featured)$/i

/** A WordPress post as an article row. */
export function mapPost(post: WpPost): ArticleInput & { sourceUrl: string } {
  const title = decodeEntities(post.title?.rendered ?? '').trim()
  const raw = post.content?.rendered ?? post.excerpt?.rendered ?? ''
  const contentHtml = sanitizeArticleHtml(raw)

  /* `date` is India time with no offset; `date_gmt` is the same instant in UTC. */
  const publishedAt = post.date_gmt
    ? new Date(`${post.date_gmt}Z`).toISOString()
    : post.date
      ? new Date(`${post.date}+05:30`).toISOString()
      : null

  const fm = post._embedded?.['wp:featuredmedia']?.[0]
  const featured =
    fm?.source_url ?? fm?.media_details?.sizes?.large?.source_url ?? fm?.media_details?.sizes?.full?.source_url ?? null
  const hero = isPlaceholderImage(featured) ? null : featured
  const heroCredit = fm?.caption?.rendered ? decodeEntities(fm.caption.rendered.replace(/<[^>]+>/g, '')).trim() || null : null

  const terms = (post._embedded?.['wp:term'] ?? []).flat()
  const cats = terms.filter((t) => t.taxonomy === 'category').map((t) => ({ ...t, name: decodeEntities(t.name) }))

  let district: string | null = null
  for (const t of terms) {
    district = resolveDistrict(t.name) || resolveDistrict(t.slug)
    if (district) break
  }
  if (!district) {
    const d = DISTRICTS.find((d) => title.includes(d.mr) || d.aliases.some((a) => a.length >= 3 && title.includes(a)))
    district = d?.key ?? null
  }

  // The kicker is the most specific category that isn't the place or a catch-all.
  const kicker =
    cats.find((c) => !GENERIC.test(c.name) && !resolveDistrict(c.name) && !resolveDistrict(c.slug))?.name ??
    (district ? districtName(district) : null)

  const datelineMatch = contentHtml.match(/<strong class="dateline">([^<]+)<\/strong>/)

  return {
    sourceUrl: post.link,
    wpId: post.id,
    title,
    kicker,
    dateline: datelineMatch ? datelineMatch[1].replace(/\s*:\s*$/, '').trim() : null,
    district,
    publishedAt,
    heroImage: hero ? hero.replace(/^http:\/\//, 'https://') : null,
    heroCredit,
    contentHtml,
    excerpt: excerptOf(contentHtml),
  }
}
