import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { context, database, player, reducers } from "./helpers/reducers.mjs"

function fixture() {
  const db = database()
  const owner = context(db, "user_owner")
  const lobbyId = randomUUID()
  reducers.createLobby(owner, { lobbyId, players: [player, player] })
  return { db, owner, lobbyId }
}

test("owner joining requires the correct Clerk account, issuer, and unexpired token", () => {
  const { db, owner, lobbyId } = fixture()
  reducers.joinAsOwner(owner, { lobbyId })
  for (const ctx of [
    context(db),
    context(db, "user_other"),
    context(db, "user_owner", {
      issuer: "https://another-app.clerk.accounts.dev",
    }),
    context(db, "user_owner", { issuer: "http://localhost" }),
    context(db, "user_owner", { fullPayload: {} }),
    context(db, "user_owner", { fullPayload: { exp: 1_800_000_000 } }),
    context(db, "user_owner", { fullPayload: { exp: "1800000060" } }),
  ]) {
    assert.throws(
      () => reducers.joinAsOwner(ctx, { lobbyId }),
      /Sign in with Clerk|Only the lobby owner/
    )
    assert.throws(
      () => reducers.setPlayerCaptain(ctx, { playerId: 1, isCaptain: true }),
      /Sign in with Clerk|Only the lobby owner/
    )
    assert.throws(
      () =>
        reducers.updatePlayerAdminNotes(ctx, {
          playerId: 1,
          adminNotes: "forged",
        }),
      /Sign in with Clerk|Only the lobby owner/
    )
  }
  assert.equal([...db.captain.iter()].length, 0)
  assert.equal(db.player.id.find(1).adminNotes, "")
})

test("captains must be preassigned and claims are exclusive, scoped to a lobby, and revocable", () => {
  const { db, owner, lobbyId } = fixture()
  const captain = context(db, "user_captain")
  const other = context(db, "user_other")
  assert.throws(
    () => reducers.joinAsCaptain(captain, { lobbyId, playerId: 1 }),
    /not a captain/
  )
  for (const playerId of [1, 2])
    reducers.setPlayerCaptain(owner, { playerId, isCaptain: true })
  assert.throws(
    () => reducers.joinAsCaptain(context(db), { lobbyId, playerId: 1 }),
    /Sign in with Clerk/
  )
  assert.throws(
    () =>
      reducers.joinAsCaptain(captain, { lobbyId: randomUUID(), playerId: 1 }),
    /not a captain/
  )
  assert.throws(
    () =>
      reducers.joinAsCaptain(
        context(db, "user_captain", { issuer: "https://untrusted.example" }),
        { lobbyId, playerId: 1 }
      ),
    /Sign in with Clerk/
  )
  reducers.joinAsCaptain(captain, { lobbyId, playerId: 1 })
  reducers.joinAsCaptain(captain, { lobbyId, playerId: 1 }) // Rejoining is allowed.
  reducers.setPlayerCaptain(owner, { playerId: 1, isCaptain: true }) // Preserves binding.
  assert.equal(db.captain.playerId.find(1).clerkUserId, "user_captain")
  assert.throws(
    () => reducers.joinAsCaptain(other, { lobbyId, playerId: 1 }),
    /another account/
  )
  assert.throws(
    () => reducers.joinAsCaptain(captain, { lobbyId, playerId: 2 }),
    /already linked/
  )
  assert.throws(
    () => reducers.setPlayerCaptain(captain, { playerId: 1, isCaptain: false }),
    /Only the lobby owner/
  )
  reducers.setPlayerCaptain(owner, { playerId: 1, isCaptain: false })
  assert.equal(db.captain.playerId.find(1), undefined)
  assert.throws(
    () => reducers.joinAsCaptain(captain, { lobbyId, playerId: 1 }),
    /not a captain/
  )
  reducers.setPlayerCaptain(owner, { playerId: 1, isCaptain: true })
  assert.equal(db.captain.playerId.find(1).clerkUserId, "")
  reducers.joinAsCaptain(other, { lobbyId, playerId: 1 })

  const secondLobby = randomUUID()
  reducers.createLobby(context(db, "user_secondOwner"), {
    lobbyId: secondLobby,
    players: [player],
  })
  assert.throws(
    () => reducers.setPlayerCaptain(owner, { playerId: 3, isCaptain: true }),
    /Only the lobby owner/
  )
  reducers.setPlayerCaptain(context(db, "user_secondOwner"), {
    playerId: 3,
    isCaptain: true,
  })
  reducers.joinAsCaptain(other, { lobbyId: secondLobby, playerId: 3 }) // Same account, different lobby.
})

test("legacy ownership links once with the original browser token and then requires Clerk", () => {
  const db = database()
  const legacy = context(db)
  const owner = context(db, "user_owner")
  const lobbyId = randomUUID()
  db.lobby.insert({
    id: lobbyId,
    owner: legacy.sender,
    ownerClerkId: "",
    createdAt: legacy.timestamp,
  })
  assert.throws(
    () => reducers.joinAsOwner(owner, { lobbyId }),
    /Only the lobby owner/
  )
  assert.throws(
    () =>
      reducers.linkLegacyLobbyOwner(owner, {
        lobbyId,
        clerkUserId: "user_owner",
      }),
    /original owner's browser/
  )
  assert.throws(
    () => reducers.linkLegacyLobbyOwner(legacy, { lobbyId, clerkUserId: "" }),
    /Invalid Clerk user ID/
  )
  reducers.linkLegacyLobbyOwner(legacy, { lobbyId, clerkUserId: "user_owner" })
  reducers.joinAsOwner(owner, { lobbyId })
  assert.throws(
    () => reducers.joinAsOwner(legacy, { lobbyId }),
    /Sign in with Clerk/
  )
  assert.throws(
    () =>
      reducers.linkLegacyLobbyOwner(legacy, {
        lobbyId,
        clerkUserId: "user_someoneElse",
      }),
    /original owner's browser/
  )
  assert.equal(db.lobby.id.find(lobbyId).ownerClerkId, "user_owner")
})
