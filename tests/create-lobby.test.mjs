import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { context, database, player, reducers } from "./helpers/reducers.mjs"

test("creates a roster owned by the verified Clerk account", () => {
  const db = database()
  const ctx = context(db, "user_owner")
  const lobbyId = randomUUID()
  reducers.createLobby(ctx, {
    lobbyId,
    players: [player, { ...player, name: "Support" }],
  })
  assert.equal(db.lobby.id.find(lobbyId).ownerClerkId, "user_owner")
  assert.equal(db.lobby.id.find(lobbyId).owner, ctx.sender)
  assert.deepEqual(
    [...db.lobbyPlayer.iter()],
    [
      { playerId: 1, lobbyId },
      { playerId: 2, lobbyId },
    ]
  )
  assert.deepEqual(db.player.id.find(1), {
    id: 1,
    ...player,
    adminNotes: "",
    currentLp: 0,
    peakLp: 0,
    tournamentWins: 0,
    effectivePeakRank: "",
    opggUrl: "",
  })
  assert.equal(db.player.id.find(2).name, "Support")
  assert.throws(
    () => reducers.createLobby(ctx, { lobbyId, players: [player] }),
    /already exists/
  )
})

test("rejects guests, invalid IDs, empty rosters and missing player fields", () => {
  assert.throws(
    () =>
      reducers.createLobby(context(database()), {
        lobbyId: randomUUID(),
        players: [player],
      }),
    /Sign in with Clerk/
  )
  const ctx = context(database(), "user_owner")
  assert.throws(
    () => reducers.createLobby(ctx, { lobbyId: "invalid", players: [player] }),
    /Invalid lobby ID/
  )
  assert.throws(
    () => reducers.createLobby(ctx, { lobbyId: randomUUID(), players: [] }),
    /at least one player/
  )
  for (const field of ["name", "discord", "riotIdGameName", "riotIdTagline"]) {
    assert.throws(
      () =>
        reducers.createLobby(ctx, {
          lobbyId: randomUUID(),
          players: [{ ...player, [field]: " " }],
        }),
      new RegExp(`missing ${field}`)
    )
  }
})
