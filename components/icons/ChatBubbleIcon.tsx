import { cn } from "@/lib/utils"

type IconProps = {
  className?: string
}

/** Round speech bubble — used for chats nested under a project. */
export function ChatBubbleIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("size-4 shrink-0", className)}
      aria-hidden
    >
      {/* Circular body + bottom-left tail (equal radii so it isn’t “pichka”) */}
      <path
        d="M12 3.5c4.14 0 7.5 3.36 7.5 7.5S16.14 18.5 12 18.5c-1.12 0-2.18-.25-3.13-.69L5.6 20.1a.6.6 0 0 1-.82-.72l1.55-3.7A7.47 7.47 0 0 1 4.5 11C4.5 6.86 7.86 3.5 12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  )
}
