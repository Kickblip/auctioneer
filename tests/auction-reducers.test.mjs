import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { context, database, player, reducers, clerkIssuer } from "./helpers/reducers.mjs"
import { defaultSettings } from "../lib/auction/rules.ts"

function fixture() {
  const db = database()
  const lobbyId = randomUUID()
  const owner = context(db, "user_owner")
  reducers.createLobby(owner, { lobbyId, players: Array.from({ length: 12 }, (_, index) => ({ ...player, name: `Player ${index + 1}`, peakRank: { tag: "SilverI" } })) })
  for (const playerId of [1,2]) reducers.setPlayerCaptain(owner, { playerId, isCaptain: true })
  const captains = [context(db, "user_captain1"), context(db, "user_captain2")]
  captains.forEach((ctx, index) => reducers.joinAsCaptain(ctx, { lobbyId, playerId: index + 1 }))
  reducers.configureAuction(owner, { lobbyId, ...defaultSettings, teamCount: 2, teams: [{ captainPlayerId: 1, name: "One", budget: 10000, position: "Top" }, { captainPlayerId: 2, name: "Two", budget: 10000, position: "Top" }] })
  return { db, lobbyId, owner, captains, state: () => JSON.parse(db.auction.lobbyId.find(lobbyId).state) }
}
function later(ctx, milliseconds) {
  return { ...ctx, timestamp: { microsSinceUnixEpoch: ctx.timestamp.microsSinceUnixEpoch + BigInt(milliseconds) * 1000n }, senderAuth: ctx.senderAuth.jwt ? { jwt: { ...ctx.senderAuth.jwt, fullPayload: { exp: 1_800_010_000 } } } : ctx.senderAuth }
}
function expire(f, timer, milliseconds) {
  const system = later(context(f.db, "server"), milliseconds)
  system.senderAuth = { jwt: null }
  reducers.expireAuctionTimer(system, { arg: timer })
}

test("owner-only controls and captain-scoped bids, nominations, and roster edits reject impostors", () => {
  const f = fixture()
  const guest = context(f.db)
  const wrongOwner = context(f.db, "user_wrongOwner")
  for (const ctx of [guest, wrongOwner, f.captains[0]]) {
    assert.throws(() => reducers.controlAuction(ctx, { lobbyId: f.lobbyId, action: "start" }), /Clerk|owner/)
    assert.throws(() => reducers.adjustWallet(ctx, { lobbyId: f.lobbyId, teamId: 1, amount: 1, reason: "test" }), /Clerk|owner/)
    assert.throws(() => reducers.updateRankRules(ctx, { lobbyId: f.lobbyId, rankRules: defaultSettings.rankRules }), /Clerk|owner/)
  }
  reducers.controlAuction(f.owner, { lobbyId: f.lobbyId, action: "start" })
  const turn = f.state().order[0]
  assert.throws(() => reducers.nominatePlayer(f.captains[turn === 1 ? 1 : 0], { lobbyId: f.lobbyId, teamId: turn, playerId: 3, random: false }), /captain/)
  assert.throws(() => reducers.assignPlayerRole(f.captains[0], { lobbyId: f.lobbyId, teamId: 2, playerId: 2, position: "Mid" }), /captain/)
  assert.throws(() => reducers.placeBid(guest, { lobbyId: f.lobbyId, teamId: 1, amount: 200, nominationId: 1 }), /Clerk/)
  assert.throws(() => reducers.placeBid(f.captains[0], { lobbyId: f.lobbyId, teamId: 2, amount: 200, nominationId: 1 }), /captain/)
  reducers.nominatePlayer(f.owner, { lobbyId: f.lobbyId, teamId: turn, playerId: 3, random: false })
  assert.equal(f.state().phase, "reveal")
})

test("scheduled expiry runs without a client; stale schedules cannot sell after a new bid", () => {
  const f = fixture()
  reducers.controlAuction(f.owner, { lobbyId: f.lobbyId, action: "start" })
  reducers.nominatePlayer(f.owner, { lobbyId: f.lobbyId, teamId: f.state().order[0], playerId: 3, random: false })
  const revealTimer = [...f.db.auctionTimer.iter()][0]
  assert.throws(() => reducers.expireAuctionTimer(f.owner, { arg: revealTimer }), /Only the server/)
  expire(f, revealTimer, 5000)
  assert.equal(f.state().phase, "awaitingStart")
  reducers.controlAuction(later(f.owner, 5000), { lobbyId: f.lobbyId, action: "startBidding" })
  const oldTimer = [...f.db.auctionTimer.iter()][0]
  reducers.placeBid(later(f.captains[0], 15500), { lobbyId: f.lobbyId, teamId: 1, amount: 200, nominationId: f.state().nomination.id })
  expire(f, oldTimer, 16000)
  assert.equal(f.state().phase, "bidding")
  const timer = [...f.db.auctionTimer.iter()][0]
  expire(f, timer, 26500)
  assert.equal(f.state().phase, "sold")
  assert.equal(f.state().teams[0].balance, 9800)
  assert.equal([...f.db.auctionLog.iter()].filter((row) => row.kind === "sale").length, 1)
  expire(f, timer, 27000)
  assert.equal([...f.db.auctionLog.iter()].filter((row) => row.kind === "sale").length, 1)
})

test("private notes are isolated by verified identity and enforce the character limit", () => {
  const f = fixture()
  reducers.saveScoutingNote(f.captains[0], { playerId: 3, text: "Only captain one can read this." })
  const procedureContext = (ctx) => ({ ...ctx, withTx: (fn) => fn(ctx) })
  assert.equal(reducers.myScoutingNote(procedureContext(f.captains[0]), { playerId: 3 }), "Only captain one can read this.")
  assert.equal(reducers.myScoutingNote(procedureContext(f.captains[1]), { playerId: 3 }), "")
  assert.equal(reducers.myScoutingNote(procedureContext(f.owner), { playerId: 3 }), "")
  assert.throws(() => reducers.saveScoutingNote(context(f.db), { playerId: 3, text: "guest" }), /Clerk/)
  assert.throws(() => reducers.saveScoutingNote(f.captains[0], { playerId: 3, text: "x".repeat(281) }), /280/)
  assert.throws(() => reducers.myScoutingNote(procedureContext(context(f.db, "user_captain1", { issuer: clerkIssuer + ".evil" })), { playerId: 3 }), /Clerk/)
  assert.equal([...f.db.auctionLog.iter()].some((row) => row.data.includes("Only captain one")), false)
})

test("profile edits and rank correction are owner-only, protected during bidding, and audited", () => {
  const f = fixture()
  const profile = { ...f.db.player.id.find(3), playerId: 3, effectivePeakRank: "Challenger", opggUrl: "https://op.gg/lol/summoners/na/Test-NA1" }
  assert.throws(() => reducers.updatePlayerProfile(f.captains[0], profile), /owner/)
  assert.throws(() => reducers.updatePlayerProfile(f.owner, { ...profile, opggUrl: "javascript:alert(1)" }), /OP.GG/)
  reducers.updatePlayerProfile(f.owner, profile)
  assert.equal(f.db.player.id.find(3).effectivePeakRank, "Challenger")
  reducers.controlAuction(f.owner, { lobbyId: f.lobbyId, action: "start" })
  reducers.nominatePlayer(f.owner, { lobbyId: f.lobbyId, teamId: f.state().order[0], playerId: 3, random: false })
  assert.equal(f.state().nomination.bid, 4000)
  assert.throws(() => reducers.updatePlayerProfile(f.owner, profile), /Cancel/)
  assert.equal([...f.db.auctionLog.iter()].filter((row) => row.kind === "profile").length, 1)
})
