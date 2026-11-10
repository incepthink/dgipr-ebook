'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { speechChunks, type TextBlock } from './bookText'

export type SpeechStatus = 'idle' | 'playing' | 'paused'

/** Marathi first; Hindi voices read Devanagari well enough; else the default. */
function pickVoice(): SpeechSynthesisVoice | null {
  const voices = typeof speechSynthesis !== 'undefined' ? speechSynthesis.getVoices() : []
  const by = (p: string) => voices.filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith(p))
  const prefer = (list: SpeechSynthesisVoice[]) => list.find((v) => !v.localService) ?? list[0]
  return prefer(by('mr')) ?? prefer(by('hi')) ?? null
}

/**
 * Reads the book aloud with the device's own text-to-speech: free, offline
 * where the voice is installed, nothing sent to a server. Blocks are spoken
 * in order in short chunks; `onBlock` follows along (to scroll or turn pages).
 */
export function useReadAloud(blocks: TextBlock[], rate: number, onBlock: (block: TextBlock) => void) {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const [status, setStatus] = useState<SpeechStatus>('idle')
  const [index, setIndex] = useState(-1)
  const [voiceLang, setVoiceLang] = useState<'mr' | 'hi' | 'other' | null>(null)

  const idx = useRef(-1)
  const chunk = useRef(0)
  const token = useRef(0)
  const voice = useRef<SpeechSynthesisVoice | null>(null)
  const rateRef = useRef(rate)
  rateRef.current = rate
  const onBlockRef = useRef(onBlock)
  onBlockRef.current = onBlock
  const blocksRef = useRef(blocks)
  blocksRef.current = blocks

  useEffect(() => {
    if (!supported) return
    const choose = () => {
      voice.current = pickVoice()
      const l = voice.current?.lang.toLowerCase() ?? ''
      setVoiceLang(l.startsWith('mr') ? 'mr' : l.startsWith('hi') ? 'hi' : speechSynthesis.getVoices().length ? 'other' : null)
    }
    choose()
    speechSynthesis.addEventListener('voiceschanged', choose)
    return () => {
      speechSynthesis.removeEventListener('voiceschanged', choose)
      speechSynthesis.cancel()
    }
  }, [supported])

  const speak = useCallback(() => {
    const list = blocksRef.current
    // Skip blocks with nothing to say (photos without captions).
    while (idx.current < list.length && !list[idx.current]?.text) {
      idx.current++
      chunk.current = 0
    }
    if (idx.current >= list.length) {
      setStatus('idle')
      setIndex(-1)
      return
    }
    const block = list[idx.current]
    const parts = speechChunks(block.text)
    if (chunk.current === 0) {
      setIndex(idx.current)
      onBlockRef.current(block)
    }
    const my = ++token.current
    const u = new SpeechSynthesisUtterance(parts[chunk.current] ?? '')
    if (voice.current) u.voice = voice.current
    u.lang = voice.current?.lang ?? 'mr-IN'
    u.rate = rateRef.current
    const advance = () => {
      if (my !== token.current) return // stopped, paused or jumped meanwhile
      chunk.current++
      if (chunk.current >= parts.length) {
        idx.current++
        chunk.current = 0
      }
      speak()
    }
    u.onend = advance
    u.onerror = (e) => {
      if (e.error === 'interrupted' || e.error === 'canceled') return
      advance()
    }
    speechSynthesis.speak(u)
  }, [])

  const playFrom = useCallback(
    (i: number) => {
      if (!supported) return
      token.current++
      speechSynthesis.cancel()
      idx.current = Math.max(0, Math.min(i, blocksRef.current.length - 1))
      chunk.current = 0
      setStatus('playing')
      // Chrome drops a speak() issued in the same tick as cancel().
      setTimeout(speak, 60)
    },
    [speak, supported],
  )

  // Pausing cancels and remembers the chunk: speechSynthesis.pause() is unreliable on Android.
  const pause = useCallback(() => {
    token.current++
    speechSynthesis.cancel()
    setStatus('paused')
  }, [])

  const resume = useCallback(() => {
    setStatus('playing')
    setTimeout(speak, 60)
  }, [speak])

  const stop = useCallback(() => {
    token.current++
    if (supported) speechSynthesis.cancel()
    setStatus('idle')
    setIndex(-1)
  }, [supported])

  /** Jump to the next or previous block that has something to say. */
  const skip = useCallback(
    (dir: 1 | -1) => {
      const list = blocksRef.current
      let i = idx.current + dir
      while (i >= 0 && i < list.length && !list[i].text) i += dir
      if (i < 0 || i >= list.length) return
      playFrom(i)
    },
    [playFrom],
  )

  // A new speed applies from the next chunk; restart the current one so it is heard now.
  useEffect(() => {
    if (status === 'playing') {
      token.current++
      speechSynthesis.cancel()
      setTimeout(speak, 60)
    }
    // Only when the rate changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rate])

  return { supported, status, index, voiceLang, playFrom, pause, resume, stop, skip }
}
