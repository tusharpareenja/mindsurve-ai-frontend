"use client"

import { SessionProvider } from "next-auth/react"
import { ToastProvider } from "@/components/feedback/Toaster"
import { ErrorBoundary } from "@/components/feedback/ErrorBoundary"
import { AuthProvider } from "@/context/AuthContext"
import { ProjectsProvider } from "@/context/ProjectsContext"
import { ChatActivityProvider } from "@/context/ChatActivityContext"
import { ChatsProvider } from "@/context/ChatsContext"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ToastProvider>
        <AuthProvider>
          <ProjectsProvider>
            <ChatActivityProvider>
              <ChatsProvider>
                <ErrorBoundary>{children}</ErrorBoundary>
              </ChatsProvider>
            </ChatActivityProvider>
          </ProjectsProvider>
        </AuthProvider>
      </ToastProvider>
    </SessionProvider>
  )
}
