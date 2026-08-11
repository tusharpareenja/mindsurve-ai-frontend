"use client"

import { CheckCircle2, Rocket, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { StudyGenerationJob } from "@/lib/mock/study-generation"

type StudyReadyCardProps = {
  job: StudyGenerationJob
  onGoLive: () => void
  onStartWithCint: () => void
}

export function StudyReadyCard({
  job,
  onGoLive,
  onStartWithCint,
}: StudyReadyCardProps) {
  return (
    <div className="w-full max-w-md overflow-hidden rounded-xl border border-emerald-200 bg-white shadow-sm">
      <div className="px-4 py-4">
        <div className="mb-3 flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="size-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900">
              Your study is ready
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">
              <span className="font-medium text-gray-700">{job.title}</span> has
              been prepared. Choose how you want to launch response collection.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            onClick={onGoLive}
            className="cursor-pointer flex-1 bg-blue-500 text-white hover:bg-blue-600"
          >
            <Rocket className="size-4" />
            Go Live
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onStartWithCint}
            className="cursor-pointer flex-1 border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
          >
            <Users className="size-4" />
            Start with Cint
          </Button>
        </div>
      </div>
    </div>
  )
}
