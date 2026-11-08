/**
 * The 36 districts of Maharashtra.
 *
 * `key` is the canonical identifier used everywhere in the database and the
 * heatmap. `mr` is what the UI shows. `aliases` exist so an article written in
 * English or Hindi — or using a former name — still resolves to one district.
 * "Solapur", "सोलापूर" and "सोलापुर" are the same place.
 */
export interface District {
  key: string
  mr: string
  en: string
  aliases: string[]
}

export const DISTRICTS: District[] = [
  { key: 'ahilyanagar', mr: 'अहिल्यानगर', en: 'Ahilyanagar', aliases: ['Ahmednagar', 'अहमदनगर', 'अहिल्या नगर'] },
  { key: 'akola', mr: 'अकोला', en: 'Akola', aliases: [] },
  { key: 'amravati', mr: 'अमरावती', en: 'Amravati', aliases: ['Amaravati'] },
  { key: 'chhatrapati-sambhajinagar', mr: 'छत्रपती संभाजीनगर', en: 'Chhatrapati Sambhajinagar', aliases: ['Aurangabad', 'औरंगाबाद', 'संभाजीनगर'] },
  { key: 'beed', mr: 'बीड', en: 'Beed', aliases: ['Bid'] },
  { key: 'bhandara', mr: 'भंडारा', en: 'Bhandara', aliases: [] },
  { key: 'buldhana', mr: 'बुलढाणा', en: 'Buldhana', aliases: ['Buldana', 'बुलडाणा'] },
  { key: 'chandrapur', mr: 'चंद्रपूर', en: 'Chandrapur', aliases: ['चंद्रपुर'] },
  { key: 'dhule', mr: 'धुळे', en: 'Dhule', aliases: ['धुले'] },
  { key: 'gadchiroli', mr: 'गडचिरोली', en: 'Gadchiroli', aliases: [] },
  { key: 'gondia', mr: 'गोंदिया', en: 'Gondia', aliases: ['Gondiya'] },
  { key: 'hingoli', mr: 'हिंगोली', en: 'Hingoli', aliases: [] },
  { key: 'jalgaon', mr: 'जळगाव', en: 'Jalgaon', aliases: ['जलगाव'] },
  { key: 'jalna', mr: 'जालना', en: 'Jalna', aliases: [] },
  { key: 'kolhapur', mr: 'कोल्हापूर', en: 'Kolhapur', aliases: ['कोल्हापुर'] },
  { key: 'latur', mr: 'लातूर', en: 'Latur', aliases: ['लातुर'] },
  { key: 'mumbai-city', mr: 'मुंबई शहर', en: 'Mumbai City', aliases: ['Mumbai', 'मुंबई', 'Bombay'] },
  { key: 'mumbai-suburban', mr: 'मुंबई उपनगर', en: 'Mumbai Suburban', aliases: ['Mumbai Suburb', 'उपनगर'] },
  { key: 'nagpur', mr: 'नागपूर', en: 'Nagpur', aliases: ['नागपुर'] },
  { key: 'nanded', mr: 'नांदेड', en: 'Nanded', aliases: [] },
  { key: 'nandurbar', mr: 'नंदुरबार', en: 'Nandurbar', aliases: [] },
  { key: 'nashik', mr: 'नाशिक', en: 'Nashik', aliases: ['Nasik'] },
  { key: 'dharashiv', mr: 'धाराशिव', en: 'Dharashiv', aliases: ['Osmanabad', 'उस्मानाबाद'] },
  { key: 'palghar', mr: 'पालघर', en: 'Palghar', aliases: [] },
  { key: 'parbhani', mr: 'परभणी', en: 'Parbhani', aliases: [] },
  { key: 'pune', mr: 'पुणे', en: 'Pune', aliases: ['Poona'] },
  { key: 'raigad', mr: 'रायगड', en: 'Raigad', aliases: ['Raigarh'] },
  { key: 'ratnagiri', mr: 'रत्नागिरी', en: 'Ratnagiri', aliases: [] },
  { key: 'sangli', mr: 'सांगली', en: 'Sangli', aliases: [] },
  { key: 'satara', mr: 'सातारा', en: 'Satara', aliases: [] },
  { key: 'sindhudurg', mr: 'सिंधुदुर्ग', en: 'Sindhudurg', aliases: [] },
  { key: 'solapur', mr: 'सोलापूर', en: 'Solapur', aliases: ['Sholapur', 'सोलापुर'] },
  { key: 'thane', mr: 'ठाणे', en: 'Thane', aliases: ['Thana'] },
  { key: 'wardha', mr: 'वर्धा', en: 'Wardha', aliases: [] },
  { key: 'washim', mr: 'वाशिम', en: 'Washim', aliases: ['वाशीम'] },
  { key: 'yavatmal', mr: 'यवतमाळ', en: 'Yavatmal', aliases: ['Yeotmal', 'यवतमाल'] },
]

const LOOKUP = new Map<string, string>()
for (const d of DISTRICTS) {
  for (const name of [d.key, d.mr, d.en, ...d.aliases]) {
    LOOKUP.set(name.toLowerCase().replace(/\s+/g, ' ').trim(), d.key)
  }
}

/**
 * Resolve any spelling — Marathi, Hindi, English, former name — to a canonical
 * district key. Returns null rather than guessing, because a wrong district is
 * worse than a missing one: the heatmap is only as honest as this function.
 */
export function resolveDistrict(input: string | null | undefined): string | null {
  if (!input) return null
  const norm = input.toLowerCase().replace(/\s+/g, ' ').trim()
  return LOOKUP.get(norm) ?? null
}

export function districtName(key: string | null): string {
  if (!key) return 'जिल्हा नाही'
  return DISTRICTS.find((d) => d.key === key)?.mr ?? key
}

export const DISTRICT_KEYS = DISTRICTS.map((d) => d.key)
