import { cn } from "@/lib/utils"

type IconProps = {
  className?: string
}

/** Open folder — used for projects (distinct from chat bubbles). */
export function ProjectFolderIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("size-4", className)}
      aria-hidden
    >
      <path
        d="M3.5 8.5V7.2c0-.94.76-1.7 1.7-1.7h4.05c.4 0 .78.14 1.08.4l1.24 1.05c.3.26.68.4 1.08.4H18.8c.94 0 1.7.76 1.7 1.7v.45"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.75 9.25h16.5c.69 0 1.22.6 1.12 1.28l-1.15 8.1A1.75 1.75 0 0 1 18.5 20H5.5a1.75 1.75 0 0 1-1.72-1.37l-1.15-8.1a1.15 1.15 0 0 1 1.12-1.28Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  )
}
