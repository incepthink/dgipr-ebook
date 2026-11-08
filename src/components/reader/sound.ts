'use client'

/**
 * A paper page-turn, synthesised: a short burst of filtered noise whose band
 * sweeps up as the sheet lifts, then a soft low thump as it lands. No asset to
 * download, and it can't fail to load.
 */
let ctx: AudioContext | null = null
let noise: AudioBuffer | null = null

function context(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  ctx ??= new AC()
  if (!noise) {
    const len = Math.floor(ctx.sampleRate * 0.6)
    noise = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = noise.getChannelData(0)
    let last = 0
    for (let i = 0; i < len; i++) {
      // Slightly brown noise: paper, not static.
      last = (last + 0.06 * (Math.random() * 2 - 1)) / 1.06
      d[i] = last * 3.2 + (Math.random() * 2 - 1) * 0.25
    }
  }
  return ctx
}

export function playFlip() {
  const ac = context()
  if (!ac || !noise) return
  if (ac.state === 'suspended') void ac.resume()
  const t = ac.currentTime
  const dur = 0.42 + Math.random() * 0.08

  const src = ac.createBufferSource()
  src.buffer = noise
  src.playbackRate.value = 0.9 + Math.random() * 0.2

  const band = ac.createBiquadFilter()
  band.type = 'bandpass'
  band.Q.value = 0.8
  band.frequency.setValueAtTime(700, t)
  band.frequency.exponentialRampToValueAtTime(3800, t + dur * 0.55)
  band.frequency.exponentialRampToValueAtTime(1400, t + dur)

  const gain = ac.createGain()
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(0.32, t + 0.05)
  gain.gain.setValueAtTime(0.3, t + dur * 0.5)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)

  src.connect(band).connect(gain).connect(ac.destination)
  src.start(t)
  src.stop(t + dur + 0.05)

  // The landing.
  const thump = ac.createOscillator()
  thump.type = 'sine'
  thump.frequency.setValueAtTime(120, t + dur * 0.8)
  thump.frequency.exponentialRampToValueAtTime(60, t + dur + 0.08)
  const tg = ac.createGain()
  tg.gain.setValueAtTime(0.0001, t + dur * 0.8)
  tg.gain.exponentialRampToValueAtTime(0.06, t + dur * 0.85)
  tg.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.1)
  thump.connect(tg).connect(ac.destination)
  thump.start(t + dur * 0.8)
  thump.stop(t + dur + 0.12)
}
