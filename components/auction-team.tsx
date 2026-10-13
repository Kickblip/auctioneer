"use client"
import { Button } from "@/components/ui/button"
import { useAuctionMutation } from "@/components/auction-hooks"
import {
  positions,
  emptySlots,
  isOverBudget,
  type Auction,
  type Team,
} from "@/lib/auction/rules"
import {
  auctionPlayer,
  money,
  positionName,
  rankColor,
} from "@/lib/auction/presentation"
import type { Player } from "@/src/module_bindings/types"
import {
  TopRoleIcon,
  JungleRoleIcon,
  MiddleRoleIcon,
  BottomRoleIcon,
  SupportRoleIcon,
} from "@/lib/icons"
export const teamRoleIcons = {
  Top: TopRoleIcon,
  Jungle: JungleRoleIcon,
  Mid: MiddleRoleIcon,
  Adc: BottomRoleIcon,
  Support: SupportRoleIcon,
}

export function AuctionTeam({
  lobbyId,
  state,
  team,
  players,
  canEdit,
  isOwner,
  own,
  onSelect,
}: {
  lobbyId: string
  state: Auction
  team: Team
  players: readonly Player[]
  canEdit: boolean
  isOwner: boolean
  own?: boolean
  onSelect: (id: number) => void
}) {
  const { run, busy, error } = useAuctionMutation()
  const overBudget = isOverBudget(state, team, players.map(auctionPlayer))
  return (
    <section
      className={`flex min-w-0 flex-col gap-3 border bg-sidebar p-3 ${own ? "border-primary" : ""}`}
    >
      <div>
        <h2 className="truncate text-sm font-semibold">
          {team.name}
          {own ? " · My Team" : ""}
        </h2>
        <p className="text-lg font-semibold tabular-nums">
          {money(team.balance)}
        </p>
        <p className="text-xs text-muted-foreground">
          Started {money(team.initialBalance)} · {4 - emptySlots(team)}/4 picks
        </p>
      </div>
      {overBudget && (
        <p role="status" className="text-xs font-semibold text-destructive">
          Over budget — return a purchased player at the round break.
        </p>
      )}
      {positions.map((position) => {
        const Icon = teamRoleIcons[position]
        const slot = team.roster.find((row) => row.position === position)
        const player = players.find((row) => row.id === slot?.playerId)
        return (
          <div key={position} className="flex flex-col gap-1">
            <div className="flex min-w-0 items-center gap-2">
              <span title={positionName(position)}>
                <Icon className="size-6 shrink-0 bg-secondary p-0.5" />
              </span>
              {player && slot ? (
                <button
                  type="button"
                  onClick={() => onSelect(player.id)}
                  className={`min-w-0 truncate text-left text-sm font-medium hover:underline ${rankColor(player.effectivePeakRank || player.peakRank.tag)}`}
                  title={`${player.riotIdGameName} · ${slot.captain ? "Captain" : money(slot.price)}`}
                >
                  {player.riotIdGameName}
                  {slot.captain ? " (C)" : ` · ${money(slot.price)}`}
                </button>
              ) : (
                <span className="truncate text-xs text-muted-foreground italic">
                  No Assignment
                </span>
              )}
            </div>
            {slot && canEdit && (
              <div className="flex flex-wrap gap-1 pl-8">
                <select
                  aria-label={`Position for ${player?.riotIdGameName ?? slot.playerId}`}
                  value={slot.position}
                  disabled={busy}
                  className="max-w-full rounded border bg-background text-xs"
                  onChange={(event) =>
                    void run((connection) =>
                      connection.reducers.assignPlayerRole({
                        lobbyId,
                        teamId: team.id,
                        playerId: slot.playerId,
                        position: event.target.value,
                      })
                    )
                  }
                >
                  {positions.map((value) => (
                    <option key={value} value={value}>
                      {positionName(value)}
                    </option>
                  ))}
                </select>
                {!slot.captain &&
                  (isOwner || (overBudget && state.phase === "break")) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1 text-xs"
                      disabled={
                        busy ||
                        ["bidding", "reveal", "awaitingStart"].includes(
                          state.phase
                        )
                      }
                      onClick={() =>
                        void run((connection) =>
                          connection.reducers.returnPlayer({
                            lobbyId,
                            teamId: team.id,
                            playerId: slot.playerId,
                          })
                        )
                      }
                    >
                      Return ({money(Math.floor(slot.price / 2))})
                    </Button>
                  )}
              </div>
            )}
          </div>
        )
      })}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </section>
  )
}
