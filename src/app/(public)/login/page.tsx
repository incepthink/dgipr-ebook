import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { LoginFlow } from '@/components/auth/LoginFlow'
import { googleConfigured } from '@/lib/auth/google'
import { safeNext } from '@/lib/auth/normalize'
import { getSessionUser } from '@/lib/auth/session'
import { publicUser } from '@/lib/auth/users'
import { listPublishedBooks, readOnlyDb } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'प्रवेश करा' }

const ERRORS: Record<string, string> = {
  google_cancelled: 'Google प्रवेश रद्द केला. पुन्हा प्रयत्न करा किंवा ईमेलने प्रवेश करा.',
  google_expired: 'प्रवेशाची वेळ संपली. कृपया पुन्हा "Google ने सुरू ठेवा" दाबा.',
  google_unverified: 'या Google खात्याचा ईमेल पडताळलेला नाही. दुसरे खाते वापरा किंवा ईमेलने प्रवेश करा.',
  google_failed: 'Google प्रवेश पूर्ण झाला नाही. थोड्या वेळाने पुन्हा प्रयत्न करा.',
  google_unavailable: 'Google प्रवेश सध्या उपलब्ध नाही. कृपया ईमेलने प्रवेश करा.',
  readonly: 'केवळ-वाचन मोडमध्ये प्रवेश बंद आहे.',
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; onboard?: string }> }) {
  const sp = await searchParams
  const next = safeNext(sp.next)
  const user = await getSessionUser()
  // Just signed in with Google for the first time: show the district & interests step.
  const onboarding = sp.onboard === '1' && !!user
  if (user && !onboarding) redirect(next)
  const covers = await listPublishedBooks()
    .then((b) => b.slice(0, 3))
    .catch(() => [])

  return (
    <div className="acc">
      <header className="auth-top">
        <img src="/emblem.png" alt="महाराष्ट्र शासन" />
        <div className="auth-top-name">
          <b>महासंवाद ई-पुस्तके</b>
          <span>महाराष्ट्र शासन · माहिती व जनसंपर्क महासंचालनालय</span>
        </div>
        <Link href="/" className="acc-link">
          ग्रंथालयात जा
        </Link>
      </header>
      {readOnlyDb() ? (
        <div className="auth-wrap">
          <div className="ml-empty" style={{ maxWidth: 560, margin: '24px auto' }}>
            <h3>केवळ-वाचन मोड</h3>
            <p>हे स्थानिक तपासणीसाठी चालू आहे आणि थेट डेटाबेसमध्ये काहीही लिहिले जात नाही, म्हणून प्रवेश बंद आहे. पुस्तके नेहमीप्रमाणे वाचता येतात.</p>
            <Link href="/" className="acc-btn acc-btn--primary">
              ग्रंथालयात जा
            </Link>
          </div>
        </div>
      ) : (
        <LoginFlow
          next={next}
          googleEnabled={googleConfigured()}
          covers={covers}
          initialError={sp.error ? (ERRORS[sp.error] ?? ERRORS.google_failed) : null}
          onboardUser={onboarding ? publicUser(user) : null}
        />
      )}
    </div>
  )
}
