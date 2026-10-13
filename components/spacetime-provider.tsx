"use client"

import { useCallback, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { SpacetimeDBProvider } from "spacetimedb/react"
import { DbConnection } from "@/src/module_bindings"

const host = process.env.NEXT_PUBLIC_SPACETIMEDB_HOST ?? "ws://127.0.0.1:3001"
const database =
  process.env.NEXT_PUBLIC_SPACETIMEDB_DB_NAME ?? "auctioneer-z61hw"
const tokenKey = `spacetimedb:${host}:${database}:token`

export function SpacetimeProvider({ children }: { children: React.ReactNode }) {
  // Keep the anonymous read connection stable, including legacy ownership tokens.
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

export function useAuthenticatedAction() {
  const { getToken } = useAuth()

  // Each write gets a fresh Clerk token without interrupting public subscriptions.
  return useCallback(
    async (action: (connection: DbConnection) => Promise<void>) => {
      const token = await getToken({ skipCache: true })
      if (!token) throw new Error("Sign in to continue.")

      await new Promise<void>((resolve, reject) => {
        let connection: DbConnection | undefined
        let settled = false
        const finish = (error?: unknown) => {
          if (settled) return
          settled = true
          clearTimeout(timeout)
          connection?.disconnect()
          if (error) reject(error)
          else resolve()
        }
        const timeout = setTimeout(
          () =>
            finish(
              new Error(
                "The request timed out. Refresh to check its status before retrying."
              )
            ),
          20000
        )
        try {
          connection = DbConnection.builder()
            .withUri(host)
            .withDatabaseName(database)
            .withToken(token)
            .onConnect(async (connected) => {
              try {
                await action(connected)
                finish()
              } catch (error) {
                finish(error)
              }
            })
            .onConnectError((_ctx, error) => finish(error))
            .onDisconnect((_ctx, error) =>
              finish(
                error ?? new Error("Disconnected before the request completed.")
              )
            )
            .build()
        } catch (error) {
          finish(error)
        }
      })
    },
    [getToken]
  )
}
