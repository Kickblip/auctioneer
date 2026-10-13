import {
  schema,
  SenderError,
  table,
  t,
  type InferSchema,
  type ReducerCtx,
} from "spacetimedb/server"
import { requireClerkUser } from "./auth"

const rank = t.enum("Rank", [
  "Unranked",
  "IronIV",
  "IronIII",
  "IronII",
  "IronI",
  "BronzeIV",
  "BronzeIII",
  "BronzeII",
  "BronzeI",
  "SilverIV",
  "SilverIII",
  "SilverII",
  "SilverI",
  "GoldIV",
  "GoldIII",
  "GoldII",
  "GoldI",
  "PlatinumIV",
  "PlatinumIII",
  "PlatinumII",
  "PlatinumI",
  "EmeraldIV",
  "EmeraldIII",
  "EmeraldII",
  "EmeraldI",
  "DiamondIV",
  "DiamondIII",
  "DiamondII",
  "DiamondI",
  "Master",
  "Grandmaster",
  "Challenger",
])
const role = t.enum("Role", ["Top", "Jungle", "Mid", "ADC", "Support", "Fill"])

const playerFields = {
  name: t.string(), // "Kickball"
  discord: t.string(), // "kickball"
  riotIdGameName: t.string(), // "Kickball"
  riotIdTagline: t.string(), // "NA1"
  currentRank: rank,
  peakRank: rank,
  mainRole: role.optional(),
  secondaryRole: role.optional(),
}

const player = table(
  { public: true },
  {
    id: t.u32().primaryKey().autoInc(),
    ...playerFields,
    adminNotes: t.string().default(""),
  }
)

const lobby = table(
  { public: true },
  {
    id: t.string().primaryKey(),
    owner: t.identity(),
    createdAt: t.timestamp(),
    ownerClerkId: t.string().default(""),
  }
)

// Keep existing player rows intact when adding lobby membership.
const lobbyPlayer = table(
  { public: true },
  {
    playerId: t.u32().primaryKey(),
    lobbyId: t.string().index("btree"),
  }
)

const captain = table(
  { public: true },
  {
    playerId: t.u32().primaryKey(),
    lobbyId: t.string().index("btree"),
    clerkUserId: t.string(),
  }
)

const spacetimedb = schema({ player, lobby, lobbyPlayer, captain })

export default spacetimedb

type Context = ReducerCtx<InferSchema<typeof spacetimedb>>

function requireOwner(ctx: Context, lobbyId: string) {
  const userId = requireClerkUser(ctx)
  const record = ctx.db.lobby.id.find(lobbyId)
  if (!record || record.ownerClerkId !== userId) {
    throw new SenderError("Only the lobby owner can do this.")
  }
  return record
}

function playerLobby(ctx: Context, playerId: number) {
  const membership = ctx.db.lobbyPlayer.playerId.find(playerId)
  if (!membership) throw new SenderError("Player not found in a lobby.")
  return membership.lobbyId
}

export const createLobby = spacetimedb.reducer(
  {
    lobbyId: t.string(),
    players: t.array(t.object("PlayerInput", playerFields)),
  },
  (ctx, { lobbyId, players }) => {
    const ownerClerkId = requireClerkUser(ctx)
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        lobbyId
      )
    ) {
      throw new SenderError("Invalid lobby ID.")
    }
    if (players.length === 0) {
      throw new SenderError("The CSV must contain at least one player.")
    }
    if (ctx.db.lobby.id.find(lobbyId)) {
      throw new SenderError("A lobby with this ID already exists.")
    }

    ctx.db.lobby.insert({
      id: lobbyId,
      owner: ctx.sender,
      createdAt: ctx.timestamp,
      ownerClerkId,
    })
    for (const [index, record] of players.entries()) {
      for (const field of [
        "name",
        "discord",
        "riotIdGameName",
        "riotIdTagline",
      ] as const) {
        if (!record[field].trim()) {
          throw new SenderError(`Player ${index + 1} is missing ${field}.`)
        }
      }
      const inserted = ctx.db.player.insert({
        id: 0,
        ...record,
        adminNotes: "",
      })
      ctx.db.lobbyPlayer.insert({ playerId: inserted.id, lobbyId })
    }
  }
)

export const updatePlayerAdminNotes = spacetimedb.reducer(
  { playerId: t.u32(), adminNotes: t.string() },
  (ctx, { playerId, adminNotes }) => {
    requireOwner(ctx, playerLobby(ctx, playerId))
    const player = ctx.db.player.id.find(playerId)
    if (!player) {
      throw new SenderError("Player not found.")
    }
    if (adminNotes.length > 5000) {
      throw new SenderError("Admin notes must be 5,000 characters or fewer.")
    }
    ctx.db.player.id.update({ ...player, adminNotes })
  }
)

// Existing lobbies can be linked once, using the original owner's browser token.
export const linkLegacyLobbyOwner = spacetimedb.reducer(
  { lobbyId: t.string(), clerkUserId: t.string() },
  (ctx, { lobbyId, clerkUserId }) => {
    const record = ctx.db.lobby.id.find(lobbyId)
    if (!record || record.ownerClerkId || !record.owner.isEqual(ctx.sender)) {
      throw new SenderError(
        "Use the original owner's browser to link this lobby."
      )
    }
    if (!/^user_[A-Za-z0-9]+$/.test(clerkUserId)) {
      throw new SenderError("Invalid Clerk user ID.")
    }
    ctx.db.lobby.id.update({ ...record, ownerClerkId: clerkUserId })
  }
)

export const joinAsOwner = spacetimedb.reducer(
  { lobbyId: t.string() },
  (ctx, { lobbyId }) => {
    requireOwner(ctx, lobbyId)
  }
)

export const setPlayerCaptain = spacetimedb.reducer(
  { playerId: t.u32(), isCaptain: t.bool() },
  (ctx, { playerId, isCaptain }) => {
    const lobbyId = playerLobby(ctx, playerId)
    requireOwner(ctx, lobbyId)
    if (isCaptain) {
      if (!ctx.db.captain.playerId.find(playerId)) {
        ctx.db.captain.insert({ playerId, lobbyId, clerkUserId: "" })
      }
    } else {
      ctx.db.captain.playerId.delete(playerId)
    }
  }
)

export const joinAsCaptain = spacetimedb.reducer(
  { lobbyId: t.string(), playerId: t.u32() },
  (ctx, { lobbyId, playerId }) => {
    const clerkUserId = requireClerkUser(ctx)
    const record = ctx.db.captain.playerId.find(playerId)
    if (!record || record.lobbyId !== lobbyId) {
      throw new SenderError("This player is not a captain in this lobby.")
    }
    if (record.clerkUserId && record.clerkUserId !== clerkUserId) {
      throw new SenderError(
        "This captain is already linked to another account."
      )
    }
    for (const other of ctx.db.captain.lobbyId.filter(lobbyId)) {
      if (other.playerId !== playerId && other.clerkUserId === clerkUserId) {
        throw new SenderError(
          "Your account is already linked to a captain in this lobby."
        )
      }
    }
    ctx.db.captain.playerId.update({ ...record, clerkUserId })
  }
)

export const init = spacetimedb.init((_ctx) => {
  // Called when the module is initially published
})

export const onConnect = spacetimedb.clientConnected((_ctx) => {
  // Called every time a new client connects
})

export const onDisconnect = spacetimedb.clientDisconnected((_ctx) => {
  // Called every time a client disconnects
})
