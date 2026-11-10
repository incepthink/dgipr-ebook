/**
 * Demo library: about 20 books built from real Mahasamvad news, so the site
 * looks full while DGIPR prepares its own books.
 *
 *   - daily editions: one per recent day, from that day's posts
 *   - जिल्ह्यांतून: the district round-up, sectioned by district
 *   - special issues and themed collections: one per topic (search on the site)
 *
 * Safe to re-run: articles are upserted by URL and books by slug.
 *
 * LOCAL ONLY by default. It refuses any database that is not on this machine
 * unless --allow-remote is passed, so it cannot fill the live database by
 * accident.
 *
 *   npm run seed:demo
 *   npm run seed:demo -- --target 20
 */
import { loadEnvConfig } from '@next/env'
import * as db from '../src/lib/db'
import { districtName } from '../src/lib/districts'
import { browseArticles } from '../src/lib/mahasamvad/wp'
import { todayIso } from '../src/lib/marathi'
import type { Article, BookKind } from '../src/lib/types'

loadEnvConfig(process.cwd())

const arg = (name: string) => {
  const i = process.argv.indexOf(name)
  return i > -1 ? process.argv[i + 1] : undefined
}
const TARGET = Number(arg('--target')) || 20
const MAX_EDITIONS = 6

interface Topic {
  slug: string
  search: string
  title: string
  subtitle: string
  kind: BookKind
  description: string
  accent: string
}

/** In order of preference; later ones fill in if a search turns up too little. */
const TOPICS: Topic[] = [
  { slug: 'baliraja-visheshank', search: 'शेतकरी', title: 'बळीराजा', subtitle: 'शेतकरी विशेषांक', kind: 'special', accent: '#9A5B13', description: 'शेती, शेतकरी आणि ग्रामीण महाराष्ट्रासाठीच्या शासकीय योजना, निर्णय आणि यशोगाथा.' },
  { slug: 'arogya-visheshank', search: 'आरोग्य', title: 'आरोग्यसंपदा', subtitle: 'आरोग्य विशेषांक', kind: 'special', accent: '#1F6B6B', description: 'सार्वजनिक आरोग्य, रुग्णालये, आरोग्य शिबिरे आणि नागरिकांसाठीच्या आरोग्य योजना.' },
  { slug: 'shikshan-visheshank', search: 'शिक्षण', title: 'ज्ञानदीप', subtitle: 'शिक्षण विशेषांक', kind: 'special', accent: '#2E4C8C', description: 'शाळा, उच्च शिक्षण, शिष्यवृत्ती आणि विद्यार्थ्यांसाठीचे शासकीय उपक्रम.' },
  { slug: 'nari-shakti', search: 'महिला', title: 'नारीशक्ती', subtitle: 'महिला सक्षमीकरण विशेषांक', kind: 'special', accent: '#A3245B', description: 'महिला सक्षमीकरण, बचत गट, सुरक्षितता आणि महिलांसाठीच्या योजना.' },
  { slug: 'udyog-rojgar', search: 'उद्योग', title: 'उद्योग व रोजगार', subtitle: 'उद्योजकता विशेषांक', kind: 'special', accent: '#5B4A9E', description: 'गुंतवणूक, उद्योग, स्टार्टअप आणि रोजगारनिर्मितीच्या घडामोडी.' },
  { slug: 'paryatan-visheshank', search: 'पर्यटन', title: 'महाराष्ट्र दर्शन', subtitle: 'पर्यटन विशेषांक', kind: 'special', accent: '#B5532A', description: 'गडकिल्ले, तीर्थक्षेत्रे, निसर्ग आणि पर्यटन विकासाचे उपक्रम.' },
  { slug: 'krida-visheshank', search: 'क्रीडा', title: 'क्रीडा महाराष्ट्र', subtitle: 'क्रीडा विशेषांक', kind: 'special', accent: '#1E6E3A', description: 'खेळाडूंचे यश, क्रीडा स्पर्धा आणि क्रीडा सुविधा.' },
  { slug: 'shasakiya-yojana', search: 'योजना', title: 'शासकीय योजना', subtitle: 'लाभार्थ्यांसाठी मार्गदर्शक', kind: 'themed', accent: '#A8172C', description: 'राज्य शासनाच्या प्रमुख योजना — कोणासाठी, काय लाभ, कसा अर्ज करायचा.' },
  { slug: 'mantrimandal-nirnay', search: 'मंत्रिमंडळ', title: 'मंत्रिमंडळ निर्णय', subtitle: 'महत्त्वाचे शासन निर्णय', kind: 'themed', accent: '#3A3833', description: 'मंत्रिमंडळ बैठकींतील महत्त्वाचे निर्णय आणि त्यांचा नागरिकांवर परिणाम.' },
  { slug: 'payabhut-suvidha', search: 'प्रकल्प', title: 'पायाभूत सुविधा', subtitle: 'रस्ते, प्रकल्प आणि विकासकामे', kind: 'themed', accent: '#4A5A6A', description: 'रस्ते, पूल, मेट्रो, जलप्रकल्प आणि राज्यातील प्रमुख विकासकामे.' },
  { slug: 'paryavaran', search: 'पर्यावरण', title: 'हरित महाराष्ट्र', subtitle: 'पर्यावरण संग्रह', kind: 'themed', accent: '#2F7A4F', description: 'वृक्षलागवड, जलसंधारण, प्रदूषण नियंत्रण आणि पर्यावरण संवर्धन.' },
  { slug: 'gramvikas', search: 'ग्रामविकास', title: 'ग्रामविकास', subtitle: 'गाव तिथे विकास', kind: 'themed', accent: '#7A5A1F', description: 'ग्रामपंचायती, ग्रामीण रस्ते, घरकुल आणि ग्रामीण विकासाचे उपक्रम.' },
  { slug: 'samajik-nyay', search: 'सामाजिक न्याय', title: 'सामाजिक न्याय', subtitle: 'समतेच्या दिशेने', kind: 'themed', accent: '#6B3A8C', description: 'वंचित घटक, दिव्यांग, ज्येष्ठ नागरिक आणि सामाजिक न्यायाच्या योजना.' },
  { slug: 'yuva-kaushalya', search: 'युवक', title: 'युवा महाराष्ट्र', subtitle: 'कौशल्य व संधी', kind: 'themed', accent: '#C2410C', description: 'युवकांसाठी कौशल्य विकास, प्रशिक्षण, स्पर्धा परीक्षा आणि संधी.' },
  { slug: 'jalsandharan', search: 'जलसंधारण', title: 'जलसमृद्धी', subtitle: 'पाणी व जलसंधारण', kind: 'themed', accent: '#1D5F8A', description: 'धरणे, जलयुक्त शिवार, पिण्याचे पाणी आणि सिंचन प्रकल्प.' },
  { slug: 'adivasi-vikas', search: 'आदिवासी', title: 'आदिवासी विकास', subtitle: 'वनवासी बांधवांसाठी', kind: 'themed', accent: '#8C4A2F', description: 'आदिवासी भागातील शिक्षण, आरोग्य, रोजगार आणि विकास योजना.' },
  { slug: 'sahakar', search: 'सहकार', title: 'सहकार', subtitle: 'सहकारी चळवळ', kind: 'themed', accent: '#5E6B1F', description: 'सहकारी संस्था, बँका, साखर कारखाने आणि सहकार क्षेत्रातील निर्णय.' },
  { slug: 'sanskruti', search: 'सांस्कृतिक', title: 'सांस्कृतिक महाराष्ट्र', subtitle: 'कला, साहित्य, परंपरा', kind: 'themed', accent: '#8F1D4E', description: 'साहित्य, कला, लोककला, उत्सव आणि सांस्कृतिक उपक्रम.' },
]

/** Long enough to be worth a chapter, and not a bare photo caption. */
const substantial = (a: { contentHtml?: string }) => (a.contentHtml ?? '').replace(/<[^>]+>/g, '').length > 600

/** The calendar day in India for an ISO instant. */
const istDate = (iso: string) => new Date(Date.parse(iso) + 5.5 * 3_600_000).toISOString().slice(0, 10)

function assertLocal() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  const host = new URL(url).hostname
  const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)
  if (!local && !process.argv.includes('--allow-remote')) {
    console.error(`Refusing to write demo books to ${host}: this is not a local database.`)
    console.error('If you really mean to add them there, run again with --allow-remote.')
    process.exit(1)
  }
  if (process.env.DATABASE_READONLY === '1') {
    console.error('DATABASE_READONLY=1 is set: nothing can be written. Unset it for a local database.')
    process.exit(1)
  }
  console.log(`Database: ${host}${local ? ' (this computer)' : ' (REMOTE — --allow-remote given)'}`)
}

async function main() {
  assertLocal()
  await db.ensureSchema()

  const saveAll = async (rows: Awaited<ReturnType<typeof browseArticles>>) => {
    const out: Article[] = []
    for (const r of rows.filter(substantial)) out.push(await db.upsertArticleBySource(r))
    return out
  }

  async function upsertBook(slug: string, data: Omit<db.BookInput, 'slug'> & { title: string }, chapters: { articleId: number; sectionLabel?: string | null }[]) {
    const existing = await db.getBookBySlug(slug)
    const book = existing ? (await db.updateBook(existing.id, data))! : await db.createBook({ ...data, slug })
    await db.setChapters(book.id, chapters)
    built++
    console.log(`  ${String(built).padStart(2)}. /read/${slug} — ${chapters.length} लेख`)
  }
  let built = 0

  /* ------------------------------------------------------ recent news */

  console.log('Fetching recent news from mahasamvad.in…')
  const recent: Article[] = []
  for (let page = 1; page <= 4; page++) {
    const rows = await browseArticles({ page, perPage: 50 })
    if (!rows.length) break
    recent.push(...(await saveAll(rows)))
    process.stdout.write(`  page ${page}: ${recent.length} usable\n`)
  }

  console.log('Building books…')

  // Daily editions: one per day with enough stories, newest first.
  const byDay = new Map<string, Article[]>()
  for (const a of recent) {
    if (!a.publishedAt) continue
    const d = istDate(a.publishedAt)
    byDay.set(d, [...(byDay.get(d) ?? []), a])
  }
  const days = [...byDay.entries()].filter(([, list]) => list.length >= 5).sort(([a], [b]) => b.localeCompare(a)).slice(0, MAX_EDITIONS)
  for (const [day, list] of days) {
    const pick = [...list].sort((a, b) => Number(!!b.heroImage) - Number(!!a.heroImage)).slice(0, 12)
    await upsertBook(
      `mahasamvad-${day.replace(/-/g, '')}`,
      {
        title: 'महासंवाद',
        subtitle: 'दैनिक आवृत्ती',
        kind: 'edition',
        editionDate: day,
        description: 'महाराष्ट्र शासनाच्या माहिती व जनसंपर्क महासंचालनालयाकडून दिवसभरातील महत्त्वाच्या घडामोडी — एकाच पुस्तकात.',
        accentColor: '#A8172C',
        status: 'published',
      },
      pick.map((a) => ({ articleId: a.id })),
    )
  }

  // District round-up.
  const byDistrict = recent.filter((a) => a.district)
  byDistrict.sort((a, b) => districtName(a.district).localeCompare(districtName(b.district), 'mr'))
  if (byDistrict.length >= 5) {
    await upsertBook(
      'jilhyantun',
      {
        title: 'जिल्ह्यांतून',
        subtitle: 'महाराष्ट्राच्या कानाकोपऱ्यातील घडामोडी',
        kind: 'themed',
        editionDate: todayIso(),
        description: 'राज्यातील विविध जिल्ह्यांमधील विकासकामे, योजना आणि लोकोपयोगी उपक्रमांचा जिल्हानिहाय आढावा.',
        accentColor: '#1F5C4A',
        status: 'published',
      },
      byDistrict.slice(0, 14).map((a) => ({ articleId: a.id, sectionLabel: districtName(a.district) })),
    )
  }

  /* ------------------------------------------------------------ topics */

  // A story goes in one topic book only where possible, so books don't repeat each other.
  const used = new Set<number>()
  for (const t of TOPICS) {
    if (built >= TARGET) break
    const found = await saveAll(await browseArticles({ search: t.search, perPage: 30 }))
    const fresh = found.filter((a) => !used.has(a.id))
    const pick = (fresh.length >= 6 ? fresh : found).slice(0, 10)
    if (pick.length < 4) {
      console.log(`  (skipped ${t.title}: only ${pick.length} usable stories)`)
      continue
    }
    pick.forEach((a) => used.add(a.id))
    const newest = pick.map((a) => a.publishedAt).filter(Boolean).sort().at(-1)
    await upsertBook(
      t.slug,
      {
        title: t.title,
        subtitle: t.subtitle,
        kind: t.kind,
        editionDate: newest ? istDate(newest) : todayIso(),
        description: t.description,
        accentColor: t.accent,
        status: 'published',
      },
      pick.map((a) => ({ articleId: a.id })),
    )
  }

  await db.pool().end()
  console.log(`Done: ${built} books.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
