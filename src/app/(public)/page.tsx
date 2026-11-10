import { Library } from '@/components/library/Library'
import { getSessionUser } from '@/lib/auth/session'
import { publicUser } from '@/lib/auth/users'
import { listPublishedBooks } from '@/lib/db'
import { continueReading, savedBookIds } from '@/lib/reading'
import { searchArticles } from '@/lib/search'

export const dynamic = 'force-dynamic'

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const [books, user, sp] = await Promise.all([listPublishedBooks(), getSessionUser(), searchParams])
  const [reading, saved, fromDistrict] = user
    ? await Promise.all([
        continueReading(user.id),
        savedBookIds(user.id),
        user.district ? searchArticles({ district: user.district, limit: 12 }).catch(() => []) : Promise.resolve([]),
      ])
    : [[], [], []]
  return (
    <Library
      books={books}
      user={user ? publicUser(user) : null}
      reading={reading}
      savedIds={saved}
      fromDistrict={fromDistrict}
      notice={sp.denied === 'admin' ? 'व्यवस्थापन विभाग फक्त अधिकृत व्यवस्थापकांसाठी आहे.' : null}
    />
  )
}
