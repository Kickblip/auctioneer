import { schema, table, t } from "spacetimedb/server"

const player = table(
  { public: true },
  {
    id: t.u32().primaryKey().autoInc(),
    name: t.string(), // "Kickball"
    discord: t.string(), // "kickball"
    riotIdGameName: t.string(), // "Kickball"
    riotIdTagline: t.string(), // "NA1"
    currentRank: t.string(), // "Diamond II"
    peakRank: t.string(), // "Master"
    mainRole: t.string(), // "Mid"
    secondaryRole: t.string().optional(), // "Support"
  }
)

const spacetimedb = schema({ player })

export default spacetimedb

export const init = spacetimedb.init((_ctx) => {
  // Called when the module is initially published
})

export const onConnect = spacetimedb.clientConnected((_ctx) => {
  // Called every time a new client connects
})

export const onDisconnect = spacetimedb.clientDisconnected((_ctx) => {
  // Called every time a client disconnects
})
