import type { Captain, Lobby } from "../src/module_bindings/types"

export type DraftRole = "Owner" | "Captain" | "Spectator"
export type JoinedRole = { role: DraftRole; userId?: string; playerId?: number }

export function activeLobbyRole(
  joined: JoinedRole | null,
  userId: string | null | undefined,
  lobby: Pick<Lobby, "id" | "ownerClerkId"> | undefined,
  captains: readonly Captain[]
): DraftRole | null {
  if (!lobby || !joined) return null
  if (joined.role === "Spectator") return "Spectator"
  if (!userId || joined.userId !== userId) return null
  if (joined.role === "Owner" && lobby.ownerClerkId === userId) return "Owner"
  if (
    joined.role === "Captain" &&
    captains.some(
      (captain) =>
        captain.lobbyId === lobby.id &&
        captain.playerId === joined.playerId &&
        captain.clerkUserId === userId
    )
  )
    return "Captain"
  return null
}
