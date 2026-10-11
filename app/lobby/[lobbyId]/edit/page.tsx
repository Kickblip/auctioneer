"use client"

import { use, useMemo } from "react"
import Link from "next/link"
import {
  tableFeatures,
  useTable as useDataTable,
  type ColumnDef,
} from "@tanstack/react-table"
import { useSpacetimeDB, useTable } from "spacetimedb/react"
import { tables } from "@/src/module_bindings"
import type { Player } from "@/src/module_bindings/types"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getLobbyPlayers, rankLabel, roleLabel } from "./players"

const features = tableFeatures({})
const columns: ColumnDef<typeof features, Player>[] = [
  { accessorKey: "id", header: "Player ID" },
  { accessorKey: "name", header: "Name" },
  { accessorKey: "discord", header: "Discord" },
  { accessorKey: "riotIdGameName", header: "Riot game name" },
  { accessorKey: "riotIdTagline", header: "Riot tagline" },
  {
    accessorKey: "currentRank",
    header: "Current rank",
    cell: ({ row }) => rankLabel(row.original.currentRank),
  },
  {
    accessorKey: "peakRank",
    header: "Peak rank",
    cell: ({ row }) => rankLabel(row.original.peakRank),
  },
  {
    accessorKey: "mainRole",
    header: "Main role",
    cell: ({ row }) => roleLabel(row.original.mainRole),
  },
  {
    accessorKey: "secondaryRole",
    header: "Secondary role",
    cell: ({ row }) => roleLabel(row.original.secondaryRole),
  },
]

export default function LobbyEditPage({
  params,
}: {
  params: Promise<{ lobbyId: string }>
}) {
  const { lobbyId } = use(params)
  const { isActive, connectionError } = useSpacetimeDB()
  const [lobbies, lobbyReady] = useTable(
    tables.lobby.where((lobby) => lobby.id.eq(lobbyId))
  )
  const membershipQuery = tables.lobbyPlayer.where((member) =>
    member.lobbyId.eq(lobbyId)
  )
  const [memberships, membershipsReady] = useTable(membershipQuery)
  const [players, playersReady] = useTable(
    membershipQuery.rightSemijoin(tables.player, (member, player) =>
      member.playerId.eq(player.id)
    )
  )
  const data = useMemo(
    () => getLobbyPlayers(lobbyId, players, memberships),
    [lobbyId, players, memberships]
  )
  const table = useDataTable({
    features,
    columns,
    data,
    getRowId: (player) => player.id.toString(),
  })
  const lobbyExists = lobbies.some((lobby) => lobby.id === lobbyId)

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 sm:p-8">
      <Link href="/" className="w-fit text-sm underline underline-offset-4">
        Back to Auctioneer
      </Link>
      <header>
        <h1 className="text-2xl font-semibold">Edit lobby</h1>
        <p className="text-sm break-all text-muted-foreground">{lobbyId}</p>
      </header>

      {connectionError ? (
        <p role="alert" className="text-sm text-destructive">
          Could not connect to the database. Refresh to try again.
        </p>
      ) : !isActive || !lobbyReady ? (
        <div role="status" className="flex items-center gap-2">
          <Spinner aria-hidden="true" />
          Loading lobby…
        </div>
      ) : !lobbyExists ? (
        <p role="alert">Lobby not found.</p>
      ) : !membershipsReady || !playersReady ? (
        <div role="status" className="flex items-center gap-2">
          <Spinner aria-hidden="true" />
          Loading players…
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableCaption className="sr-only">
              Players in this lobby
            </TableCaption>
            <TableHeader>
              {table.getHeaderGroups().map((group) => (
                <TableRow key={group.id}>
                  {group.headers.map((header) => (
                    <TableHead key={header.id} scope="col">
                      <table.FlexRender header={header} />
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getAllCells().map((cell) => (
                      <TableCell key={cell.id}>
                        <table.FlexRender cell={cell} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    No players in this lobby.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </main>
  )
}
