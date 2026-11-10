/**
 * Readers search in English too — by habit, or because the browser is
 * translating the page — while every article is in Marathi. English words are
 * mapped to the Marathi words the articles actually use ("woman" → महिला,
 * "Pune" → पुणे). Shared by the server search and the home page's book filter.
 */
import { DISTRICTS } from './districts'

const WORDS: Record<string, string[]> = {
  woman: ['महिला', 'स्त्री'], women: ['महिला', 'स्त्री'], lady: ['महिला'], ladies: ['महिला'], mahila: ['महिला'],
  girl: ['मुली', 'मुलगी'], girls: ['मुली'], child: ['बालक', 'मुले'], children: ['बालक', 'मुले'], kids: ['मुले'],
  farmer: ['शेतकरी'], farmers: ['शेतकरी'], farming: ['शेती'], agriculture: ['शेती', 'कृषी'], crop: ['पीक'], crops: ['पीक', 'पिके'],
  health: ['आरोग्य'], hospital: ['रुग्णालय'], doctor: ['डॉक्टर'], medical: ['वैद्यकीय', 'आरोग्य'],
  education: ['शिक्षण'], school: ['शाळा'], schools: ['शाळा'], college: ['महाविद्यालय'], student: ['विद्यार्थी'], students: ['विद्यार्थी'],
  scheme: ['योजना'], schemes: ['योजना'], yojana: ['योजना'], welfare: ['कल्याण'],
  job: ['रोजगार', 'नोकरी'], jobs: ['रोजगार', 'नोकरी'], employment: ['रोजगार'], skill: ['कौशल्य'], skills: ['कौशल्य'],
  industry: ['उद्योग'], industries: ['उद्योग'], business: ['उद्योग', 'व्यवसाय'], investment: ['गुंतवणूक'], startup: ['स्टार्टअप'],
  water: ['पाणी'], dam: ['धरण'], irrigation: ['सिंचन'], drought: ['दुष्काळ'], rain: ['पाऊस'], flood: ['पूर'],
  road: ['रस्ता', 'रस्ते'], roads: ['रस्ते'], bridge: ['पूल'], metro: ['मेट्रो'], infrastructure: ['पायाभूत'], project: ['प्रकल्प'], projects: ['प्रकल्प'],
  tourism: ['पर्यटन'], tourist: ['पर्यटक', 'पर्यटन'], fort: ['किल्ला', 'गड'], forts: ['किल्ले', 'गड'], temple: ['मंदिर'],
  sport: ['क्रीडा', 'खेळ'], sports: ['क्रीडा', 'खेळ'], player: ['खेळाडू'], players: ['खेळाडू'],
  environment: ['पर्यावरण'], tree: ['वृक्ष', 'झाड'], trees: ['वृक्ष', 'झाडे'], forest: ['वन', 'जंगल'],
  village: ['गाव', 'ग्राम'], villages: ['गावे', 'ग्राम'], rural: ['ग्रामीण'],
  cabinet: ['मंत्रिमंडळ'], decision: ['निर्णय'], decisions: ['निर्णय'],
  cm: ['मुख्यमंत्री'], minister: ['मंत्री'], government: ['शासन', 'सरकार'], governor: ['राज्यपाल'],
  election: ['निवडणूक'], vote: ['मतदान'], voting: ['मतदान'],
  electricity: ['वीज'], power: ['वीज', 'ऊर्जा'], solar: ['सौर'], energy: ['ऊर्जा'],
  house: ['घरकुल', 'घर'], housing: ['घरकुल', 'गृहनिर्माण'],
  tribal: ['आदिवासी'], adivasi: ['आदिवासी'],
  diwali: ['दिवाळी'], festival: ['उत्सव', 'सण'], culture: ['संस्कृती', 'सांस्कृतिक'],
  loan: ['कर्ज'], bank: ['बँक'], police: ['पोलीस'], youth: ['युवा', 'युवक'], senior: ['ज्येष्ठ'], disabled: ['दिव्यांग'], divyang: ['दिव्यांग'],
  cooperative: ['सहकार'], cooperation: ['सहकार'], social: ['सामाजिक'], justice: ['न्याय'],
}

// District names in English (and old names), so "Pune" finds पुणे.
const PLACES = new Map<string, string>()
for (const d of DISTRICTS) {
  PLACES.set(d.en.toLowerCase(), d.mr)
  for (const a of d.aliases) if (/^[a-z ]+$/i.test(a)) PLACES.set(a.toLowerCase(), d.mr)
}
// Mumbai has two districts; the city name should find both.
PLACES.set('mumbai', 'मुंबई')

const LATIN = /[a-z]/i

/**
 * The words to look for. Marathi input is searched as typed. English input is
 * mapped word by word (and as a whole, for "chief minister"-style phrases);
 * words with no mapping are still searched as they are.
 */
export function searchTerms(input: string): string[] {
  const q = input.trim().replace(/\s+/g, ' ')
  if (!q) return []
  if (!LATIN.test(q)) return [q]
  const lower = q.toLowerCase()
  const out = new Set<string>()
  const phrase = lower === 'chief minister' ? ['मुख्यमंत्री'] : (WORDS[lower] ?? (PLACES.has(lower) ? [PLACES.get(lower)!] : null))
  if (phrase) phrase.forEach((w) => out.add(w))
  else {
    for (const word of lower.split(' ')) {
      const w = word.replace(/[^a-z]/g, '')
      if (!w) continue
      const mapped = WORDS[w] ?? WORDS[w.replace(/s$/, '')] ?? (PLACES.has(w) ? [PLACES.get(w)!] : null)
      if (mapped) mapped.forEach((m) => out.add(m))
    }
  }
  // Keep the English as typed too: some articles carry English names and terms.
  out.add(q)
  return [...out].slice(0, 8)
}

/** Shown when nothing matches: words that do. */
export const SEARCH_EXAMPLES = ['महिला', 'शेतकरी', 'योजना', 'आरोग्य', 'शिक्षण', 'पुणे']
