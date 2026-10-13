import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { context, database, player, reducers } from "./helpers/reducers.mjs"

test("only a verified lobby owner can edit notes, including the 5,000 character limit", () => {
  const db = database()
  const owner = context(db, "user_owner")
  const other = context(db, "user_other")
  reducers.createLobby(owner, { lobbyId: randomUUID(), players: [player] })
  reducers.createLobby(other, { lobbyId: randomUUID(), players: [player] })
  const original = db.player.id.find(1)
  for (const adminNotes of [
    "Strong shotcaller.\nPrefers support.",
    "x".repeat(5000),
    "",
  ]) {
    reducers.updatePlayerAdminNotes(owner, { playerId: 1, adminNotes })
    assert.deepEqual(db.player.id.find(1), { ...original, adminNotes })
  }
  for (const [ctx, playerId, adminNotes, message] of [
    [context(db), 1, "guest", /Sign in with Clerk/],
    [other, 1, "wrong owner", /Only the lobby owner/],
    [context(db, "user_captain"), 1, "captain", /Only the lobby owner/],
    [owner, 2, "wrong lobby", /Only the lobby owner/],
    [owner, 999, "missing", /Player not found/],
    [owner, 1, "x".repeat(5001), /5,000 characters/],
  ]) {
    const before = [...db.player.iter()]
    assert.throws(
      () => reducers.updatePlayerAdminNotes(ctx, { playerId, adminNotes }),
      message
    )
    assert.deepEqual([...db.player.iter()], before)
  }
})
