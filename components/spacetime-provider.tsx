"use client"

import { useState } from "react"
import { SpacetimeDBProvider } from "spacetimedb/react"
import { DbConnection } from "@/src/module_bindings"

const host = process.env.NEXT_PUBLIC_SPACETIMEDB_HOST ?? "ws://127.0.0.1:3001"
const database =
  process.env.NEXT_PUBLIC_SPACETIMEDB_DB_NAME ?? "auctioneer-z61hw"
const tokenKey = `spacetimedb:${host}:${database}:token`

export function SpacetimeProvider({ children }: { children: React.ReactNode }) {
  // shortcut: ownership uses a browser identity; link Clerk before cross-device hosting.
  const [connectionBuilder] = useState(() =>
    DbConnection.builder()
      .withUri(host)
      .withDatabaseName(database)
      .withToken(
        typeof window === "undefined"
          ? undefined
          : (localStorage.getItem(tokenKey) ?? undefined)
      )
      .onConnect((_connection, _identity, token) => {
        localStorage.setItem(tokenKey, token)
      })
  )

  return (
    <SpacetimeDBProvider connectionBuilder={connectionBuilder}>
      {children}
    </SpacetimeDBProvider>
  )
}
