'use client'

import { AlertCircle, ArrowLeft, ArrowRight, BadgeCheck, BookOpen, Eye, EyeOff, Mail, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { call } from '@/components/account/client'
import { BookCover } from '@/components/library/BookCover'
import type { PublicUser } from '@/lib/auth/users'
import { DISTRICTS } from '@/lib/districts'
import { INTERESTS } from '@/lib/interests'
import type { BookSummary } from '@/lib/types'

type Step = 'choose' | 'email' | 'profile'
type AuthResult = { user: PublicUser; needsProfile: boolean }

function Spinner() {
  return <span className="acc-spin" aria-hidden />
}

function ErrorBox({ msg }: { msg: string | null }) {
  if (!msg) return null
  return (
    <div className="acc-error" role="alert">
      <AlertCircle size={18} aria-hidden />
      <span>{msg}</span>
    </div>
  )
}

/** Google's own "G" mark, as its sign-in branding guidelines ask for. */
function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
    </svg>
  )
}

interface Props {
  next: string
  googleEnabled: boolean
  covers: BookSummary[]
  initialError?: string | null
  /** Set right after a first Google sign-in: open on the district & interests step. */
  onboardUser?: PublicUser | null
}

export function LoginFlow({ next, googleEnabled, covers, initialError = null, onboardUser = null }: Props) {
  const [step, setStep] = useState<Step>(onboardUser ? 'profile' : googleEnabled ? 'choose' : 'email')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(initialError)

  const [emailMode, setEmailMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState(onboardUser?.name ?? '')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)

  const [user, setUser] = useState<PublicUser | null>(onboardUser)
  const [district, setDistrict] = useState(onboardUser?.district ?? '')
  const [interests, setInterests] = useState<string[]>(onboardUser?.interests ?? [])
  const [notify, setNotify] = useState(onboardUser?.notify ?? true)

  const go = () => window.location.replace(next)
  const googleHref = `/api/auth/google?next=${encodeURIComponent(next)}`

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function finish(res: AuthResult) {
    if (!res.needsProfile) return go()
    setUser(res.user)
    setName(res.user.name ?? '')
    setDistrict(res.user.district ?? '')
    setInterests(res.user.interests)
    setNotify(res.user.notify)
    setStep('profile')
  }

  const submitEmail = (e: FormEvent) => {
    e.preventDefault()
    void run(async () => {
      finish(
        await call<AuthResult>('/api/auth/email', 'POST', emailMode === 'login' ? { mode: 'login', email, password } : { mode: 'register', name, email, password }),
      )
    })
  }

  const saveProfile = (e: FormEvent) => {
    e.preventDefault()
    void run(async () => {
      await call('/api/me', 'PATCH', { ...(name.trim() ? { name: name.trim() } : {}), district: district || null, interests, notify })
      go()
    })
  }

  const googleButton = (
    <a
      href={googleHref}
      className="acc-btn acc-btn--outline acc-btn--block acc-btn--google"
      onClick={() => setBusy(true)}
      aria-disabled={busy}
    >
      {busy ? <Spinner /> : <GoogleMark />}
      Google ने सुरू ठेवा
    </a>
  )

  /* ------------------------------------------------------------- steps */

  let body: React.ReactNode
  if (step === 'choose') {
    body = (
      <>
        <h2>खात्यात प्रवेश करा</h2>
        <p>आपले मोफत शासकीय डिजिटल ग्रंथालय — वाचन प्रगती आणि खुणा प्रत्येक उपकरणावर.</p>
        <ErrorBox msg={error} />
        <div style={{ marginTop: error ? 16 : 0 }}>{googleButton}</div>
        <p className="acc-hint" style={{ justifyContent: 'center' }}>
          <ShieldCheck size={14} aria-hidden /> आम्हाला फक्त आपले नाव व ईमेल मिळतो — पासवर्ड नाही.
        </p>
        <div className="acc-or">
          <span>किंवा</span>
        </div>
        <button
          type="button"
          className="acc-btn acc-btn--outline acc-btn--block"
          onClick={() => {
            setError(null)
            setStep('email')
          }}
        >
          <Mail size={20} aria-hidden /> ईमेल व पासवर्डने प्रवेश करा
        </button>
      </>
    )
  } else if (step === 'email') {
    const register = emailMode === 'register'
    body = (
      <>
        {googleEnabled && (
          <button
            type="button"
            className="auth-back"
            onClick={() => {
              setError(null)
              setStep('choose')
            }}
          >
            <ArrowLeft size={18} aria-hidden /> Google ने प्रवेश
          </button>
        )}
        <h2>{register ? 'नवे खाते तयार करा' : 'ईमेलने प्रवेश करा'}</h2>
        <p>{register ? 'नाव, ईमेल आणि पासवर्ड — एवढेच पुरे.' : 'आपल्या नोंदणीकृत ईमेल व पासवर्डने पुढे जा.'}</p>
        <form onSubmit={submitEmail} className="acc-stack" noValidate>
          {register && (
            <div>
              <label className="acc-label" htmlFor="name">
                पूर्ण नाव <i>*</i>
              </label>
              <input id="name" className="acc-input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          )}
          <div>
            <label className="acc-label" htmlFor="email">
              ईमेल <i>*</i>
            </label>
            <input
              id="email"
              className="acc-input"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="acc-label" htmlFor="password">
              पासवर्ड <i>*</i>
            </label>
            <div className="acc-pw">
              <input
                id="password"
                className="acc-input"
                type={showPw ? 'text' : 'password'}
                autoComplete={register ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button type="button" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? 'पासवर्ड लपवा' : 'पासवर्ड दाखवा'}>
                {showPw ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {register && <p className="acc-hint">किमान ८ अक्षरे.</p>}
          </div>
          <ErrorBox msg={error} />
          <button type="submit" className="acc-btn acc-btn--primary acc-btn--block" disabled={busy}>
            {busy ? <Spinner /> : null}
            {register ? 'खाते तयार करा' : 'प्रवेश करा'}
            {!busy && <ArrowRight size={20} aria-hidden />}
          </button>
        </form>
        <p style={{ marginTop: 16, textAlign: 'center', fontSize: 15, color: 'var(--muted)' }}>
          {register ? 'आधीच खाते आहे?' : 'नवीन वाचक?'}{' '}
          <button
            type="button"
            className="acc-link"
            onClick={() => {
              setError(null)
              setEmailMode(register ? 'login' : 'register')
            }}
          >
            {register ? 'प्रवेश करा' : 'खाते तयार करा'}
          </button>
        </p>
      </>
    )
  } else {
    body = (
      <>
        <div className="auth-step">शेवटची पायरी</div>
        <div className="auth-progress">
          <i style={{ width: '100%' }} />
        </div>
        <h2>{user?.name ? `नमस्कार, ${user.name}` : 'आपली आवड निवडा'}</h2>
        <p>आपल्या जिल्ह्यातील आणि आवडीच्या विषयांवरील पुस्तके आधी दिसतील.</p>
        <form onSubmit={saveProfile} className="acc-stack">
          {!user?.name && (
            <div>
              <label className="acc-label" htmlFor="pname">
                आपले नाव
              </label>
              <input id="pname" className="acc-input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          )}
          <div>
            <label className="acc-label" htmlFor="district">
              आपला जिल्हा
            </label>
            <select id="district" className="acc-input" value={district} onChange={(e) => setDistrict(e.target.value)}>
              <option value="">जिल्हा निवडा</option>
              {DISTRICTS.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.mr} ({d.en})
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className="acc-label">रुचीचे विषय</span>
            <div className="acc-chips">
              {INTERESTS.map((it) => {
                const on = interests.includes(it.key)
                return (
                  <button
                    key={it.key}
                    type="button"
                    className="acc-chip"
                    aria-pressed={on}
                    onClick={() => setInterests((s) => (on ? s.filter((k) => k !== it.key) : [...s, it.key]))}
                  >
                    {on ? '✓' : '+'} {it.label}
                  </button>
                )
              })}
            </div>
          </div>
          <label className="acc-switch">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
            <span>नवीन आवृत्ती किंवा विशेषांक प्रकाशित झाल्यावर मला कळवा.</span>
          </label>
          <ErrorBox msg={error} />
          <button type="submit" className="acc-btn acc-btn--primary acc-btn--block" disabled={busy}>
            {busy ? <Spinner /> : <BookOpen size={20} aria-hidden />}
            माझे ग्रंथालय सुरू करा
          </button>
          <button type="button" className="acc-btn acc-btn--outline acc-btn--block" onClick={go} disabled={busy}>
            नंतर करा
          </button>
        </form>
      </>
    )
  }

  /* ------------------------------------------------------------ layout */

  return (
    <div className="auth-wrap">
      <div className="auth">
        <aside className="auth-art" aria-hidden>
          <span className="auth-badge">
            <BadgeCheck size={16} /> शासकीय ई-ग्रंथालय
          </span>
          <div>
            <h1 className="auth-title">महासंवाद ई-पुस्तके</h1>
            <p className="auth-lede">महाराष्ट्राच्या बातम्या, विशेषांक आणि संग्रह — पुस्तकाच्या अधिकृत डिजिटल स्वरूपात.</p>
          </div>
          {covers.length > 0 && (
            <div className="auth-fan">
              {[covers[1], covers[2], covers[0]].filter(Boolean).map((b) => (
                <div key={b!.id} className="auth-fan-book">
                  <BookCover b={b!} width={384} />
                </div>
              ))}
            </div>
          )}
          <div className="auth-trust">
            <BadgeCheck size={18} />
            माहिती व जनसंपर्क महासंचालनालय · महाराष्ट्र शासनाचे अधिकृत डिजिटल प्रकाशन
          </div>
        </aside>

        <section className="auth-card">
          {step !== 'profile' && (
            <div className="auth-mini">
              {covers.length > 0 && (
                <div className="auth-mini-covers" aria-hidden>
                  {covers.slice(0, 2).map((b) => (
                    <div key={b.id}>
                      <BookCover b={b} width={384} />
                    </div>
                  ))}
                </div>
              )}
              <div>
                <b>विश्वसनीय माहिती, आता आपल्या खिशात.</b>
                <span>आवृत्त्या, विशेषांक आणि संग्रह मोफत वाचा.</span>
              </div>
            </div>
          )}

          {body}

          {step !== 'profile' && (
            <div className="auth-guest">
              <Link href={next} className="acc-link">
                पाहुणे म्हणून वाचा
              </Link>
              <p>पाहुणे वाचकांची प्रगती व खुणा फक्त या उपकरणावर राहतात.</p>
            </div>
          )}
          <div className="auth-legal">
            <span>© महाराष्ट्र शासन</span>
            <span>माहिती व जनसंपर्क महासंचालनालय</span>
          </div>
        </section>
      </div>
    </div>
  )
}
