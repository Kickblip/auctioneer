import type {
  LobbyPlayer,
  Player,
  Rank,
  Role,
} from "@/src/module_bindings/types"

export function rankLabel(rank: Rank) {
  return rank.tag.replace(/I[iv]*$/, (division) => ` ${division.toUpperCase()}`)
}

export function roleLabel(role: Role | undefined) {
  return role?.tag === "Adc" ? "ADC" : (role?.tag ?? "—")
}

export function getLobbyPlayers(
  lobbyId: string,
  players: readonly Player[],
  memberships: readonly LobbyPlayer[]
) {
  // Subscriptions share a cache, so exclude players from other open lobbies.
  const ids = new Set(
    memberships
      .filter((member) => member.lobbyId === lobbyId)
      .map((member) => member.playerId)
  )
  return players
    .filter((player) => ids.has(player.id))
    .sort((a, b) => a.id - b.id)
}
