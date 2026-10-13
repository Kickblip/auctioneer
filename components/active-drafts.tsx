"use client"

import Link from "next/link"
import { useSpacetimeDB, useTable } from "spacetimedb/react"
import { tables } from "@/src/module_bindings"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

export function ActiveDrafts() {
  const { isActive, connectionError } = useSpacetimeDB()
  // shortcut: all lobbies are active until a completed or archived status exists.
  const [lobbies, lobbiesReady] = useTable(tables.lobby)

  if (connectionError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Could not load drafts. Refresh to try again.
      </p>
    )
  }

  if (!isActive || !lobbiesReady) {
    return (
      <div role="status" className="flex items-center gap-2">
        <Spinner aria-hidden="true" />
        Loading drafts…
      </div>
    )
  }

  if (lobbies.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No active drafts yet. Upload a spreadsheet below to create one.
      </p>
    )
  }

  const drafts = [...lobbies].sort((a, b) =>
    Number(b.createdAt.microsSinceUnixEpoch - a.createdAt.microsSinceUnixEpoch)
  )

  return (
    <ul className="divide-y">
      {drafts.map((draft) => {
        const createdAt = draft.createdAt.toDate()

        return (
          <li
            key={draft.id}
            className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="font-medium break-all">
                Draft {draft.id.slice(0, 8)}
              </p>
              <p className="text-sm text-muted-foreground">
                Created{" "}
                <time dateTime={createdAt.toISOString()}>
                  {createdAt.toLocaleString()}
                </time>
              </p>
            </div>
            <Button asChild variant="outline" className="w-fit">
              <Link
                href={`/lobby/${draft.id}/edit`}
                aria-label={`Open draft ${draft.id}`}
              >
                Open draft
              </Link>
            </Button>
          </li>
        )
      })}
    </ul>
  )
}
