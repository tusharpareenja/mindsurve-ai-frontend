"use client"

import { AlertTriangle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const FIELD_LABELS: Record<string, string> = {
  title: "Title",
  background: "Background",
  language: "Language",
  study_type: "Study type",
  main_question: "Main question",
  orientation_text: "Orientation",
  rating_scale: "Rating scale",
  categories: "Categories / elements",
  classification_questions: "Screening questions",
  audience: "Audience",
}

type RegenerateWarningDialogProps = {
  open: boolean
  changedFields: string[]
  message?: string
  confirming?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function RegenerateWarningDialog({
  open,
  changedFields,
  message,
  confirming = false,
  onCancel,
  onConfirm,
}: RegenerateWarningDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !confirming) onCancel()
      }}
    >
      <DialogContent className="max-w-md" showCloseButton={!confirming}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-amber-500" />
            Apply changes and regenerate tasks?
          </DialogTitle>
          <DialogDescription>
            {message ||
              "Your statements are already used in generated tasks. To apply these changes, the previous tasks must be replaced and regenerated."}
          </DialogDescription>
        </DialogHeader>

        {changedFields.length > 0 && (
          <ul className="rounded-xl border border-amber-100 bg-amber-50/70 px-3 py-2.5 text-sm text-amber-950">
            {changedFields.map((field) => (
              <li key={field} className="list-inside list-disc">
                {FIELD_LABELS[field] || field}
              </li>
            ))}
          </ul>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={confirming}
            className="cursor-pointer disabled:cursor-not-allowed"
          >
            Cancel changes
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={confirming}
            className="cursor-pointer bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed"
          >
            {confirming ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Regenerating…
              </>
            ) : (
              "Apply & regenerate"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
