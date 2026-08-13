"use client"

import { useEffect, useState } from "react"
import { Plus } from "lucide-react"
import { AppShell, useCreateProjectModal } from "@/components/layout/AppShell"
import { AuthGate } from "@/components/auth/AuthGate"
import { Skeleton } from "@/components/feedback/Skeleton"
import { useAuth } from "@/context/AuthContext"
import { useProjects } from "@/context/ProjectsContext"
import { DEFAULT_GREETING, getGreeting, type Greeting } from "@/lib/greeting"

export default function WelcomePage() {
  return (
    <AuthGate requireAuth>
      <WelcomeShell />
    </AuthGate>
  )
}

function WelcomeShell() {
  const { user } = useAuth()
  const { isLoading } = useProjects()

  return (
    <AppShell>
      {isLoading ? (
        <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
          <Skeleton className="h-10 w-64 sm:w-80" />
          <Skeleton className="mt-4 h-4 w-48" />
          <Skeleton className="mt-8 h-12 w-48 rounded-lg" />
        </main>
      ) : (
        <WelcomeMain userName={user?.name?.split(" ")[0] || "there"} />
      )}
    </AppShell>
  )
}

function WelcomeMain({ userName }: { userName: string }) {
  const openCreate = useCreateProjectModal()
  const [greeting, setGreeting] = useState<Greeting>(DEFAULT_GREETING)

  useEffect(() => {
    setGreeting(getGreeting())
  }, [])

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl text-center animate-in fade-in-0 slide-in-from-bottom-4 duration-700">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl md:text-5xl lg:text-6xl">
          {greeting.pre} <span className="text-blue-500">{userName}</span>
          {greeting.post}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-gray-500 sm:text-base">
          Give us your idea. We handle the rest.
        </p>

        <div className="mt-8 sm:mt-10">
          <button
            type="button"
            onClick={openCreate}
            className="cursor-pointer inline-flex items-center gap-2 rounded-lg bg-blue-500 px-5 py-3 text-sm font-medium text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-600 active:scale-[0.98] sm:text-base"
          >
            <Plus className="size-5" />
            Create a new project
          </button>
        </div>
      </div>
    </main>
  )
}
