/**
 * Import recent Mahasamvad posts and build three sample books from them:
 * a daily edition, a district round-up with sections, and a farmers' special.
 *
 * Idempotent: posts are upserted by URL, books by slug (their chapter lists
 * are rebuilt).
 *
 *   npm run seed
 *   npm run seed -- --count 40
 */
import { loadEnvConfig } from '@next/env'
import * as db from '../src/lib/db'
import { districtName } from '../src/lib/districts'
import { browsePosts, fetchPost, mapPost } from '../src/lib/mahasamvad/wp'
import { todayIso } from '../src/lib/marathi'

// The pool reads DATABASE_URL lazily, on the first query.
loadEnvConfig(process.cwd())

async function main() {
  const countArg = process.argv.indexOf('--count')
  const count = countArg > -1 ? Number(process.argv[countArg + 1]) || 36 : 36

  await db.ensureSchema()

  async function importIds(ids: number[]) {
    const out: Awaited<ReturnType<typeof db.upsertArticleBySource>>[] = []
    for (const id of ids) {
      try {
        const post = await fetchPost(id)
        const a = await db.upsertArticleBySource(mapPost(post))
        out.push(a)
        process.stdout.write('.')
      } catch (err) {
        console.warn(`\n  skip ${id}: ${(err as Error).message}`)
      }
    }
    process.stdout.write('\n')
    return out
  }

  /** Long enough to be worth a chapter, and not a bare photo caption. */
  const substantial = (a: { contentHtml: string }) => a.contentHtml.replace(/<[^>]+>/g, '').length > 600

  console.log(`Fetching ${count} recent posts…`)
  const recentIds: number[] = []
  for (let page = 1; recentIds.length < count; page++) {
    const { posts } = await browsePosts({ page, perPage: Math.min(50, count) })
    if (!posts.length) break
    recentIds.push(...posts.map((p) => p.id))
  }
  const recent = (await importIds(recentIds.slice(0, count))).filter(substantial)
  console.log(`  ${recent.length} usable articles.`)

  console.log('Fetching farming stories…')
  const farmIds = (await browsePosts({ search: 'शेतकरी', perPage: 14 })).posts.map((p) => p.id)
  const farm = (await importIds(farmIds)).filter(substantial)
  console.log(`  ${farm.length} usable articles.`)

  async function upsertBook(
    slug: string,
    data: Omit<db.BookInput, 'slug'> & { title: string },
    chapters: { articleId: number; sectionLabel?: string | null }[],
  ) {
    const existing = await db.getBookBySlug(slug)
    const book = existing ? (await db.updateBook(existing.id, data))! : await db.createBook({ ...data, slug })
    await db.setChapters(book.id, chapters)
    console.log(`  /read/${slug} — ${chapters.length} chapters`)
  }

  const today = todayIso()
  console.log('Building books…')

  // 1. The daily edition: the newest stories with a photo first.
  const edition = [...recent].sort((a, b) => Number(!!b.heroImage) - Number(!!a.heroImage)).slice(0, 12)
  await upsertBook(
    `mahasamvad-${today.replace(/-/g, '')}`,
    {
      title: 'महासंवाद',
      subtitle: 'दैनिक आवृत्ती',
      kind: 'edition',
      editionDate: today,
      description: 'महाराष्ट्र शासनाच्या माहिती व जनसंपर्क महासंचालनालयाकडून दिवसभरातील महत्त्वाच्या घडामोडी — एकाच पुस्तकात.',
      accentColor: '#A8172C',
      status: 'published',
    },
    edition.map((a) => ({ articleId: a.id })),
  )

  // 2. District round-up, sectioned by district.
  const byDistrict = recent.filter((a) => a.district)
  byDistrict.sort((a, b) => districtName(a.district).localeCompare(districtName(b.district), 'mr'))
  await upsertBook(
    'jilhyantun',
    {
      title: 'जिल्ह्यांतून',
      subtitle: 'महाराष्ट्राच्या कानाकोपऱ्यातील घडामोडी',
      kind: 'themed',
      editionDate: today,
      description: 'राज्यातील विविध जिल्ह्यांमधील विकासकामे, योजना आणि लोकोपयोगी उपक्रमांचा जिल्हानिहाय आढावा.',
      accentColor: '#1F5C4A',
      status: 'published',
    },
    byDistrict.slice(0, 14).map((a) => ({ articleId: a.id, sectionLabel: districtName(a.district) })),
  )

  // 3. A special issue on farming.
  await upsertBook(
    'baliraja-visheshank',
    {
      title: 'बळीराजा',
      subtitle: 'शेतकरी विशेषांक',
      kind: 'special',
      editionDate: today,
      description: 'शेती, शेतकरी आणि ग्रामीण महाराष्ट्रासाठीच्या शासकीय योजना, निर्णय आणि यशोगाथा.',
      accentColor: '#9A5B13',
      status: 'published',
    },
    farm.slice(0, 10).map((a) => ({ articleId: a.id })),
  )

  await db.pool().end()
  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
