import assert from "node:assert/strict"
import { test } from "node:test"
import {
  getLobbyPlayers,
  rankLabel,
  roleLabel,
} from "../app/lobby/[lobbyId]/edit/players.ts"
import { Rank, Role } from "../src/module_bindings/types.ts"

test("shows only the requested lobby's players in insertion order without changing the cache", () => {
  const player = {
    name: "Kickball",
    discord: "kickball",
    riotIdGameName: "Kickball",
    riotIdTagline: "NA1",
    currentRank: Rank.DiamondIi,
    peakRank: Rank.Master,
    mainRole: Role.Mid,
    secondaryRole: undefined,
    adminNotes: "",
  }
  const players = Object.freeze([
    { ...player, id: 3, name: "Other lobby" },
    { ...player, id: 2, secondaryRole: Role.Support },
    { ...player, id: 1 },
  ])
  const memberships = [
    { playerId: 1, lobbyId: "a" },
    { playerId: 2, lobbyId: "a" },
    { playerId: 3, lobbyId: "b" },
  ]

  assert.deepEqual(getLobbyPlayers("a", players, memberships), [
    players[2],
    players[1],
  ])
  assert.deepEqual(getLobbyPlayers("b", players, memberships), [players[0]])
  assert.deepEqual(getLobbyPlayers("missing", players, memberships), [])
  assert.deepEqual(getLobbyPlayers("a", [], memberships), [])
})

test("renders canonical rank and role labels, including absent roles", () => {
  for (const tier of [
    "Iron",
    "Bronze",
    "Silver",
    "Gold",
    "Platinum",
    "Emerald",
    "Diamond",
  ]) {
    for (const division of ["I", "Ii", "Iii", "Iv"]) {
      assert.equal(
        rankLabel(Rank[`${tier}${division}`]),
        `${tier} ${division.toUpperCase()}`
      )
    }
  }
  for (const tag of ["Unranked", "Master", "Grandmaster", "Challenger"]) {
    assert.equal(rankLabel(Rank[tag]), tag)
  }
  assert.equal(roleLabel(Role.Adc), "ADC")
  assert.equal(roleLabel(Role.Fill), "Fill")
  assert.equal(roleLabel(Role.Top), "Top")
  assert.equal(roleLabel(undefined), "—")
})
