import { schema, SenderError, table, t } from "spacetimedb/server"

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
  }
)

const lobby = table(
  { public: true },
  {
    id: t.string().primaryKey(),
    owner: t.identity(),
    createdAt: t.timestamp(),
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

const spacetimedb = schema({ player, lobby, lobbyPlayer })

export default spacetimedb

export const createLobby = spacetimedb.reducer(
  {
    lobbyId: t.string(),
    players: t.array(t.object("PlayerInput", playerFields)),
  },
  (ctx, { lobbyId, players }) => {
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
      const inserted = ctx.db.player.insert({ id: 0, ...record })
      ctx.db.lobbyPlayer.insert({ playerId: inserted.id, lobbyId })
    }
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
