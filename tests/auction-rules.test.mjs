import assert from "node:assert/strict"
import { test } from "node:test"
import { applyCommand, createAuction, defaultSettings, defaultRankRules, positions, maximumBid, minimumBid, reserveCost, isOverBudget, poolPlayers, pickOrder, randomPlayer, assignPosition, remainingDisplayMs, expectedValue } from "../lib/auction/rules.ts"

function fixture(teamCount = 2, budget = 10000, count = teamCount * 5 + 4) {
  const players = Array.from({ length: count }, (_, index) => ({ id: index + 1, peakRank: "SilverI", mainRole: "Top", secondaryRole: "Mid" }))
  const state = createAuction({ ...defaultSettings, teamCount }, Array.from({ length: teamCount }, (_, index) => ({ captainPlayerId: index + 1, name: `Team ${index + 1}`, budget, position: "Top" })), players)
  return { state, players }
}
const command = (state, action, players, now = 0, random = () => 0.5) => applyCommand(state, action, players, now, random).state
function bidding() {
  let { state, players } = fixture()
  state = command(state, { type: "start" }, players)
  state = command(state, { type: "nominate", teamId: state.order[0], playerId: 3, random: false }, players)
  state = command(state, { type: "tick" }, players, 5000)
  state = command(state, { type: "startBidding" }, players, 5000)
  return { state, players }
}

test("default rank minimums and expected division values match the event table", () => {
  for (const [rank, minimum] of [["Challenger",4000],["Grandmaster",3000],["Master",2000],["DiamondI",1000],["EmeraldIv",500],["PlatinumIi",200],["GoldI",100],["SilverIv",100]]) assert.equal(minimumBid({ id: 1, peakRank: rank }, defaultRankRules), minimum)
  assert.equal(expectedValue({ peakRank: "DiamondIv" }, defaultRankRules), 2750)
  assert.equal(expectedValue({ peakRank: "DiamondI" }, defaultRankRules), 4000)
  assert.equal(expectedValue({ peakRank: "EmeraldI" }, defaultRankRules), 2500)
})

test("maximum bids reserve E-1 other players for E=4,3,2,1, excluding the stand", () => {
  const { state, players } = fixture(2, 1000)
  for (let empty = 4; empty >= 1; empty--) {
    const team = structuredClone(state.teams[0])
    team.roster.push(...Array.from({ length: 4 - empty }, (_, index) => ({ playerId: 10 + index, position: positions[index + 1], price: 100, captain: false })))
    const next = { ...state, teams: [team, state.teams[1]], nomination: { playerId: 3 } }
    assert.equal(maximumBid(next, team, players), 1000 - (empty - 1) * 100)
  }
  const shortPool = players.slice(0, 4)
  assert.equal(maximumBid({ ...state, nomination: { playerId: 3 } }, state.teams[0], shortPool), 0)
  assert.equal(reserveCost([], 0, defaultRankRules), 0)
  assert.equal(reserveCost([], 1, defaultRankRules), Infinity)
  const expensiveOthers = players.map((player) => player.id >= 4 ? { ...player, peakRank: "Master" } : player)
  assert.equal(maximumBid({ ...state, teams: state.teams.map((team) => ({ ...team, balance: 10000 })), nomination: { playerId: 3 } }, { ...state.teams[0], balance: 10000 }, expensiveOthers), 4000)
})

test("compliance can fail when another team buys the cheapest remaining player", () => {
  const { state, players } = fixture(2, 1000)
  state.teams[0].balance = 400
  const ranked = players.map((player) => player.id >= 7 ? { ...player, peakRank: "Master" } : player)
  assert.equal(isOverBudget(state, state.teams[0], ranked), false)
  state.teams[1].roster.push({ playerId: 3, position: "Mid", price: 100, captain: false })
  assert.equal(isOverBudget(state, state.teams[0], ranked), true)
})

test("reveals and awaiting-start reject bids; nomination places the minimum opening bid", () => {
  let { state, players } = fixture()
  state = command(state, { type: "start" }, players)
  assert.throws(() => command(state, { type: "nominate", teamId: state.order[1], playerId: 3, random: false }, players), /not this captain/)
  state = command(state, { type: "nominate", teamId: state.order[0], playerId: 3, random: false }, players)
  assert.equal(state.nomination.bid, 100)
  assert.equal(state.nomination.bidderId, state.order[0])
  const bid = { type: "bid", teamId: 2, amount: 200, nominationId: state.nomination.id }
  assert.throws(() => command(state, bid, players, 2000), /closed/)
  assert.throws(() => command(state, { type: "startBidding" }, players, 2000), /reveal/)
  state = command(state, { type: "tick" }, players, 5000)
  assert.equal(state.phase, "awaitingStart")
  assert.throws(() => command(state, bid, players, 6000), /closed/)
  assert.equal(command(state, { type: "tick" }, players, 999999).phase, "awaitingStart")
})

test("equal and lower bids lose, each valid bid resets the timer, and grace bids count", () => {
  let { state, players } = bidding()
  const bid = { type: "bid", teamId: 2, amount: 200, nominationId: state.nomination.id }
  assert.equal(state.deadline, 16000)
  assert.equal(remainingDisplayMs(state, 15000), 0)
  state = command(state, bid, players, 15500)
  assert.equal(state.deadline, 26500)
  assert.throws(() => command(state, bid, players, 15500), /higher/)
  assert.throws(() => command(state, { ...bid, amount: 199 }, players, 15500), /higher/)
  assert.throws(() => command(state, { ...bid, amount: 300, nominationId: 999 }, players, 15500), /nomination has changed/)
  assert.throws(() => command(state, { ...bid, amount: 300 }, players, 26500), /closed/)
  assert.throws(() => command(state, { ...bid, amount: 10001 }, players, 16000), /maximum bid/)
  assert.throws(() => command(state, { ...bid, amount: 200.5 }, players, 16000), /whole number/)
})

test("expiry sells exactly once, debits the winner, assigns a role and waits for advance", () => {
  let { state, players } = bidding()
  const teamId = state.nomination.bidderId
  state = command(state, { type: "tick" }, players, 16000)
  assert.equal(state.phase, "sold")
  const team = state.teams.find((team) => team.id === teamId)
  assert.equal(team.balance, 9900)
  assert.equal(team.roster.find((slot) => slot.playerId === 3).position, "Mid")
  assert.equal(poolPlayers(state, players).some((player) => player.id === 3), false)
  assert.deepEqual(command(state, { type: "tick" }, players, 30000), state)
})

test("pause and resume preserve the visible timer and hidden grace, with optional reset", () => {
  let { state, players } = bidding()
  state = command(state, { type: "pause" }, players, 15500)
  assert.equal(state.remainingMs, 500)
  assert.equal(remainingDisplayMs(state, 99999), 0)
  assert.equal(state.deadline, null)
  assert.equal(command(state, { type: "tick" }, players, 99999).phase, "bidding")
  assert.throws(() => command(state, { type: "bid", teamId: 2, amount: 200, nominationId: state.nomination.id }, players, 99999), /paused/)
  state = command(state, { type: "resume" }, players, 100000)
  assert.equal(state.deadline, 100500)
  state = command(state, { type: "pause" }, players, 100100)
  state = command(state, { type: "resetTimer" }, players, 100100)
  state = command(state, { type: "resume" }, players, 101000)
  assert.equal(state.deadline, 112000)
  assert.equal(remainingDisplayMs(state, 101000), 10000)
})

test("forced returns refund half rounded down, restore the pool and repeat until compliant", () => {
  let { state, players } = fixture()
  const team = state.teams[0]
  state.phase = "break"
  team.balance = 0
  team.roster.push({ playerId: 3, price: 201, position: "Mid", captain: false }, { playerId: 4, price: 1001, position: "Jungle", captain: false })
  assert.equal(isOverBudget(state, team, players), true)
  assert.throws(() => command(state, { type: "advance" }, players), /over-budget/)
  assert.throws(() => command(state, { type: "return", teamId: 1, playerId: 1 }, players), /captains cannot/)
  state = command(state, { type: "return", teamId: 1, playerId: 3 }, players)
  assert.equal(state.teams[0].balance, 100)
  assert.equal(isOverBudget(state, state.teams[0], players), true)
  assert.equal(poolPlayers(state, players).some((player) => player.id === 3), true)
  state = command(state, { type: "return", teamId: 1, playerId: 4 }, players)
  assert.equal(state.teams[0].balance, 600)
  assert.equal(isOverBudget(state, state.teams[0], players), false)
  assert.equal(command(state, { type: "advance" }, players).phase, "nomination")
})

test("pick order follows remaining balances, breaks ties randomly and resets each round", () => {
  const { state, players } = fixture(4)
  state.teams[0].balance = 9000; state.teams[1].balance = 8000; state.teams[2].balance = 9000; state.teams[3].balance = 5000
  const order = pickOrder(state.teams, () => 0)
  assert.deepEqual(order.slice(0, 2).sort(), [1, 3])
  assert.deepEqual(order.slice(2), [2, 4])
  assert.notDeepEqual(pickOrder(state.teams, () => 0), pickOrder(state.teams, () => .999))
  state.phase = "break"; state.round = 1; state.order = [4, 3, 2, 1]
  assert.deepEqual(command(state, { type: "advance" }, players, 0, () => .999).order, [1, 3, 2, 4])
})

test("role assignment prefers primary, secondary, then the next open slot; reassignment swaps", () => {
  assert.equal(assignPosition([], "Mid", "Support"), "Mid")
  const taken = [{ playerId: 1, position: "Mid" }]
  assert.equal(assignPosition(taken, "Mid", "Support"), "Support")
  assert.equal(assignPosition([...taken, { position: "Support" }], "Mid", "Support"), "Top")
  assert.equal(assignPosition([], "Fill", "Fill"), "Top")
  const { state, players } = fixture()
  state.teams[0].roster.push({ playerId: 3, position: "Mid", price: 100, captain: false })
  const moved = command(state, { type: "role", teamId: 1, playerId: 1, position: "Mid" }, players)
  assert.equal(moved.teams[0].roster[0].position, "Mid")
  assert.equal(moved.teams[0].roster[1].position, "Top")
})

test("random selection gives each unsold player an equal interval and excludes captains/sales", () => {
  const { state, players } = fixture()
  state.teams[0].roster.push({ playerId: 3, position: "Mid", price: 100, captain: false })
  const pool = poolPlayers(state, players)
  assert.equal(pool.some((player) => player.id <= 3), false)
  const counts = new Map(pool.map((player) => [player.id, 0]))
  for (let i = 0; i < pool.length * 100; i++) {
    const picked = randomPlayer(pool, () => (i + .5) / (pool.length * 100))
    counts.set(picked.id, counts.get(picked.id) + 1)
  }
  assert.ok([...counts.values()].every((count) => count === 100))
})

test("undo reverses one sale and returns the player to the stand with a fresh nomination ID", () => {
  let { state, players } = bidding()
  const oldId = state.nomination.id
  const teamId = state.nomination.bidderId
  state = command(state, { type: "tick" }, players, state.deadline)
  state = command(state, { type: "undoSale" }, players, 20000)
  assert.equal(state.teams.find((team) => team.id === teamId).balance, 10000)
  assert.equal(state.phase, "awaitingStart")
  assert.equal(state.nomination.playerId, 3)
  assert.ok(state.nomination.id > oldId)
  assert.throws(() => command(state, { type: "undoSale" }, players), /Cancel/)
})

test("an eight-team auction completes four rounds with five unique players per team", () => {
  let { state, players } = fixture(8)
  state = command(state, { type: "start" }, players)
  let now = 1000
  let sales = 0
  while (state.phase !== "complete" && sales < 40) {
    if (state.phase === "break") { now = state.deadline; state = command(state, { type: "advance" }, players, now) }
    const playerId = poolPlayers(state, players)[0].id
    state = command(state, { type: "nominate", teamId: state.order[state.turnIndex], playerId, random: false }, players, now)
    now = state.deadline
    state = command(state, { type: "tick" }, players, now)
    state = command(state, { type: "startBidding" }, players, now)
    now = state.deadline
    state = command(state, { type: "tick" }, players, now)
    sales++
    state = command(state, { type: "advance" }, players, now)
  }
  assert.equal(state.phase, "complete")
  assert.equal(state.round, 4)
  assert.equal(sales, 32)
  assert.ok(state.teams.every((team) => team.roster.length === 5 && team.balance === 9600 && new Set(team.roster.map((slot) => slot.position)).size === 5))
  assert.equal(new Set(state.teams.flatMap((team) => team.roster.map((slot) => slot.playerId))).size, 40)
})
