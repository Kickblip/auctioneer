"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Upload } from "lucide-react"
import { useSpacetimeDB } from "spacetimedb/react"
import { useAuthenticatedAction } from "@/components/spacetime-provider"
import type { PlayerRecords } from "@/app/api/players/parse/route"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

export function SpreadsheetUploadForm() {
  const router = useRouter()
  const [isNavigating, startTransition] = useTransition()
  const { isActive, connectionError } = useSpacetimeDB()
  const authenticatedAction = useAuthenticatedAction()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState("")
  const isBusy = isProcessing || isNavigating

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        aria-label="Choose a CSV file"
        disabled={isBusy || !isActive}
        className="hidden"
        onChange={async (event) => {
          const selected = event.currentTarget.files?.[0]
          event.currentTarget.value = ""
          if (!selected) return

          setError("")
          setIsProcessing(true)

          try {
            const body = new FormData()
            body.set("file", selected)
            const response = await fetch("/api/players/parse", {
              method: "POST",
              body,
            })

            if (!response.ok) {
              const result = await response.json().catch(() => null)
              throw new Error(result?.error || "Could not process the CSV.")
            }

            const { players }: PlayerRecords = await response.json()
            const lobbyId = crypto.randomUUID()
            await authenticatedAction((connection) =>
              connection.reducers.createLobby({
                lobbyId,
                players,
              })
            )

            startTransition(() => {
              router.push(`/lobby/${lobbyId}`)
            })
          } catch (error) {
            setError(
              error instanceof Error
                ? error.message
                : "Could not create the lobby."
            )
          } finally {
            setIsProcessing(false)
          }
        }}
      />

      {isBusy ? (
        <div role="status" className="flex items-center gap-2">
          <Spinner aria-hidden="true" className="size-8" />
          Creating lobby…
        </div>
      ) : (
        <Button
          type="button"
          disabled={!isActive}
          onClick={() => inputRef.current?.click()}
        >
          <Upload aria-hidden="true" />
          Upload CSV
        </Button>
      )}

      {!isActive && !connectionError && (
        <p role="status" className="text-sm text-muted-foreground">
          Connecting…
        </p>
      )}

      {(error || connectionError) && (
        <p role="alert" className="text-sm text-destructive">
          {error || "Could not connect to the database. Refresh to try again."}
        </p>
      )}
    </div>
  )
}
