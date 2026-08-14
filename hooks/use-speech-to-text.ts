"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export type SpeechToTextError =
  | "unsupported"
  | "not-allowed"
  | "audio-capture"
  | "network"
  | "unknown"

type SpeechRecognitionResultLike = {
  isFinal: boolean
  0: { transcript: string }
}

type SpeechRecognitionEventLike = {
  results: {
    length: number
    [index: number]: SpeechRecognitionResultLike
  }
}

type SpeechRecognitionLike = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function isSpeechToTextSupported(): boolean {
  return getSpeechRecognitionCtor() !== null
}

const ERROR_COPY: Record<string, [SpeechToTextError, string]> = {
  "not-allowed": [
    "not-allowed",
    "Microphone access was blocked. Allow it in your browser settings, then try again.",
  ],
  "audio-capture": [
    "audio-capture",
    "No microphone was found. Plug one in and try again.",
  ],
  network: [
    "network",
    "Speech recognition lost its connection. Check your network and try again.",
  ],
}

type Options = {
  lang?: string
  onTranscript: (text: string) => void
  onError?: (error: SpeechToTextError, message: string) => void
}

export function useSpeechToText({ lang, onTranscript, onError }: Options) {
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(false)

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const prefixRef = useRef("")
  const latestRef = useRef("")
  const wantListeningRef = useRef(false)
  const restartTimerRef = useRef<number | null>(null)
  const onTranscriptRef = useRef(onTranscript)
  const onErrorRef = useRef(onError)
  const langRef = useRef(lang)

  useEffect(() => {
    onTranscriptRef.current = onTranscript
    onErrorRef.current = onError
    langRef.current = lang
  })

  useEffect(() => {
    setSupported(isSpeechToTextSupported())
  }, [])

  const clearRestart = useCallback(() => {
    if (restartTimerRef.current != null) {
      window.clearTimeout(restartTimerRef.current)
      restartTimerRef.current = null
    }
  }, [])

  const stop = useCallback(() => {
    wantListeningRef.current = false
    clearRestart()
    setListening(false)
    try {
      recognitionRef.current?.stop()
    } catch {
      /* already stopped */
    }
  }, [clearRestart])

  const start = useCallback(
    (currentText: string) => {
      const Ctor = getSpeechRecognitionCtor()
      if (!Ctor) {
        onErrorRef.current?.(
          "unsupported",
          "Speech to text isn’t supported in this browser. Try Chrome, Edge, or Safari."
        )
        return
      }

      clearRestart()
      try {
        recognitionRef.current?.abort()
      } catch {
        /* ignore */
      }

      const trimmed = currentText.trimEnd()
      prefixRef.current = trimmed ? `${trimmed} ` : ""
      latestRef.current = currentText
      wantListeningRef.current = true

      const rec = new Ctor()
      rec.continuous = true
      rec.interimResults = true
      rec.lang = langRef.current || navigator.language || "en-US"

      rec.onresult = (event) => {
        let finals = ""
        let interim = ""
        for (let i = 0; i < event.results.length; i++) {
          const piece = event.results[i][0]?.transcript ?? ""
          if (event.results[i].isFinal) finals += piece
          else interim += piece
        }
        const next = `${prefixRef.current}${finals}${interim}`
        latestRef.current = next
        onTranscriptRef.current(next)
      }

      rec.onerror = (event) => {
        const code = event.error
        if (code === "aborted" || code === "no-speech") return
        wantListeningRef.current = false
        clearRestart()
        setListening(false)
        const mapped = ERROR_COPY[code] ?? [
          "unknown" as const,
          "Couldn't transcribe speech. Try again.",
        ]
        onErrorRef.current?.(mapped[0], mapped[1])
      }

      rec.onend = () => {
        if (!wantListeningRef.current) {
          setListening(false)
          return
        }
        // Chrome ends after a pause even with continuous=true; resume and
        // keep already-dictated text as the new prefix.
        const committed = latestRef.current.trimEnd()
        prefixRef.current = committed ? `${committed} ` : ""
        restartTimerRef.current = window.setTimeout(() => {
          restartTimerRef.current = null
          if (!wantListeningRef.current) return
          try {
            rec.start()
          } catch {
            wantListeningRef.current = false
            setListening(false)
          }
        }, 80)
      }

      recognitionRef.current = rec
      try {
        rec.start()
        setListening(true)
      } catch {
        wantListeningRef.current = false
        setListening(false)
        onErrorRef.current?.(
          "unknown",
          "Couldn't start the microphone. Try again."
        )
      }
    },
    [clearRestart]
  )

  const toggle = useCallback(
    (currentText: string) => {
      if (listening) stop()
      else start(currentText)
    },
    [listening, start, stop]
  )

  useEffect(() => {
    return () => {
      wantListeningRef.current = false
      clearRestart()
      try {
        recognitionRef.current?.abort()
      } catch {
        /* ignore */
      }
    }
  }, [clearRestart])

  return { listening, supported, start, stop, toggle }
}
