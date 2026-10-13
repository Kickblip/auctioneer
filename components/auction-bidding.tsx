"use client"
import { useState, type CSSProperties } from "react"
import { Blobatar } from "@blobatar/react"
import { Button } from "@/components/ui/button"
import { useAuctionMutation } from "@/components/auction-hooks"
import {
  maximumBid,
  minimumBid,
  expectedValue,
  remainingDisplayMs,
  poolPlayers,
  type Auction,
  type Team,
} from "@/lib/auction/rules"
import {
  auctionPlayer,
  money,
  rankColor,
  rankName,
  positionName,
} from "@/lib/auction/presentation"
import type { Player } from "@/src/module_bindings/types"

export function AuctionBidding({
  lobbyId,
  state,
  players,
  team,
  isOwner,
  selectedPlayerId,
  now,
  connected,
}: {
  lobbyId: string
  state: Auction
  players: readonly Player[]
  team?: Team
  isOwner: boolean
  selectedPlayerId?: number
  now: number | null
  connected: boolean
}) {
  const { run, busy, error } = useAuctionMutation()
  const [draft, setDraft] = useState<number | null>(null)
  const [clamped, setClamped] = useState(false)
  const stand = state.nomination
  const player = players.find((row) => row.id === stand?.playerId)
  const enginePlayers = players.map(auctionPlayer)
  const max = team ? maximumBid(state, team, enginePlayers) : 0
  const nextBid = (stand?.bid ?? 0) + 1
  const amount = Math.min(max, draft ?? nextBid)
  const turn = state.teams.find(
    (row) => row.id === state.order[state.turnIndex]
  )
  const canNominate =
    state.phase === "nomination" &&
    !state.paused &&
    (isOwner || team?.id === turn?.id)
  const selectedAvailable = poolPlayers(state, enginePlayers).some(
    (row) => row.id === selectedPlayerId
  )
  const bidOpen = state.phase === "bidding" && !state.paused
  const disabled = busy || !connected
  const winning =
    !!team && stand?.bidderId === team.id && state.phase === "bidding"
  const reason = !bidOpen
    ? "Bidding is not open."
    : max < nextBid
      ? "Your maximum bid is below the next valid bid."
      : amount < nextBid
        ? `Bid at least ${money(nextBid)}.`
        : clamped
          ? "Amount limited to your maximum bid."
          : ""
  const phaseLabel = {
    setup: "Waiting for auctioneer",
    nomination: "Awaiting nomination",
    reveal: "Player reveal",
    awaitingStart: "Waiting for auctioneer to start bidding",
    bidding: "Bidding open",
    sold: "Sold — waiting for the auctioneer",
    break: "Round break",
    complete: "Auction complete",
  }[state.phase]
  const clock =
    now === null
      ? "Syncing…"
      : `${Math.ceil(remainingDisplayMs(state, now) / 1000)}s`
  const update = (value: number) => {
    setClamped(value > max)
    setDraft(Math.max(0, Math.min(max, Math.floor(value))))
  }
  return (
    <section className="flex min-h-64 flex-col gap-4 border bg-sidebar p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">{phaseLabel}</h2>
        {["bidding", "reveal", "break"].includes(state.phase) && (
          <p
            className="text-3xl font-bold tabular-nums"
            aria-label="Auction timer"
          >
            {clock}
          </p>
        )}
      </div>
      {state.paused && (
        <p
          role="alert"
          className="rounded border border-amber-500 bg-amber-500/10 p-3 font-semibold"
        >
          Auction paused
        </p>
      )}
      {state.phase === "nomination" && (
        <p className="text-sm">{turn?.name ?? "Auctioneer"} is on the clock.</p>
      )}
      {canNominate && (
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={disabled || !selectedAvailable || !turn}
            onClick={() =>
              void run((connection) =>
                connection.reducers.nominatePlayer({
                  lobbyId,
                  teamId: turn!.id,
                  playerId: selectedPlayerId,
                  random: false,
                })
              )
            }
          >
            Nominate selected player to bid
          </Button>
          <Button
            variant="outline"
            disabled={disabled || !turn}
            onClick={() =>
              void run((connection) =>
                connection.reducers.nominatePlayer({
                  lobbyId,
                  teamId: turn!.id,
                  playerId: undefined,
                  random: true,
                })
              )
            }
          >
            Random player
          </Button>
        </div>
      )}
      {stand && player && (
        <>
          {stand.random && state.phase === "reveal" && (
            <RandomWheel key={stand.id} state={state} players={players} />
          )}
          <div className="flex flex-wrap items-center gap-4">
            <Blobatar name={player.riotIdGameName} size={64} />
            <div>
              <h3 className="text-xl font-semibold">
                {player.riotIdGameName}#{player.riotIdTagline}
              </h3>
              <p className="text-sm">
                {player.name} · {player.discord}
              </p>
              <p className="text-xs text-muted-foreground">
                Current: {rankName(player.currentRank.tag)} · {player.currentLp}{" "}
                LP | Peak: {rankName(player.peakRank.tag)} · {player.peakLp} LP
              </p>
              <p className="text-xs">
                {positionName(player.mainRole?.tag ?? "Unspecified")} /{" "}
                {positionName(player.secondaryRole?.tag ?? "Unspecified")} ·{" "}
                {player.tournamentWins} tournament wins
              </p>
            </div>
          </div>
          {player.adminNotes && (
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">
              Admin notes: {player.adminNotes}
            </p>
          )}
          <div>
            <p
              className={`text-3xl font-bold tabular-nums ${rankColor(auctionPlayer(player).peakRank)}`}
            >
              {money(stand.bid)}{" "}
              <span className="text-sm font-normal text-foreground">
                by {state.teams.find((row) => row.id === stand.bidderId)?.name}
              </span>
            </p>
            <p
              className={`text-sm ${rankColor(auctionPlayer(player).peakRank)}`}
            >
              Minimum{" "}
              {money(
                minimumBid(auctionPlayer(player), state.settings.rankRules)
              )}{" "}
              · Estimated value{" "}
              {money(
                expectedValue(auctionPlayer(player), state.settings.rankRules)
              )}
            </p>
            {player.effectivePeakRank && (
              <p className="text-xs">
                Effective peak: {rankName(player.effectivePeakRank)}
              </p>
            )}
          </div>
          {winning && (
            <p
              role="status"
              className="font-semibold text-emerald-700 dark:text-emerald-400"
            >
              You are winning this auction
            </p>
          )}
          {team && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  disabled={disabled || !bidOpen || amount <= 0}
                  onClick={() => update(amount - 100)}
                  aria-label="Decrease bid by 100"
                >
                  −100
                </Button>
                <input
                  aria-label="Bid amount"
                  type="number"
                  min={0}
                  max={max}
                  step={1}
                  value={amount}
                  disabled={disabled || !bidOpen}
                  onChange={(event) => update(Number(event.target.value))}
                  className="w-32 rounded-md border bg-background px-3 py-2"
                />
                <Button
                  variant="outline"
                  disabled={disabled || !bidOpen || amount >= max}
                  onClick={() => update(amount + 100)}
                  aria-label="Increase bid by 100"
                >
                  +100
                </Button>
                <Button
                  disabled={
                    disabled || !bidOpen || amount < nextBid || amount > max
                  }
                  onClick={() =>
                    void run((connection) =>
                      connection.reducers.placeBid({
                        lobbyId,
                        teamId: team.id,
                        amount,
                        nominationId: stand.id,
                      })
                    )
                  }
                >
                  Confirm Bid
                </Button>
              </div>
              {reason && (
                <p role="status" className="text-xs text-muted-foreground">
                  {reason}
                </p>
              )}
              <p className="text-sm">
                <strong>Maximum Bid: {money(max)}.</strong> Reflects the minimum
                reserve required for your remaining slots at their minimum bids.
                Actual costs will likely be higher.
              </p>
            </>
          )}
          <div
            className="flex flex-wrap gap-2"
            aria-label="Active bids by captain"
          >
            {state.teams.map((row) => {
              const last = [...stand.bids]
                .reverse()
                .find((bid) => bid.teamId === row.id)
              return (
                <span
                  key={row.id}
                  className={`border px-2 py-1 text-xs ${row.id === stand.bidderId ? "border-primary font-semibold" : "text-muted-foreground"}`}
                >
                  {row.name}: {last ? money(last.amount) : "No bid"}
                </span>
              )
            })}
          </div>
        </>
      )}
      {team && !stand && (
        <p className="text-sm">
          Your wallet: <strong>{money(team.balance)}</strong> / initial{" "}
          {money(team.initialBalance)}
        </p>
      )}
      {!team && !isOwner && (
        <p className="text-sm text-muted-foreground">
          Spectator view · read only
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  )
}

function RandomWheel({
  state,
  players,
}: {
  state: Auction
  players: readonly Player[]
}) {
  const pool = poolPlayers(state, players.map(auctionPlayer), false)
  const index = pool.findIndex((row) => row.id === state.nomination?.playerId)
  const result = players.find((row) => row.id === state.nomination?.playerId)
  const segment = 360 / pool.length
  const colors = ["#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#f43f5e"]
  const gradient = pool
    .map(
      (_, i) =>
        `${colors[i % colors.length]} ${i * segment}deg ${(i + 1) * segment}deg`
    )
    .join(",")
  return (
    <div
      className="flex items-center gap-4"
      aria-label={`Random wheel selected ${result?.riotIdGameName}`}
    >
      <div className="relative size-24 shrink-0">
        <div
          className="auction-wheel size-full rounded-full border-4 border-background"
          style={
            {
              background: `conic-gradient(${gradient})`,
              "--wheel-end": `${1440 + 360 - (index + 0.5) * segment}deg`,
            } as CSSProperties
          }
        />
        <span
          className="absolute -top-2 left-1/2 -translate-x-1/2 text-2xl"
          aria-hidden="true"
        >
          ▼
        </span>
      </div>
      <p className="text-sm">
        Random selection: <strong>{result?.riotIdGameName}</strong>
      </p>
    </div>
  )
}
