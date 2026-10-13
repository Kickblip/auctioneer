"use client"

import { use, useMemo, useState } from "react"
import { useSpacetimeDB, useTable } from "spacetimedb/react"
import { tables } from "@/src/module_bindings"
import {
  BottomRoleIcon,
  JungleRoleIcon,
  MiddleRoleIcon,
  SupportRoleIcon,
  TopRoleIcon,
  FillRoleIcon,
} from "@/lib/icons"
import { Blobatar } from "@blobatar/react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { getLobbyPlayers, rankLabel, roleLabel } from "./edit/players"

const roleIcons = {
  Top: TopRoleIcon,
  Jungle: JungleRoleIcon,
  Mid: MiddleRoleIcon,
  Adc: BottomRoleIcon,
  Support: SupportRoleIcon,
  Fill: FillRoleIcon,
}

export default function Page({
  params,
}: {
  params: Promise<{ lobbyId: string }>
}) {
  const { lobbyId } = use(params)
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null)
  const [search, setSearch] = useState("")
  const { isActive, connectionError } = useSpacetimeDB()
  const membershipQuery = tables.lobbyPlayer.where((member) =>
    member.lobbyId.eq(lobbyId)
  )
  const [memberships, membershipsReady] = useTable(membershipQuery)
  const [players, playersReady] = useTable(
    membershipQuery.rightSemijoin(tables.player, (member, player) =>
      member.playerId.eq(player.id)
    )
  )
  const pool = useMemo(
    () => getLobbyPlayers(lobbyId, players, memberships),
    [lobbyId, players, memberships]
  )
  const selectedPlayer = pool.find((player) => player.id === selectedPlayerId)
  const query = search.trim().toLowerCase()
  const filteredPlayers = pool.filter((player) =>
    [
      player.name,
      player.discord,
      `${player.riotIdGameName}#${player.riotIdTagline}`,
    ].some((name) => name.toLowerCase().includes(query))
  )

  return (
    <div className="flex h-dvh w-full overflow-x-auto overflow-y-hidden">
      <div className="shrink-0 border-r bg-sidebar p-4">
        <p>A</p>
      </div>

      <div className="flex w-xs shrink-0 flex-col border-r bg-sidebar">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 flex-col gap-2 border-b p-4">
            <p className="text-sm font-medium">Player Pool</p>

            <input
              type="search"
              aria-label="Search players"
              placeholder="Type to search..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-md bg-secondary px-4 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {connectionError ? (
            <p role="alert" className="p-4 text-sm text-destructive">
              Could not load players. Refresh to try again.
            </p>
          ) : !isActive || !membershipsReady || !playersReady ? (
            <div role="status" className="flex items-center gap-2 p-4 text-sm">
              <Spinner aria-hidden="true" />
              Loading players…
            </div>
          ) : filteredPlayers.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              {pool.length === 0
                ? "No players in this lobby."
                : "No players match your search."}
            </p>
          ) : (
            <ul
              aria-label="Player pool"
              tabIndex={0}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
            >
              {filteredPlayers.map((player) => {
                const currentRank = rankLabel(player.currentRank)

                return (
                  <li key={player.id} className="border-b">
                    <button
                      type="button"
                      onClick={() => setSelectedPlayerId(player.id)}
                      aria-pressed={selectedPlayer?.id === player.id}
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

                          <span className="flex items-center gap-1 bg-secondary px-2 py-0.5">
                            {player.currentRank.tag !== "Unranked" && (
                              <Image
                                src={`/icons/rank/small/${currentRank.split(" ")[0].toUpperCase()}.webp`}
                                alt=""
                                width={24}
                                height={24}
                              />
                            )}
                            <span className="text-xs font-semibold">
                              {currentRank}
                            </span>
                          </span>
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-t p-4">
          <p className="text-sm font-medium">My Team</p>

          <div className="flex items-center gap-2">
            <TopRoleIcon className="h-6.5 w-6.5 bg-secondary p-0.5" />
            <span className="font-medium">Player1</span>
          </div>
          <div className="flex items-center gap-2">
            <JungleRoleIcon className="h-6.5 w-6.5 bg-secondary p-0.5" />
            <span className="font-medium text-muted-foreground italic">
              No Assignment
            </span>
          </div>
          <div className="flex items-center gap-2">
            <MiddleRoleIcon className="h-6.5 w-6.5 bg-secondary p-0.5" />
            <span className="font-medium">Player2</span>
          </div>
          <div className="flex items-center gap-2">
            <BottomRoleIcon className="h-6.5 w-6.5 bg-secondary p-0.5" />
            <span className="font-medium text-muted-foreground italic">
              No Assignment
            </span>
          </div>
          <div className="flex items-center gap-2">
            <SupportRoleIcon className="h-6.5 w-6.5 bg-secondary p-0.5" />
            <span className="font-medium text-muted-foreground italic">
              No Assignment
            </span>
          </div>
        </div>
      </div>

      <div className="min-w-0 flex-1 overflow-y-auto p-4">
        <p>C</p>
      </div>

      <div className="flex w-xs shrink-0 flex-col gap-4 overflow-y-auto border-l bg-sidebar p-4">
        <p className="text-sm font-medium">Player Details</p>

        {selectedPlayer ? (
          <>
            <div className="flex items-center gap-3">
              <div className="aspect-square shrink-0 bg-secondary">
                <Blobatar name={selectedPlayer.riotIdGameName} size={64} />
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex items-end gap-1">
                  <span className="text-xl font-medium break-words">
                    {selectedPlayer.riotIdGameName}
                  </span>
                  <span className="text-sm font-medium break-words text-muted-foreground">
                    #{selectedPlayer.riotIdTagline}
                  </span>
                </div>

                <span className="">{selectedPlayer.name}</span>
              </div>
            </div>

            <Button asChild size="lg" className="font-medium">
              {/* shortcut: OP.GG defaults to NA until the schema stores player regions. */}
              <a
                href={`https://op.gg/lol/summoners/na/${encodeURIComponent(selectedPlayer.riotIdGameName)}-${encodeURIComponent(selectedPlayer.riotIdTagline)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View on OP.GG
              </a>
            </Button>

            {[
              {
                label: "Current Rank",
                rank: selectedPlayer.currentRank,
                lp: "1200 LP",
              },
              {
                label: "Peak Rank",
                rank: selectedPlayer.peakRank,
                lp: "2356 LP",
              },
            ].map(({ label, rank, lp }) => (
              <div key={label} className="flex items-center gap-4">
                {rank.tag !== "Unranked" && (
                  <div className="aspect-square shrink-0 bg-secondary p-2">
                    <Image
                      src={`/icons/rank/large/${rankLabel(rank).split(" ")[0].toUpperCase()}.webp`}
                      alt=""
                      width={50}
                      height={50}
                    />
                  </div>
                )}
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-muted-foreground">
                    {label}
                  </span>
                  <span className="text-lg font-medium">{rankLabel(rank)}</span>
                  <span className="text-sm font-medium">{lp}</span>
                </div>
              </div>
            ))}

            <div className="grid grid-cols-2">
              {[
                { label: "Primary Role", role: selectedPlayer.mainRole },
                { label: "Secondary Role", role: selectedPlayer.secondaryRole },
              ].map(({ label, role }) => {
                const RoleIcon = role ? roleIcons[role.tag] : null

                return (
                  <div key={label} className="flex flex-col gap-2">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <div className="flex items-center gap-2">
                      {RoleIcon && (
                        <RoleIcon className="h-6.5 w-6.5 bg-secondary p-0.5" />
                      )}
                      <p className="text-lg font-medium">{roleLabel(role)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Select a player from the pool to view their details.
          </p>
        )}

        <div className="mt-8 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Admin Notes</span>
            <span className="text-xs font-medium text-muted-foreground italic">
              Read Only
            </span>
          </div>
          <Textarea value="Type your message here." disabled />
        </div>
      </div>
    </div>
  )
}
