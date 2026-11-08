import sanitizeHtml from 'sanitize-html'

/**
 * Article bodies are stored as HTML restricted to what the book typesetter
 * knows how to lay out. Anything else is unwrapped to its text, so content
 * survives even when its markup doesn't.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'h2', 'h3', 'blockquote', 'ul', 'ol', 'li', 'strong', 'em', 'a', 'figure', 'img', 'figcaption', 'br'],
  allowedAttributes: {
    a: ['href'],
    img: ['src', 'alt', 'width', 'height'],
    strong: ['class'],
    p: ['class'],
  },
  allowedClasses: { strong: ['dateline'], p: ['endmark', 'signoff'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  allowProtocolRelative: false,
  transformTags: {
    b: 'strong',
    i: 'em',
    h1: 'h2',
    h4: 'h3',
    h5: 'h3',
    h6: 'h3',
    // WordPress serves uploads over http in old posts; the reader is https.
    img: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, src: (attribs.src ?? '').replace(/^http:\/\//, 'https://') },
    }),
    tr: 'p',
  },
  exclusiveFilter: (frame) =>
    (frame.tag === 'img' && !frame.attribs.src) ||
    (['p', 'h2', 'h3', 'li', 'blockquote', 'figcaption'].includes(frame.tag) && !frame.text.trim() && !frame.mediaChildren.length),
}

export function sanitizeArticleHtml(raw: string): string {
  let html = raw ?? ''
  // Table cells would otherwise run together once the table tags are dropped.
  html = html.replace(/<\/t[dh]>\s*<t[dh]/gi, '</td> · <td')
  html = sanitizeHtml(html, OPTIONS)
  // An image alone in a paragraph (the classic editor's habit) is a figure.
  html = html.replace(/<p>\s*(?:<a [^>]*>)?\s*(<img [^>]*>)\s*(?:<\/a>)?\s*<\/p>/gi, '<figure>$1</figure>')
  // A figure's image is never a link in a book.
  html = html.replace(/<figure>\s*<a [^>]*>\s*(<img [^>]*>)\s*<\/a>/gi, '<figure>$1')
  html = html.replace(/&nbsp;/g, ' ')
  html = hoistImages(html)
  html = html.replace(/<p>\s*<\/p>/g, '')
  html = boldParagraphsToSubheads(html)
  html = markEnd(html)
  html = markDateline(html)
  return html.trim()
}

/** Images sharing a paragraph with text are pulled out into their own figures, in place. */
function hoistImages(html: string): string {
  return html.replace(/<p>([\s\S]*?)<\/p>/g, (whole, inner: string) => {
    if (!/<img /.test(inner)) return whole
    const parts = inner.split(/(<img [^>]*>)/)
    return parts
      .map((part) => (part.startsWith('<img ') ? `<figure>${part}</figure>` : part.trim() ? `<p>${part.trim()}</p>` : ''))
      .join('')
  })
}

/** A paragraph that is nothing but bold text is a subhead the editor typed by hand. */
function boldParagraphsToSubheads(html: string): string {
  return html.replace(/<p>((?:\s*<strong>[^<]*<\/strong>\s*)+)<\/p>/g, (whole, inner: string) => {
    const text = inner.replace(/<[^>]+>/g, '').trim()
    if (!text || text.length > 140 || /दि\.\s*[०-९0-9]{1,2}\s*:?$/.test(text)) return whole
    return `<h3>${text}</h3>`
  })
}

/** "००००" closes a DGIPR release; the short line after it is the writer's sign-off. */
function markEnd(html: string): string {
  return html.replace(/<p>\s*([०0*•\s]{3,})\s*<\/p>(\s*<p>([^<]{2,80})<\/p>)?\s*$/, (_m, _mark, tail, sign) =>
    `<p class="endmark">०००</p>${tail ? `<p class="signoff">${sign.trim()}</p>` : ''}`,
  )
}

/** Mahasamvad's stand-in featured image for stories without a photo. */
export function isPlaceholderImage(url: string | null | undefined): boolean {
  return !!url && /Maha-Gov-lo/i.test(url)
}

/** "<strong>मुंबई, दि. १५ :</strong>" opening the first paragraph becomes the styled dateline. */
function markDateline(html: string): string {
  return html.replace(/^(\s*(?:<ul>[\s\S]*?<\/ul>\s*)?<p>)\s*<strong>([^<]{2,60}?दि\.\s*[०-९0-9]{1,2}\s*:?)<\/strong>/, '$1<strong class="dateline">$2</strong>')
}

export function decodeEntities(str: string): string {
  if (!str) return ''
  return str
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&hellip;/g, '…')
}

export function htmlToText(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

export function excerptOf(html: string, words = 40): string {
  const text = htmlToText(html.replace(/<strong class="dateline">[\s\S]*?<\/strong>/, ''))
  const parts = text.split(' ')
  return parts.length > words ? parts.slice(0, words).join(' ') + '…' : text
}
