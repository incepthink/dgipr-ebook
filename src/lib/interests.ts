/** Topics a reader can follow. Keys are stored on the account; labels are shown. */
/** `word` is what the topic filter searches for, `short` its chip label. */
export const INTERESTS: { key: string; label: string; short: string; word: string }[] = [
  { key: 'agriculture', label: 'शेती व कृषी', short: 'शेती', word: 'शेत' },
  { key: 'schemes', label: 'शासकीय योजना व निर्णय', short: 'योजना', word: 'योजना' },
  { key: 'health', label: 'आरोग्य व पोषण', short: 'आरोग्य', word: 'आरोग्य' },
  { key: 'education', label: 'शिक्षण व रोजगार', short: 'शिक्षण', word: 'शिक्षण' },
  { key: 'culture', label: 'संस्कृती, इतिहास व पर्यटन', short: 'पर्यटन', word: 'पर्यटन' },
  { key: 'industry', label: 'उद्योग व तंत्रज्ञान', short: 'उद्योग', word: 'उद्योग' },
  { key: 'rural', label: 'सहकार व ग्रामविकास', short: 'ग्रामविकास', word: 'ग्राम' },
  { key: 'women', label: 'महिला व बालविकास', short: 'महिला', word: 'महिला' },
  { key: 'infrastructure', label: 'पायाभूत सुविधा', short: 'पायाभूत सुविधा', word: 'प्रकल्प' },
  { key: 'environment', label: 'पर्यावरण', short: 'पर्यावरण', word: 'पर्यावरण' },
]

export const INTEREST_KEYS = INTERESTS.map((i) => i.key)
