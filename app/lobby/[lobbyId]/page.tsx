"use client"
import { use, useMemo, useState, type PointerEvent } from "react"
import Link from "next/link"
import Image from "next/image"
import { UserButton, useAuth } from "@clerk/nextjs"
import { useSpacetimeDB, useTable } from "spacetimedb/react"
import { Blobatar } from "@blobatar/react"
import { tables } from "@/src/module_bindings"
import { Button } from "@/components/ui/button"
import { useLobbyRole } from "@/components/lobby-access"
import { AuctionTeam, teamRoleIcons } from "@/components/auction-team"
import { AuctionBidding } from "@/components/auction-bidding"
import { AuctionProfile } from "@/components/auction-profile"
import { AuctionAdmin, AuctionSetup } from "@/components/auction-admin"
import { useServerClock } from "@/components/auction-hooks"
import { FillRoleIcon } from "@/lib/icons"
import {
  defaultRankRules,
  rankOrder,
  remainingDisplayMs,
  type Auction,
} from "@/lib/auction/rules"
import {
  money,
  auctionPlayer,
  rankName,
  rankColors,
} from "@/lib/auction/presentation"
import { getLobbyPlayers, roleLabel } from "./edit/players"

const roleIcons = { ...teamRoleIcons, Fill: FillRoleIcon }

export default function Page({
  params,
}: {
  params: Promise<{ lobbyId: string }>
}) {
  const { lobbyId } = use(params)
  const { role, changeRole } = useLobbyRole()
  const isOwner = role === "Owner"
  const { userId } = useAuth()
  const { isActive, connectionError } = useSpacetimeDB()
  const [auctionRows, auctionReady] = useTable(
    tables.auction.where((row) => row.lobbyId.eq(lobbyId))
  )
  const [captainRows, captainsReady] = useTable(
    tables.captain.where((row) => row.lobbyId.eq(lobbyId))
  )
  const [logs] = useTable(
    tables.auctionLog.where((row) => row.lobbyId.eq(lobbyId))
  )
  const membershipQuery = tables.lobbyPlayer.where((row) =>
    row.lobbyId.eq(lobbyId)
  )
  const [memberships, membershipsReady] = useTable(membershipQuery)
  const [players, playersReady] = useTable(
    membershipQuery.rightSemijoin(tables.player, (member, player) =>
      member.playerId.eq(player.id)
    )
  )
  const roster = useMemo(
    () => getLobbyPlayers(lobbyId, players, memberships),
    [lobbyId, players, memberships]
  )
  const state = useMemo<Auction | null>(() => {
    const row = auctionRows.find((row) => row.lobbyId === lobbyId)
    return row ? JSON.parse(row.state) : null
  }, [auctionRows, lobbyId])
  const captains = captainRows.filter((row) => row.lobbyId === lobbyId)
  const captain =
    role === "Captain"
      ? captains.find((row) => row.clerkUserId === userId)
      : undefined
  const myTeam = state?.teams.find(
    (team) => team.captainPlayerId === captain?.playerId
  )
  const [selection, setSelection] = useState<{
    playerId: number
    nominationId?: number
  } | null>(null)
  const nominationId = state?.nomination?.id
  const selectedPlayerId =
    nominationId && selection?.nominationId !== nominationId
      ? state?.nomination?.playerId
      : selection?.playerId
  const selected = roster.find((player) => player.id === selectedPlayerId)
  const selectPlayer = (playerId: number) =>
    setSelection({ playerId, nominationId })
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState("rank")
  const [descending, setDescending] = useState(true)
  const [poolWidth, setPoolWidth] = useState(320)
  const [profileWidth, setProfileWidth] = useState(320)
  const now = useServerClock()
  const rules = state?.settings.rankRules ?? defaultRankRules
  const sold = new Set(
    state?.teams.flatMap((team) => team.roster.map((slot) => slot.playerId)) ??
      captains.map((row) => row.playerId)
  )
  const pool = roster.filter(
    (player) =>
      !sold.has(player.id) && player.id !== state?.nomination?.playerId
  )
  const query = search.trim().toLowerCase()
  const filtered = pool
    .filter((player) =>
      [
        player.name,
        player.discord,
        `${player.riotIdGameName}#${player.riotIdTagline}`,
      ].some((name) => name.toLowerCase().includes(query))
    )
    .sort((a, b) => {
      const compare =
        sort === "rank"
          ? rankOrder(auctionPlayer(a).peakRank) -
            rankOrder(auctionPlayer(b).peakRank)
          : sort === "role"
            ? (a.mainRole?.tag ?? "").localeCompare(b.mainRole?.tag ?? "")
            : a.riotIdGameName.localeCompare(b.riotIdGameName)
      return (
        (descending ? -compare : compare) ||
        a.riotIdGameName.localeCompare(b.riotIdGameName)
      )
    })
  const teams = [...(state?.teams ?? [])].sort(
    (a, b) => Number(b.id === myTeam?.id) - Number(a.id === myTeam?.id)
  )
  const ready =
    auctionReady && playersReady && membershipsReady && captainsReady
  const dragResize = (
    event: PointerEvent<HTMLDivElement>,
    side: "pool" | "profile"
  ) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    const delta = event.movementX * (side === "pool" ? 1 : -1)
    ;(side === "pool" ? setPoolWidth : setProfileWidth)((width) =>
      Math.min(600, Math.max(240, width + delta))
    )
  }
  return (
    <div className="flex h-dvh w-full overflow-x-auto overflow-y-hidden">
      <aside className="flex w-36 shrink-0 flex-col items-start gap-4 border-r bg-sidebar p-4">
        <Link href="/" className="text-sm font-semibold">
          Auctioneer
        </Link>
        <UserButton />
        <p className="text-xs">
          Role: <strong>{role}</strong>
        </p>
        <Button variant="ghost" size="sm" onClick={changeRole}>
          Change role
        </Button>
        {myTeam && (
          <div className="text-sm">
            <p className="font-medium">My wallet</p>
            <p className="text-lg font-bold">{money(myTeam.balance)}</p>
            <p className="text-xs text-muted-foreground">
              Initial {money(myTeam.initialBalance)}
            </p>
          </div>
        )}
        <p
          role="status"
          className={`mt-auto text-xs ${isActive ? "text-muted-foreground" : "text-destructive"}`}
        >
          {isActive ? "Live" : "Disconnected — reconnecting…"}
        </p>
      </aside>
      <aside
        className="flex shrink-0 flex-col bg-sidebar"
        style={{ width: poolWidth }}
      >
        <div className="flex shrink-0 flex-col gap-2 border-b p-4">
          <h2 className="text-sm font-medium">Player Pool · {pool.length}</h2>
          <input
            type="search"
            aria-label="Search players"
            placeholder="Type to search..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-md bg-secondary px-4 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex gap-2">
            <select
              aria-label="Sort player pool"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              className="min-w-0 flex-1 rounded border bg-background p-1 text-sm"
            >
              <option value="rank">Effective peak rank</option>
              <option value="alphabetical">Alphabetical</option>
              <option value="role">Primary role</option>
            </select>
            <Button
              size="sm"
              variant="outline"
              aria-label={
                descending
                  ? "Switch to ascending sort"
                  : "Switch to descending sort"
              }
              onClick={() => setDescending(!descending)}
            >
              {descending ? "↓" : "↑"}
            </Button>
          </div>
        </div>
        <ul
          aria-label="Player pool"
          tabIndex={0}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        >
          {filtered.map((player) => {
            const rank = rankName(auctionPlayer(player).peakRank)

            return (
              <li key={player.id} className="border-b">
                <button
                  type="button"
                  onClick={() => selectPlayer(player.id)}
                  aria-pressed={selected?.id === player.id}
                  aria-label={`${player.riotIdGameName}#${player.riotIdTagline}`}
                  className="flex w-full items-center gap-2 p-2 text-left hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring aria-pressed:bg-sidebar-accent"
                >
                  <span className="shrink-0 bg-secondary">
                    <Blobatar name={player.riotIdGameName} size={64} />
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-lg font-medium">
                      {player.riotIdGameName}
                    </span>
                    <span className="flex flex-wrap items-center gap-2.5">
                      {[player.mainRole, player.secondaryRole].map(
                        (role, index) => {
                          const RoleIcon = role ? roleIcons[role.tag] : null
                          const label = `${index === 0 ? "Primary" : "Secondary"} role: ${roleLabel(role)}`

                          return (
                            <span
                              key={index}
                              role="img"
                              aria-label={label}
                              title={label}
                            >
                              {RoleIcon ? (
                                <RoleIcon className="h-6.5 w-6.5 bg-secondary p-0.5" />
                              ) : (
                                <span className="bg-secondary px-1 py-0.5 text-xs">
                                  {roleLabel(role)}
                                </span>
                              )}
                            </span>
                          )
                        }
                      )}
                      <span
                        title={`Effective peak rank: ${rank}`}
                        className="flex items-center gap-1 bg-secondary px-2 py-0.5"
                      >
                        {rank !== "Unranked" && (
                          <Image
                            src={`/icons/rank/small/${rank.split(" ")[0].toUpperCase()}.webp`}
                            alt=""
                            width={24}
                            height={24}
                          />
                        )}
                        <span className="text-xs font-semibold">{rank}</span>
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        {ready && filtered.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">
            No matching players in the pool.
          </p>
        )}
        <div className="max-h-[45dvh] shrink-0 overflow-y-auto border-t">
          {state && myTeam ? (
            <AuctionTeam
              lobbyId={lobbyId}
              state={state}
              team={myTeam}
              players={roster}
              canEdit
              isOwner={false}
              own
              onSelect={selectPlayer}
            />
          ) : (
            <div className="p-4">
              <h2 className="text-sm font-semibold">My Team</h2>
              <p className="mt-2 text-xs text-muted-foreground">
                {role === "Captain"
                  ? "The owner has not configured your team yet."
                  : "Join as a captain to see your roster."}
              </p>
            </div>
          )}
        </div>
      </aside>
      <div
        role="separator"
        aria-label="Resize player pool"
        aria-orientation="vertical"
        aria-valuenow={poolWidth}
        aria-valuemin={240}
        aria-valuemax={600}
        tabIndex={0}
        className="w-1 shrink-0 cursor-col-resize touch-none bg-border hover:bg-primary focus-visible:bg-primary"
        onPointerDown={(event) =>
          event.currentTarget.setPointerCapture(event.pointerId)
        }
        onPointerMove={(event) => dragResize(event, "pool")}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault()
            setPoolWidth((width) =>
              Math.max(
                240,
                Math.min(600, width + (event.key === "ArrowRight" ? 20 : -20))
              )
            )
          }
        }}
      />
      <main className="flex min-w-[40rem] flex-1 flex-col overflow-y-auto">
        <header className="sticky top-0 z-10 flex flex-col gap-2 border-b bg-background p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="font-semibold">
              {state?.settings.name ?? "Coven Auction"}
            </h1>
            <span className="text-sm">
              {state
                ? `Round ${state.round || "—"}${state.round > 4 ? " · extra round" : " / 4"}`
                : "Event setup"}
              {state && ["reveal", "bidding", "break"].includes(state.phase)
                ? ` · ${now === null ? "Syncing…" : Math.ceil(remainingDisplayMs(state, now) / 1000) + "s"}`
                : ""}
            </span>
          </div>
          {state?.paused && (
            <p
              role="alert"
              className="font-semibold text-amber-700 dark:text-amber-300"
            >
              Auction paused
            </p>
          )}
          <div
            className="flex flex-wrap gap-x-3 gap-y-1"
            aria-label="Rank color scale"
          >
            {rules
              .filter(
                (rule) => !["Unranked", "Iron", "Bronze"].includes(rule.tier)
              )
              .map((rule) => (
                <span
                  key={rule.tier}
                  className={`text-xs font-medium ${rankColors[rule.tier]}`}
                >
                  {rule.tier}: {money(rule.low)}
                  {rule.high !== rule.low ? `–${money(rule.high)}` : ""}
                </span>
              ))}
          </div>
          <details>
            <summary className="w-fit cursor-pointer text-xs font-semibold">
              Minimum Bid Values
            </summary>
            <div className="mt-2 flex flex-wrap gap-3">
              {rules.map((rule) => (
                <span
                  key={rule.tier}
                  className={`text-xs ${rankColors[rule.tier]}`}
                >
                  {rule.tier}: {money(rule.minimum)}
                </span>
              ))}
            </div>
          </details>
          {state && (
            <ol
              aria-label="Round pick order"
              className="flex flex-wrap gap-2 text-xs"
            >
              {state.order.map((id, index) => (
                <li
                  key={id}
                  className={`rounded border px-2 py-1 ${index === state.turnIndex ? "border-primary font-semibold" : index < state.turnIndex ? "text-muted-foreground line-through" : ""}`}
                >
                  {index + 1}.{" "}
                  {state.teams.find((team) => team.id === id)?.name}
                </li>
              ))}
            </ol>
          )}
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          {connectionError && (
            <p role="alert" className="text-destructive">
              Connection lost. Reconnect before taking auction actions.
            </p>
          )}
          {!ready ? (
            <p role="status">Loading auction…</p>
          ) : (
            <>
              {state && (
                <div className="grid grid-cols-4 gap-3">
                  {teams.map((team) => (
                    <AuctionTeam
                      key={team.id}
                      lobbyId={lobbyId}
                      state={state}
                      team={team}
                      players={roster}
                      canEdit={isOwner || team.id === myTeam?.id}
                      isOwner={isOwner}
                      own={team.id === myTeam?.id}
                      onSelect={selectPlayer}
                    />
                  ))}
                </div>
              )}
              {state && (
                <AuctionBidding
                  key={state.nomination?.id ?? "idle"}
                  lobbyId={lobbyId}
                  state={state}
                  players={roster}
                  team={myTeam}
                  isOwner={isOwner}
                  selectedPlayerId={selectedPlayerId}
                  now={now}
                  connected={isActive}
                />
              )}
              {isOwner && (!state || state.phase === "setup") && (
                <AuctionSetup
                  lobbyId={lobbyId}
                  state={state}
                  captains={captains}
                  players={roster}
                />
              )}
              {!isOwner && !state && (
                <p className="border bg-sidebar p-6">
                  The auctioneer is setting up teams and starting balances.
                </p>
              )}
              {isOwner && state && (
                <AuctionAdmin
                  lobbyId={lobbyId}
                  state={state}
                  selectedPlayerId={selectedPlayerId}
                  players={roster}
                />
              )}
              {state && (
                <details className="border bg-sidebar p-4">
                  <summary className="cursor-pointer text-sm font-semibold">
                    Auction activity
                  </summary>
                  <ol className="mt-3 max-h-64 space-y-2 overflow-y-auto text-xs">
                    {[...logs]
                      .filter((row) => row.lobbyId === lobbyId)
                      .sort((a, b) => (a.id > b.id ? -1 : 1))
                      .slice(0, 100)
                      .map((row) => (
                        <li key={row.id.toString()}>
                          <time className="text-muted-foreground">
                            {row.at.toDate().toLocaleTimeString()}
                          </time>{" "}
                          · {row.message}
                        </li>
                      ))}
                  </ol>
                </details>
              )}
            </>
          )}
        </div>
      </main>
      <div
        role="separator"
        aria-label="Resize player details"
        aria-orientation="vertical"
        aria-valuenow={profileWidth}
        aria-valuemin={240}
        aria-valuemax={600}
        tabIndex={0}
        className="w-1 shrink-0 cursor-col-resize touch-none bg-border hover:bg-primary focus-visible:bg-primary"
        onPointerDown={(event) =>
          event.currentTarget.setPointerCapture(event.pointerId)
        }
        onPointerMove={(event) => dragResize(event, "profile")}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault()
            setProfileWidth((width) =>
              Math.max(
                240,
                Math.min(600, width + (event.key === "ArrowLeft" ? 20 : -20))
              )
            )
          }
        }}
      />
      <aside
        className="flex shrink-0 flex-col gap-4 overflow-y-auto bg-sidebar p-4"
        style={{ width: profileWidth }}
      >
        {selected ? (
          <AuctionProfile
            key={selected.id}
            player={selected}
            isOwner={isOwner}
            captainsLocked={!!state}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Select a player from the pool or a team to view their details.
          </p>
        )}
      </aside>
    </div>
  )
}
