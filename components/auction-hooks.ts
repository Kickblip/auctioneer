"use client"
import { useCallback, useEffect, useState } from "react"
import { useSpacetimeDB } from "spacetimedb/react"
import { DbConnection } from "@/src/module_bindings"
import { useAuthenticatedAction } from "@/components/spacetime-provider"

export function useAuctionMutation() {
  const authenticate = useAuthenticatedAction()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const run = useCallback(
    async (action: (connection: DbConnection) => Promise<void>) => {
      setBusy(true)
      setError("")
      try {
        await authenticate(action)
        return true
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "The action failed. Please try again."
        )
        return false
      } finally {
        setBusy(false)
      }
    },
    [authenticate]
  )
  return { run, busy, error }
}

export function useServerClock() {
  const { getConnection, isActive } = useSpacetimeDB()
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    if (!isActive) return
    let alive = true
    let anchor: { server: number; local: number } | null = null
    const sync = async () => {
      const connection = getConnection() as DbConnection | null
      if (!connection) return
      const sent = performance.now()
      try {
        const server = await connection.procedures.serverTime({})
        if (!alive) return
        const received = performance.now()
        anchor = { server: server + (received - sent) / 2, local: received }
        setNow(anchor.server)
      } catch {
        /* Retry while keeping the last synchronized clock. */
      }
    }
    void sync()
    const resync = setInterval(sync, 10000)
    const timer = setInterval(() => {
      if (anchor) setNow(anchor.server + performance.now() - anchor.local)
    }, 100)
    return () => {
      alive = false
      clearInterval(resync)
      clearInterval(timer)
    }
  }, [getConnection, isActive])
  return now
}
