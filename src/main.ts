import { Identity } from "spacetimedb"
import {
  DbConnection,
  ErrorContext,
  EventContext,
  tables,
} from "./module_bindings/index.js"

const HOST = process.env.NEXT_PUBLIC_SPACETIMEDB_HOST ?? "ws://127.0.0.1:3001"
const DB_NAME = process.env.NEXT_PUBLIC_SPACETIMEDB_DB_NAME ?? "auctioneer-z61hw"

DbConnection.builder()
  .withUri(HOST)
  .withDatabaseName(DB_NAME)
  .onConnect((conn: DbConnection, identity: Identity, _token: string) => {
    console.log("Connected to SpacetimeDB!")
    console.log(`Identity: ${identity.toHexString().slice(0, 16)}...`)

    conn.db.player.onInsert((_ctx: EventContext, player) => {
      console.log(`New player: ${player.name}`)
    })

    conn.subscriptionBuilder().subscribe(tables.player)
  })
  .onDisconnect(() => {
    console.log("Disconnected from SpacetimeDB")
  })
  .onConnectError((_ctx: ErrorContext, error: Error) => {
    console.error("Connection error:", error)
    process.exit(1)
  })
  .build()
