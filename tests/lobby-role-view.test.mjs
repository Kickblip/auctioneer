import assert from "node:assert/strict"
import { test } from "node:test"
import { activeLobbyRole } from "../lib/lobby-role.ts"

test("role view allows guests and resets after sign-out, account change, or captain revocation", () => {
  const lobby = { id: "draft", ownerClerkId: "user_owner" }
  const captains = [
    { lobbyId: "draft", playerId: 1, clerkUserId: "user_captain" },
  ]
  const captain = { role: "Captain", playerId: 1, userId: "user_captain" }
  const owner = { role: "Owner", userId: "user_owner" }
  assert.equal(activeLobbyRole(null, "user_owner", lobby, captains), null)
  assert.equal(
    activeLobbyRole({ role: "Spectator" }, null, lobby, []),
    "Spectator"
  )
  assert.equal(
    activeLobbyRole({ role: "Spectator" }, "user_owner", lobby, captains),
    "Spectator"
  )
  assert.equal(activeLobbyRole(owner, "user_owner", lobby, captains), "Owner")
  assert.equal(
    activeLobbyRole(captain, "user_captain", lobby, captains),
    "Captain"
  )
  assert.equal(activeLobbyRole(captain, null, lobby, captains), null)
  assert.equal(activeLobbyRole(owner, null, lobby, captains), null)
  assert.equal(
    activeLobbyRole(owner, "user_someoneElse", lobby, captains),
    null
  )
  assert.equal(
    activeLobbyRole(captain, "user_someoneElse", lobby, captains),
    null
  )
  assert.equal(activeLobbyRole(captain, "user_captain", lobby, []), null)
  assert.equal(
    activeLobbyRole(captain, "user_captain", lobby, [
      { ...captains[0], clerkUserId: "" },
    ]),
    null
  )
  assert.equal(
    activeLobbyRole(
      captain,
      "user_captain",
      { ...lobby, id: "other" },
      captains
    ),
    null
  )
  assert.equal(
    activeLobbyRole({ role: "Spectator" }, null, undefined, []),
    null
  )
})
