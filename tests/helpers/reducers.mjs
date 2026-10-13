import { registerHooks } from "node:module"

// Load the real reducer functions without the SpacetimeDB native host.
const originalConsole = globalThis.console
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("spacetime:"))
      return { url: specifier, shortCircuit: true }
    if (
      specifier === "./auth" &&
      context.parentURL.endsWith("/spacetimedb/src/index.ts")
    )
      return next("./auth.ts", context)
    if (specifier === "../../lib/auction/rules")
      return next("../../lib/auction/rules.ts", context)
    return next(specifier, context)
  },
  load(url, context, next) {
    if (url.startsWith("spacetime:"))
      return {
        format: "module",
        source:
          'export const moduleHooks = Symbol("test-hooks"); export function row_iter_bsatn_close() { throw new Error("Unexpected native syscall"); }',
        shortCircuit: true,
      }
    return next(url, context)
  },
})

export let reducers
export let clerkIssuer
try {
  reducers = await import("../../spacetimedb/src/index.ts")
  ;({ clerkIssuer } = await import("../../spacetimedb/src/auth.ts"))
} finally {
  globalThis.console = originalConsole
  hooks.deregister()
}

export function database() {
  const db = {}
  for (const [name, key] of [
    ["lobby", "id"],
    ["player", "id"],
    ["lobbyPlayer", "playerId"],
    ["captain", "playerId"],
    ["auction", "lobbyId"],
    ["auctionTimer", "scheduledId"],
    ["auctionLog", "id"],
    ["scoutingNote", "key"],
  ]) {
    const records = new Map()
    let nextId = 1
    db[name] = {
      insert(row) {
        if (name === "player" && row.id === 0) row = { ...row, id: nextId++ }
        if (row[key] === 0n) row = { ...row, [key]: BigInt(nextId++) }
        if (records.has(row[key])) throw new Error("Duplicate primary key")
        records.set(row[key], row)
        return row
      },
      [key]: {
        find: (id) => records.get(id),
        update: (row) => records.set(row[key], row),
        delete: (id) => records.delete(id),
      },
      ...(key !== "lobbyId"
        ? {
            lobbyId: {
              filter: (id) =>
                [...records.values()].filter((row) => row.lobbyId === id),
            },
          }
        : {}),
      iter: () => records.values(),
    }
  }
  return db
}

export function context(db, userId, jwtOverrides = {}) {
  return {
    db,
    sender: {
      id: userId ?? "guest",
      isEqual(other) {
        return this.id === other.id
      },
      toHexString() {
        return this.id
      },
    },
    timestamp: { microsSinceUnixEpoch: 1_800_000_000_000_000n },
    databaseIdentity: { id: "server" },
    random: () => 0.5,
    senderAuth: {
      jwt: userId
        ? {
            issuer: clerkIssuer,
            subject: userId,
            fullPayload: { exp: 1_800_000_060 },
            ...jwtOverrides,
          }
        : null,
    },
  }
}

export const player = {
  name: "Kickball",
  discord: "kickball",
  riotIdGameName: "Kickball",
  riotIdTagline: "NA1",
  currentRank: { tag: "DiamondIi" },
  peakRank: { tag: "Master" },
  mainRole: { tag: "Mid" },
  secondaryRole: undefined,
}
