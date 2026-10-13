"use client"

import { useState } from "react"
import { useSpacetimeDB } from "spacetimedb/react"
import { useAuthenticatedAction } from "@/components/spacetime-provider"
import type { Player } from "@/src/module_bindings/types"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

export function PlayerAdminNotes({
  player,
  isOwner,
}: {
  player: Player
  isOwner: boolean
}) {
  const { isActive } = useSpacetimeDB()
  const authenticatedAction = useAuthenticatedAction()
  const [draft, setDraft] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const notes = isOwner ? (draft ?? player.adminNotes) : player.adminNotes

  return (
    <form
      className="mt-8 flex flex-col gap-2"
      onSubmit={async (event) => {
        event.preventDefault()
        if (!isOwner || !isActive || isSaving) return

        setIsSaving(true)
        setError("")
        try {
          await authenticatedAction((connection) =>
            connection.reducers.updatePlayerAdminNotes({
              playerId: player.id,
              adminNotes: notes,
            })
          )
          setDraft(null)
        } catch (error) {
          setError(
            error instanceof Error
              ? error.message
              : "Could not save admin notes."
          )
        } finally {
          setIsSaving(false)
        }
      }}
    >
      <div className="flex items-center justify-between">
        <label htmlFor="admin-notes" className="text-sm font-medium">
          Admin Notes
        </label>
        {!isOwner && (
          <span className="text-xs font-medium text-muted-foreground italic">
            Read Only
          </span>
        )}
      </div>
      <Textarea
        id="admin-notes"
        value={notes}
        onChange={(event) => {
          setDraft(event.target.value)
          setError("")
        }}
        readOnly={!isOwner}
        disabled={isOwner && (!isActive || isSaving)}
        maxLength={5000}
        placeholder={
          isOwner ? "Add notes about this player…" : "No admin notes yet."
        }
      />
      {isOwner && (
        <Button
          type="submit"
          disabled={!isActive || isSaving || notes === player.adminNotes}
          className="self-end"
        >
          {isSaving ? "Saving…" : "Save notes"}
        </Button>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  )
}
