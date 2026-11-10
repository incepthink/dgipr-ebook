'use client'

import { Check, LogOut, Settings2, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import type { PublicUser } from '@/lib/auth/users'
import { formatMobile } from '@/lib/auth/normalize'
import { DISTRICTS } from '@/lib/districts'
import { INTERESTS } from '@/lib/interests'
import { dateMr, toDevanagariDigits } from '@/lib/marathi'
import { call, initial } from './client'

export function ProfileForm({ user }: { user: PublicUser }) {
  const [name, setName] = useState(user.name ?? '')
  const [district, setDistrict] = useState(user.district ?? '')
  const [interests, setInterests] = useState(user.interests)
  const [notify, setNotify] = useState(user.notify)
  const [busy, setBusy] = useState<'save' | 'logout' | 'delete' | null>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const contact = user.mobile ? `+९१ ${toDevanagariDigits(formatMobile(user.mobile))}` : user.email

  async function act(kind: 'save' | 'logout' | 'delete', fn: () => Promise<void>) {
    setBusy(kind)
    setError(null)
    setSaved(false)
    try {
      await fn()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const save = (e: FormEvent) => {
    e.preventDefault()
    void act('save', async () => {
      await call('/api/me', 'PATCH', { ...(name.trim() ? { name: name.trim() } : {}), district: district || null, interests, notify })
      setSaved(true)
    })
  }

  const logout = () =>
    act('logout', async () => {
      await call('/api/auth/logout', 'POST')
      window.location.replace('/')
    })

  const remove = () => {
    if (!window.confirm('आपले खाते, वाचन प्रगती, खुणा आणि जतन केलेली पुस्तके कायमची हटवली जातील. पुढे जायचे?')) return
    void act('delete', async () => {
      await call('/api/me', 'DELETE')
      window.location.replace('/')
    })
  }

  return (
    <div className="pf">
      <div>
        <section className="pf-card pf-who">
          <span className="acct-avatar" aria-hidden>
            {initial(user.name ?? user.email ?? user.mobile)}
          </span>
          <b>{user.name || 'वाचक'}</b>
          <span>{contact}</span>
          <span>{dateMr(user.createdAt)} पासून सदस्य</span>
          {user.role === 'admin' && <span className="pf-role">व्यवस्थापक</span>}
          {user.role === 'admin' && (
            <Link href="/admin" className="acc-btn acc-btn--outline acc-btn--block">
              <Settings2 size={18} aria-hidden /> व्यवस्थापन
            </Link>
          )}
          <button type="button" className="acc-btn acc-btn--outline acc-btn--block" onClick={() => void logout()} disabled={!!busy}>
            <LogOut size={18} aria-hidden /> साइन आउट
          </button>
        </section>
      </div>

      <div>
        <form className="pf-card" onSubmit={save}>
          <h2>माझी माहिती</h2>
          <div className="acc-stack">
            <div>
              <label className="acc-label" htmlFor="pf-name">
                पूर्ण नाव
              </label>
              <input id="pf-name" className="acc-input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="acc-label" htmlFor="pf-contact">
                {user.mobile ? 'मोबाईल क्रमांक' : 'ईमेल'}
              </label>
              <input id="pf-contact" className="acc-input" value={contact ?? ''} readOnly disabled />
            </div>
            <div>
              <label className="acc-label" htmlFor="pf-district">
                जिल्हा
              </label>
              <select id="pf-district" className="acc-input" value={district} onChange={(e) => setDistrict(e.target.value)}>
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
          </div>
          {error && (
            <div className="acc-error" role="alert">
              {error}
            </div>
          )}
          <div className="pf-save">
            <button type="submit" className="acc-btn acc-btn--primary" disabled={!!busy}>
              {busy === 'save' && <span className="acc-spin" aria-hidden />}
              बदल जतन करा
            </button>
            {saved && (
              <span className="pf-ok" role="status">
                <Check size={18} aria-hidden /> जतन झाले
              </span>
            )}
          </div>
        </form>

        <section className="pf-card pf-danger">
          <h2>खाते हटवा</h2>
          <p>खाते हटवल्यावर आपली वाचन प्रगती, खुणा आणि जतन केलेली पुस्तके कायमची नष्ट होतील. हे परत आणता येणार नाही.</p>
          <button type="button" className="acc-btn acc-btn--danger" onClick={remove} disabled={!!busy}>
            <Trash2 size={18} aria-hidden /> माझे खाते हटवा
          </button>
        </section>
      </div>
    </div>
  )
}
