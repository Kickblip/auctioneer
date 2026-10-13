"use client"

import { createContext, useContext, useState } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { SignInButton, UserButton, useAuth } from "@clerk/nextjs"
import { useReducer, useSpacetimeDB, useTable } from "spacetimedb/react"
import { reducers, tables } from "@/src/module_bindings"
import { Button } from "@/components/ui/button"
import { useAuthenticatedAction } from "@/components/spacetime-provider"
import {
  activeLobbyRole,
  type DraftRole,
  type JoinedRole,
} from "@/lib/lobby-role"

const LobbyRoleContext = createContext<{
  role: DraftRole
  changeRole: () => void
} | null>(null)

export function useLobbyRole() {
  const context = useContext(LobbyRoleContext)
  if (!context) throw new Error("Lobby role is only available inside a lobby.")
  return context
}

export function LobbyAccess({
  lobbyId,
  children,
}: {
  lobbyId: string
  children: React.ReactNode
}) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const { isLoaded, userId } = useAuth()
  const { identity, isActive, connectionError } = useSpacetimeDB()
  const authenticatedAction = useAuthenticatedAction()
  const linkLegacyOwner = useReducer(reducers.linkLegacyLobbyOwner)
  const [lobbies, lobbiesReady] = useTable(
    tables.lobby.where((row) => row.id.eq(lobbyId))
  )
  const [captains, captainsReady] = useTable(
    tables.captain.where((row) => row.lobbyId.eq(lobbyId))
  )
  const [players, playersReady] = useTable(
    tables.lobbyPlayer
      .where((row) => row.lobbyId.eq(lobbyId))
      .rightSemijoin(tables.player, (member, player) =>
        member.playerId.eq(player.id)
      )
  )
  const [choice, setChoice] = useState<DraftRole>(() => {
    const requested = searchParams.get("role")
    return requested === "Owner" || requested === "Captain"
      ? requested
      : "Spectator"
  })
  const [playerId, setPlayerId] = useState(searchParams.get("captain") ?? "")
  const [joined, setJoined] = useState<JoinedRole | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const lobby = lobbies.find((row) => row.id === lobbyId)
  const assignedCaptains = captains.filter((row) => row.lobbyId === lobbyId)
  const returnUrl = `${pathname}?${new URLSearchParams({ role: choice, captain: playerId })}`
  const role = activeLobbyRole(
    joined,
    isLoaded ? userId : null,
    lobby,
    assignedCaptains
  )

  if (connectionError)
    return (
      <p role="alert" className="p-8">
        Could not connect to the lobby. Refresh to try again.
      </p>
    )
  if (!isActive || !lobbiesReady || !captainsReady || !playersReady)
    return (
      <p role="status" className="p-8">
        Loading lobby…
      </p>
    )
  if (!lobby)
    return (
      <div className="p-8">
        <p>Lobby not found.</p>
        <Link href="/" className="underline">
          Back to drafts
        </Link>
      </div>
    )

  if (role) {
    return (
      <LobbyRoleContext
        value={{
          role,
          changeRole: () => {
            setJoined(null)
            setError("")
          },
        }}
      >
        {children}
      </LobbyRoleContext>
    )
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="flex w-full max-w-md flex-col gap-6 rounded-lg border bg-sidebar p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Join draft</h1>
            <p className="text-sm text-muted-foreground">
              Draft {lobbyId.slice(0, 8)}
            </p>
          </div>
          {userId && <UserButton />}
        </div>
        <fieldset disabled={busy} className="flex flex-col gap-3">
          <legend className="mb-3 font-medium">How are you joining?</legend>
          {(["Spectator", "Captain", "Owner"] as const).map((option) => (
            <label
              key={option}
              className="flex cursor-pointer items-center gap-3 rounded-md border p-3 has-checked:border-primary"
            >
              <input
                type="radio"
                name="draft-role"
                value={option}
                checked={choice === option}
                onChange={() => {
                  setChoice(option)
                  setError("")
                }}
              />
              <span>{option}</span>
            </label>
          ))}
        </fieldset>
        {choice === "Spectator" && (
          <p className="text-sm text-muted-foreground">
            Watch the draft without signing in.
          </p>
        )}
        {choice === "Owner" && (
          <p className="text-sm text-muted-foreground">
            Sign in with the account that owns this draft.
            {!lobby.ownerClerkId &&
              " For this existing draft, use the browser that created it to link your account once."}
          </p>
        )}
        {choice === "Captain" && (
          <div className="flex flex-col gap-2">
            <label htmlFor="captain-player" className="text-sm font-medium">
              Which captain are you?
            </label>
            <select
              id="captain-player"
              value={playerId}
              disabled={busy}
              onChange={(event) => {
                setPlayerId(event.target.value)
                setError("")
              }}
              className="w-full rounded-md border bg-background p-2"
            >
              <option value="">Select your player</option>
              {assignedCaptains.map((captain) => {
                const player = players.find(
                  (row) => row.id === captain.playerId
                )
                return (
                  <option
                    key={captain.playerId}
                    value={captain.playerId}
                    disabled={
                      !!userId &&
                      !!captain.clerkUserId &&
                      captain.clerkUserId !== userId
                    }
                  >
                    {player
                      ? `${player.riotIdGameName}#${player.riotIdTagline} (${player.name})`
                      : `Player ${captain.playerId}`}
                    {captain.clerkUserId && captain.clerkUserId !== userId
                      ? userId
                        ? " — already claimed"
                        : " — sign in to rejoin"
                      : ""}
                  </option>
                )
              })}
            </select>
            <p className="text-sm text-muted-foreground">
              {assignedCaptains.length
                ? "Select your player, then sign in to link your account. A claimed captain can only be used by that account."
                : "The owner has not assigned any captains yet."}
            </p>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {joined && joined.role !== "Spectator" && !error && (
          <p role="status" className="text-sm text-muted-foreground">
            Your account or role changed. Join again to continue.
          </p>
        )}
        {choice !== "Spectator" && !userId ? (
          <SignInButton
            mode="modal"
            forceRedirectUrl={returnUrl}
            signUpForceRedirectUrl={returnUrl}
          >
            <Button disabled={!isLoaded || (choice === "Captain" && !playerId)}>
              Sign in as {choice.toLowerCase()}
            </Button>
          </SignInButton>
        ) : (
          <Button
            disabled={busy || (choice === "Captain" && !playerId)}
            onClick={async () => {
              setError("")
              if (choice === "Spectator") {
                setJoined({ role: choice })
                return
              }
              if (!userId) return
              setBusy(true)
              try {
                if (choice === "Owner") {
                  if (
                    !lobby.ownerClerkId &&
                    identity &&
                    lobby.owner.isEqual(identity)
                  ) {
                    await linkLegacyOwner({ lobbyId, clerkUserId: userId })
                  }
                  await authenticatedAction((connection) =>
                    connection.reducers.joinAsOwner({ lobbyId })
                  )
                } else {
                  await authenticatedAction((connection) =>
                    connection.reducers.joinAsCaptain({
                      lobbyId,
                      playerId: Number(playerId),
                    })
                  )
                }
                setJoined({
                  role: choice,
                  userId,
                  playerId: choice === "Captain" ? Number(playerId) : undefined,
                })
              } catch (error) {
                setError(
                  error instanceof Error
                    ? error.message
                    : "Could not join this draft."
                )
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy ? "Joining…" : `Join as ${choice.toLowerCase()}`}
          </Button>
        )}
        <Link href="/" className="text-center text-sm underline">
          Back to drafts
        </Link>
      </div>
    </main>
  )
}
