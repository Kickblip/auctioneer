"use client"

import { useState } from "react"
import { useSpacetimeDB, useTable } from "spacetimedb/react"
import { tables } from "@/src/module_bindings"
import { useAuthenticatedAction } from "@/components/spacetime-provider"
import { Button } from "@/components/ui/button"

export function PlayerCaptain({
  playerId,
  isOwner,
}: {
  playerId: number
  isOwner: boolean
}) {
  const { isActive } = useSpacetimeDB()
  const [captains, ready] = useTable(
    tables.captain.where((row) => row.playerId.eq(playerId))
  )
  const captain = captains.find((row) => row.playerId === playerId)
  const authenticatedAction = useAuthenticatedAction()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  return (
    <div className="flex flex-col gap-2 border-t pt-4">
      <p className="text-sm font-medium">
        {captain ? "Captain" : "Player"}
        {captain && (
          <span className="ml-2 font-normal text-muted-foreground">
            {captain.clerkUserId ? "Account linked" : "Awaiting sign-in"}
          </span>
        )}
      </p>
      {isOwner && (
        <Button
          variant="outline"
          disabled={!isActive || !ready || busy}
          onClick={async () => {
            setBusy(true)
            setError("")
            try {
              await authenticatedAction((connection) =>
                connection.reducers.setPlayerCaptain({
                  playerId,
                  isCaptain: !captain,
                })
              )
            } catch (error) {
              setError(
                error instanceof Error
                  ? error.message
                  : "Could not change captain status."
              )
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy
            ? "Saving…"
            : captain
              ? "Remove captain powers"
              : "Make captain"}
        </Button>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
