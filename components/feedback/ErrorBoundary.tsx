"use client"

import { Component, type ErrorInfo, type ReactNode } from "react"

type Props = {
  children: ReactNode
  fallback?: ReactNode
}

type State = {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (process.env.NODE_ENV === "development") {
      console.error("ErrorBoundary caught:", error, info)
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4 text-center">
            <p className="text-base font-medium text-gray-900">Something went wrong</p>
            <p className="max-w-sm text-sm text-gray-500">
              Please refresh the page. If the problem continues, try again in a moment.
            </p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false })}
              className="cursor-pointer rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600"
            >
              Try again
            </button>
          </div>
        )
      )
    }
    return this.props.children
  }
}
