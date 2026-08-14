"use client"

import { Mic } from "lucide-react"
import { cn } from "@/lib/utils"

type SpeechToTextButtonProps = {
  listening: boolean
  supported: boolean
  disabled?: boolean
  onToggle: () => void
  className?: string
}

export function SpeechToTextButton({
  listening,
  supported,
  disabled,
  onToggle,
  className,
}: SpeechToTextButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      aria-pressed={listening}
      aria-label={
        !supported
          ? "Speech to text not supported in this browser"
          : listening
            ? "Stop dictation"
            : "Dictate with microphone"
      }
      title={
        !supported
          ? "Speech to text isn’t supported in this browser"
          : listening
            ? "Stop dictation"
            : "Speak to type"
      }
      className={cn(
        "relative inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors",
        listening
          ? "bg-red-500 text-white hover:bg-red-600"
          : "text-gray-500 hover:bg-gray-100 hover:text-gray-700",
        "disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent",
        className
      )}
    >
      {listening && (
        <span
          aria-hidden
          className="absolute inset-0 animate-ping rounded-full bg-red-400/40"
        />
      )}
      <Mic className="relative size-5" />
    </button>
  )
}
