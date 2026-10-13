import assert from "node:assert/strict"
import { mock, test } from "node:test"
import { Rank, Role } from "../src/module_bindings/types.ts"

const parse = mock.fn()
const auth = mock.fn(async () => ({ userId: "user_test" }))
mock.module("@clerk/nextjs/server", { namedExports: { auth } })
mock.module("openai", {
  defaultExport: class OpenAI {
    responses = { parse }
  },
})

const { POST } = await import("../app/api/players/parse/route.ts")

test("requires Clerk sign-in before parsing a spreadsheet", async () => {
  const calls = parse.mock.callCount()
  auth.mock.mockImplementationOnce(async () => ({ userId: null }))
  assert.equal((await POST(upload())).status, 401)
  assert.equal(parse.mock.callCount(), calls)
})

const player = {
  name: "Kickball",
  discord: "kickball",
  riotIdGameName: "Kickball",
  riotIdTagline: "NA1",
  currentRank: "PlatinumIii",
  peakRank: "Master",
  mainRole: "Mid",
  secondaryRole: null,
  currentLp: 34,
  peakLp: 120,
  tournamentWins: 2,
  opggUrl: "https://op.gg/lol/summoners/na/Kickball-NA1",
}

function complete(players) {
  parse.mock.mockImplementation(async ({ text }) => ({
    status: "completed",
    output_parsed: text.format.$parseRaw(JSON.stringify({ players })),
  }))
}

function upload(name = "players.csv", content = "name\nKickball") {
  const body = new FormData()
  body.set("file", new File([content], name))
  return new Request("http://localhost/api/players/parse", {
    method: "POST",
    body,
  })
}

test("returns canonical enum values ready for lobby creation", async () => {
  complete([player])
  const response = await POST(upload())
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    players: [
      {
        name: player.name,
        discord: player.discord,
        riotIdGameName: player.riotIdGameName,
        riotIdTagline: player.riotIdTagline,
        currentRank: Rank.PlatinumIii,
        peakRank: Rank.Master,
        mainRole: Role.Mid,
        currentLp: 34,
        peakLp: 120,
        tournamentWins: 2,
        opggUrl: player.opggUrl,
      },
    ],
  })
})

test("accepts every rank and role, including Fill and either role absent", async () => {
  const ranks = Object.keys(Rank.variants)
  const roles = [...Object.keys(Role.variants), null]
  complete(
    ranks.map((rank, index) => ({
      ...player,
      currentRank: rank,
      peakRank: rank,
      mainRole: roles[index % roles.length],
      secondaryRole: roles[(index + 1) % roles.length],
    }))
  )
  const response = await POST(upload())
  assert.equal(response.status, 200)
  const { players } = await response.json()
  for (const [index, record] of players.entries()) {
    assert.deepEqual(record.currentRank, Rank[ranks[index]])
    assert.deepEqual(record.peakRank, Rank[ranks[index]])
    assert.deepEqual(record.mainRole, Role[roles[index % roles.length]])
    assert.deepEqual(
      record.secondaryRole,
      Role[roles[(index + 1) % roles.length]]
    )
  }
})

test("defaults either or both missing ranks to Unranked while preserving known ranks", async () => {
  for (const [currentRank, peakRank, expectedCurrent, expectedPeak] of [
    [null, "Master", Rank.Unranked, Rank.Master],
    ["PlatinumIii", null, Rank.PlatinumIii, Rank.Unranked],
    [null, null, Rank.Unranked, Rank.Unranked],
  ]) {
    complete([player, { ...player, currentRank, peakRank }])
    const response = await POST(upload())
    assert.equal(response.status, 200)
    const { players } = await response.json()
    assert.equal(players.length, 2)
    assert.deepEqual(players[0].currentRank, Rank.PlatinumIii)
    assert.deepEqual(players[0].peakRank, Rank.Master)
    assert.deepEqual(players[1].currentRank, expectedCurrent)
    assert.deepEqual(players[1].peakRank, expectedPeak)
  }
})

test("structured output rejects noncanonical ranks and roles", async () => {
  for (const [field, value] of [
    ["currentRank", "Plat 3"],
    ["peakRank", "Platinum 3"],
    ["currentRank", "PlatinumV"],
    ["mainRole", "jgl"],
    ["secondaryRole", "unknown"],
  ]) {
    complete([{ ...player, [field]: value }])
    assert.equal((await POST(upload())).status, 502)
  }
})

test("rejects invalid uploads before calling OpenAI", async () => {
  const calls = parse.mock.callCount()
  for (const request of [
    upload("players.txt"),
    upload("players.csv", ""),
    new Request("http://localhost", { method: "POST", body: "invalid" }),
  ]) {
    assert.equal((await POST(request)).status, 400)
  }
  assert.equal(parse.mock.callCount(), calls)
})

test("returns 502 for incomplete results and upstream failures", async () => {
  for (const result of [
    { status: "incomplete", output_parsed: { players: [] } },
    { status: "completed", output_parsed: null },
  ]) {
    parse.mock.mockImplementation(async () => result)
    assert.equal((await POST(upload())).status, 502)
  }
  parse.mock.mockImplementation(async () => {
    throw new Error("upstream unavailable")
  })
  assert.equal((await POST(upload())).status, 502)
})
