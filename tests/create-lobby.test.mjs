import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { Rank, Role } from "../src/module_bindings/types.ts"

// Run against the isolated test database described in README.md.
const databaseUrl = "http://127.0.0.1:3101/v1/database/auctioneer-lobby-test"

async function rows(table) {
  const response = await fetch(`${databaseUrl}/sql`, {
    method: "POST",
    body: `SELECT * FROM ${table}`,
  })
  assert.equal(response.status, 200, await response.clone().text())
  return (await response.json())[0].rows
}

function createLobby(id, players) {
  return fetch(`${databaseUrl}/call/create_lobby`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([id, players]),
  })
}

function variant(type, tag) {
  return [Object.keys(type.variants).indexOf(tag), []]
}

test("creates a lobby and roster atomically; rejects invalid and duplicate writes", async () => {
  const lobbyId = randomUUID()
  const player = [
    "Kickball",
    "kickball",
    "Kickball",
    "NA1",
    { diamondIi: [] },
    { master: [] },
    { some: { mid: [] } },
    { none: [] },
  ]
  const secondPlayer = [
    "Support",
    "support",
    "Support",
    "NA1",
    { unranked: [] },
    { challenger: [] },
    { none: [] },
    { some: { fill: [] } },
  ]
  const before = await rows("player")
  const created = await createLobby(lobbyId, [player, secondPlayer])
  assert.ok(created.ok, await created.text())

  assert.ok((await rows("lobby")).some(([id]) => id === lobbyId))
  const memberships = (await rows("lobby_player")).filter(
    ([, id]) => id === lobbyId
  )
  assert.equal(memberships.length, 2)
  const players = await rows("player")
  assert.equal(players.length, before.length + 2)
  const roster = memberships.map(([playerId]) =>
    players.find(([id]) => id === playerId)
  )
  assert.deepEqual(
    roster.map((row) => row.slice(1)),
    [
      [
        ...player.slice(0, 4),
        variant(Rank, "DiamondIi"),
        variant(Rank, "Master"),
        [0, variant(Role, "Mid")],
        [1, []],
      ],
      [
        ...secondPlayer.slice(0, 4),
        variant(Rank, "Unranked"),
        variant(Rank, "Challenger"),
        [1, []],
        [0, variant(Role, "Fill")],
      ],
    ]
  )

  const snapshot = {
    lobby: await rows("lobby"),
    lobby_player: await rows("lobby_player"),
    player: players,
  }
  for (const [id, records, message] of [
    [randomUUID(), [player, [" ", ...secondPlayer.slice(1)]], /missing name/],
    [randomUUID(), [], /at least one player/],
    ["invalid", [player], /Invalid lobby ID/],
    [lobbyId, [player], /already exists/],
    [randomUUID(), [player.with(4, "Plat 3")], /invalid arguments/],
    [randomUUID(), [player.with(5, { platinumV: [] })], /invalid arguments/],
    [randomUUID(), [player.with(4, { none: [] })], /invalid arguments/],
    [randomUUID(), [player.with(6, { some: { jgl: [] } })], /invalid arguments/],
    [randomUUID(), [player.with(7, { some: "Support" })], /invalid arguments/],
  ]) {
    const response = await createLobby(id, records)
    assert.equal(response.ok, false)
    assert.match(await response.text(), message)
    for (const table of Object.keys(snapshot)) {
      assert.deepEqual(
        await rows(table),
        snapshot[table],
        `${table} changed after a failed creation`
      )
    }
  }
})
