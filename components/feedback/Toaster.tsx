"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { CheckCircle2, Info, Loader2, AlertTriangle, X, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"

export type ToastType = "success" | "error" | "warning" | "info" | "loading"

export type ToastInput = {
  title: string
  description?: string
  type?: ToastType
  duration?: number
}

type ToastItem = ToastInput & {
  id: string
  type: ToastType
}

type ToastContextValue = {
  toast: (input: ToastInput) => string
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const ICONS: Record<ToastType, ReactNode> = {
  success: <CheckCircle2 className="size-5 text-emerald-600" />,
  error: <XCircle className="size-5 text-red-600" />,
  warning: <AlertTriangle className="size-5 text-amber-600" />,
  info: <Info className="size-5 text-blue-600" />,
  loading: <Loader2 className="size-5 animate-spin text-blue-600" />,
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback(
    (input: ToastInput) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const type = input.type ?? "info"
      const duration = input.duration ?? (type === "loading" ? 0 : 4000)
      setItems((prev) => [...prev, { ...input, id, type }])
      if (duration > 0) {
        window.setTimeout(() => dismiss(id), duration)
      }
      return id
    },
    [dismiss]
  )

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className={cn(
          "pointer-events-none fixed z-[100] flex flex-col gap-2",
          // Mobile: centered bottom strip with safe-area inset (avoids corner overlap)
          "inset-x-0 bottom-0 items-stretch px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
          // Desktop: bottom-right stack
          "sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-full sm:max-w-sm sm:items-stretch sm:px-0 sm:pb-0"
        )}
        aria-live="polite"
      >
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-2xl border bg-white p-3.5 shadow-lg ring-1 ring-black/5",
              "animate-in fade-in-0 duration-200",
              "slide-in-from-bottom-3 sm:slide-in-from-right-4",
              item.type === "error" && "border-red-200 bg-red-50/90",
              item.type === "success" && "border-emerald-200 bg-emerald-50/90",
              item.type === "warning" && "border-amber-200 bg-amber-50/90",
              item.type === "info" && "border-blue-200 bg-blue-50/90",
              item.type === "loading" && "border-blue-200 bg-blue-50/90"
            )}
          >
            <div className="mt-0.5 shrink-0">{ICONS[item.type]}</div>
            <div className="min-w-0 flex-1 pr-1">
              <p className="text-sm font-semibold leading-5 text-gray-900">
                {item.title}
              </p>
              {item.description && (
                <p className="mt-0.5 text-sm leading-5 text-gray-600">
                  {item.description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              className="cursor-pointer -mr-0.5 -mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-white/80 hover:text-gray-700"
              aria-label="Dismiss notification"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider")
  }
  return ctx
}
