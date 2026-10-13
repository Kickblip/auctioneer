import {
  schema,
  SenderError,
  table,
  t,
  type InferSchema,
  type ReducerCtx,
} from "spacetimedb/server"
import { requireClerkUser } from "./auth"
import { ScheduleAt } from "spacetimedb"
import {
  applyCommand,
  createAuction,
  idleForOverride,
  isOverBudget,
  type Auction,
  type AuctionPlayer,
  type Command,
  type RankRule,
  type TeamInput,
} from "../../lib/auction/rules"

const rank = t.enum("Rank", [
  "Unranked",
  "IronIV",
  "IronIII",
  "IronII",
  "IronI",
  "BronzeIV",
  "BronzeIII",
  "BronzeII",
  "BronzeI",
  "SilverIV",
  "SilverIII",
  "SilverII",
  "SilverI",
  "GoldIV",
  "GoldIII",
  "GoldII",
  "GoldI",
  "PlatinumIV",
  "PlatinumIII",
  "PlatinumII",
  "PlatinumI",
  "EmeraldIV",
  "EmeraldIII",
  "EmeraldII",
  "EmeraldI",
  "DiamondIV",
  "DiamondIII",
  "DiamondII",
  "DiamondI",
  "Master",
  "Grandmaster",
  "Challenger",
])
const role = t.enum("Role", ["Top", "Jungle", "Mid", "ADC", "Support", "Fill"])

const playerFields = {
  name: t.string(), // "Kickball"
  discord: t.string(), // "kickball"
  riotIdGameName: t.string(), // "Kickball"
  riotIdTagline: t.string(), // "NA1"
  currentRank: rank,
  peakRank: rank,
  mainRole: role.optional(),
  secondaryRole: role.optional(),
}

const importFields = {
  ...playerFields,
  currentLp: t.u32().optional(),
  peakLp: t.u32().optional(),
  tournamentWins: t.u32().optional(),
  opggUrl: t.string().optional(),
}

const player = table(
  { public: true },
  {
    id: t.u32().primaryKey().autoInc(),
    ...playerFields,
    adminNotes: t.string().default(""),
    currentLp: t.u32().default(0),
    peakLp: t.u32().default(0),
    tournamentWins: t.u32().default(0),
    effectivePeakRank: t.string().default(""),
    opggUrl: t.string().default(""),
  }
)

const lobby = table(
  { public: true },
  {
    id: t.string().primaryKey(),
    owner: t.identity(),
    createdAt: t.timestamp(),
    ownerClerkId: t.string().default(""),
    eventName: t.string().default(""),
    completed: t.bool().default(false),
  }
)

// Keep existing player rows intact when adding lobby membership.
const lobbyPlayer = table(
  { public: true },
  {
    playerId: t.u32().primaryKey(),
    lobbyId: t.string().index("btree"),
  }
)

const captain = table(
  { public: true },
  {
    playerId: t.u32().primaryKey(),
    lobbyId: t.string().index("btree"),
    clerkUserId: t.string(),
  }
)

const auction = table(
  { public: true },
  {
    lobbyId: t.string().primaryKey(),
    state: t.string(),
    revision: t.u32(),
    updatedAt: t.timestamp(),
  }
)
const auctionTimer = table(
  {},
  {
    scheduledId: t.u64().primaryKey().autoInc(),
    scheduledAt: t.scheduleAt(),
    lobbyId: t.string().index("btree"),
    revision: t.u32(),
  }
)
const auctionLog = table(
  { public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    lobbyId: t.string().index("btree"),
    at: t.timestamp(),
    actor: t.string(),
    kind: t.string(),
    message: t.string(),
    data: t.string(),
  }
)
const scoutingNote = table(
  {},
  {
    key: t.string().primaryKey(),
    text: t.string(),
  }
)
const spacetimedb = schema({
  player,
  lobby,
  lobbyPlayer,
  captain,
  auction,
  auctionTimer,
  auctionLog,
  scoutingNote,
})

export default spacetimedb

type Context = ReducerCtx<InferSchema<typeof spacetimedb>>

function requireOwner(ctx: Context, lobbyId: string) {
  const userId = requireClerkUser(ctx)
  const record = ctx.db.lobby.id.find(lobbyId)
  if (!record || record.ownerClerkId !== userId) {
    throw new SenderError("Only the lobby owner can do this.")
  }
  return record
}

function playerLobby(ctx: Context, playerId: number) {
  const membership = ctx.db.lobbyPlayer.playerId.find(playerId)
  if (!membership) throw new SenderError("Player not found in a lobby.")
  return membership.lobbyId
}

export const createLobby = spacetimedb.reducer(
  {
    lobbyId: t.string(),
    players: t.array(t.object("PlayerInput", importFields)),
  },
  (ctx, { lobbyId, players }) => {
    const ownerClerkId = requireClerkUser(ctx)
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        lobbyId
      )
    ) {
      throw new SenderError("Invalid lobby ID.")
    }
    if (players.length === 0) {
      throw new SenderError("The CSV must contain at least one player.")
    }
    if (ctx.db.lobby.id.find(lobbyId)) {
      throw new SenderError("A lobby with this ID already exists.")
    }

    ctx.db.lobby.insert({
      id: lobbyId,
      owner: ctx.sender,
      createdAt: ctx.timestamp,
      ownerClerkId,
      eventName: "",
      completed: false,
    })
    for (const [index, record] of players.entries()) {
      for (const field of [
        "name",
        "discord",
        "riotIdGameName",
        "riotIdTagline",
      ] as const) {
        if (!record[field].trim()) {
          throw new SenderError(`Player ${index + 1} is missing ${field}.`)
        }
      }
      const inserted = ctx.db.player.insert({
        id: 0,
        ...record,
        adminNotes: "",
        currentLp: record.currentLp ?? 0,
        peakLp: record.peakLp ?? 0,
        tournamentWins: record.tournamentWins ?? 0,
        effectivePeakRank: "",
        opggUrl: validOpgg(record.opggUrl ?? ""),
      })
      ctx.db.lobbyPlayer.insert({ playerId: inserted.id, lobbyId })
    }
  }
)

export const updatePlayerAdminNotes = spacetimedb.reducer(
  { playerId: t.u32(), adminNotes: t.string() },
  (ctx, { playerId, adminNotes }) => {
    requireOwner(ctx, playerLobby(ctx, playerId))
    const player = ctx.db.player.id.find(playerId)
    if (!player) {
      throw new SenderError("Player not found.")
    }
    if (adminNotes.length > 5000) {
      throw new SenderError("Admin notes must be 5,000 characters or fewer.")
    }
    ctx.db.player.id.update({ ...player, adminNotes })
    logAction(
      ctx,
      playerLobby(ctx, playerId),
      "notes",
      `Admin notes updated for player ${playerId}`
    )
  }
)

// Existing lobbies can be linked once, using the original owner's browser token.
export const linkLegacyLobbyOwner = spacetimedb.reducer(
  { lobbyId: t.string(), clerkUserId: t.string() },
  (ctx, { lobbyId, clerkUserId }) => {
    const record = ctx.db.lobby.id.find(lobbyId)
    if (!record || record.ownerClerkId || !record.owner.isEqual(ctx.sender)) {
      throw new SenderError(
        "Use the original owner's browser to link this lobby."
      )
    }
    if (!/^user_[A-Za-z0-9]+$/.test(clerkUserId)) {
      throw new SenderError("Invalid Clerk user ID.")
    }
    ctx.db.lobby.id.update({ ...record, ownerClerkId: clerkUserId })
  }
)

export const joinAsOwner = spacetimedb.reducer(
  { lobbyId: t.string() },
  (ctx, { lobbyId }) => {
    requireOwner(ctx, lobbyId)
    if (ctx.db.auction.lobbyId.find(lobbyId)) {
      throw new SenderError(
        "Captains are locked after event setup. Configure the captain list before creating the event."
      )
    }
  }
)

export const setPlayerCaptain = spacetimedb.reducer(
  { playerId: t.u32(), isCaptain: t.bool() },
  (ctx, { playerId, isCaptain }) => {
    const lobbyId = playerLobby(ctx, playerId)
    requireOwner(ctx, lobbyId)
    if (isCaptain) {
      if (!ctx.db.captain.playerId.find(playerId)) {
        ctx.db.captain.insert({ playerId, lobbyId, clerkUserId: "" })
      }
    } else {
      ctx.db.captain.playerId.delete(playerId)
    }
  }
)

export const joinAsCaptain = spacetimedb.reducer(
  { lobbyId: t.string(), playerId: t.u32() },
  (ctx, { lobbyId, playerId }) => {
    const clerkUserId = requireClerkUser(ctx)
    const record = ctx.db.captain.playerId.find(playerId)
    if (!record || record.lobbyId !== lobbyId) {
      throw new SenderError("This player is not a captain in this lobby.")
    }
    if (record.clerkUserId && record.clerkUserId !== clerkUserId) {
      throw new SenderError(
        "This captain is already linked to another account."
      )
    }
    for (const other of ctx.db.captain.lobbyId.filter(lobbyId)) {
      if (other.playerId !== playerId && other.clerkUserId === clerkUserId) {
        throw new SenderError(
          "Your account is already linked to a captain in this lobby."
        )
      }
    }
    ctx.db.captain.playerId.update({ ...record, clerkUserId })
  }
)

export const init = spacetimedb.init((_ctx) => {
  // Called when the module is initially published
})

export const onConnect = spacetimedb.clientConnected((_ctx) => {
  // Called every time a new client connects
})

export const onDisconnect = spacetimedb.clientDisconnected((_ctx) => {
  // Called every time a client disconnects
})

function validOpgg(url: string) {
  if (!url) return ""
  try {
    const parsed = new URL(url)
    if (
      parsed.protocol === "https:" &&
      (parsed.hostname === "op.gg" || parsed.hostname.endsWith(".op.gg"))
    )
      return url
  } catch {
    /* Invalid URLs are rejected below. */
  }
  throw new SenderError(
    "OP.GG links must use https://op.gg or one of its subdomains."
  )
}
function enginePlayers(ctx: Context, lobbyId: string): AuctionPlayer[] {
  return [...ctx.db.lobbyPlayer.lobbyId.filter(lobbyId)].map((member) => {
    const row = ctx.db.player.id.find(member.playerId)!
    return {
      id: row.id,
      peakRank: row.effectivePeakRank || row.peakRank.tag,
      mainRole: row.mainRole?.tag,
      secondaryRole: row.secondaryRole?.tag,
    }
  })
}
function readAuction(ctx: Context, lobbyId: string): Auction {
  const row = ctx.db.auction.lobbyId.find(lobbyId)
  if (!row) throw new SenderError("The owner must configure this event first.")
  return JSON.parse(row.state)
}
function logAction(
  ctx: Context,
  lobbyId: string,
  kind: string,
  message: string,
  data: unknown = null
) {
  ctx.db.auctionLog.insert({
    id: BigInt(0),
    lobbyId,
    at: ctx.timestamp,
    actor: ctx.senderAuth.jwt?.subject ?? "system",
    kind,
    message,
    data: JSON.stringify(data),
  })
}
function saveAuction(ctx: Context, lobbyId: string, state: Auction) {
  const previous = ctx.db.auction.lobbyId.find(lobbyId)
  const revision = (previous?.revision ?? 0) + 1
  const row = {
    lobbyId,
    state: JSON.stringify(state),
    revision,
    updatedAt: ctx.timestamp,
  }
  if (previous) ctx.db.auction.lobbyId.update(row)
  else ctx.db.auction.insert(row)
  for (const timer of ctx.db.auctionTimer.lobbyId.filter(lobbyId))
    ctx.db.auctionTimer.scheduledId.delete(timer.scheduledId)
  if (state.deadline !== null && !state.paused) {
    ctx.db.auctionTimer.insert({
      scheduledId: BigInt(0),
      scheduledAt: ScheduleAt.time(BigInt(Math.ceil(state.deadline * 1000))),
      lobbyId,
      revision,
    })
  }
  const record = ctx.db.lobby.id.find(lobbyId)!
  ctx.db.lobby.id.update({
    ...record,
    eventName: state.settings.name,
    completed: state.phase === "complete",
  })
}
function runAuction(ctx: Context, lobbyId: string, command: Command) {
  const players = enginePlayers(ctx, lobbyId)
  const now = Number(ctx.timestamp.microsSinceUnixEpoch) / 1000
  try {
    const before = readAuction(ctx, lobbyId)
    const elapsed = applyCommand(
      before,
      { type: "tick" },
      players,
      now,
      ctx.random
    )
    const result =
      command.type === "tick"
        ? elapsed
        : applyCommand(elapsed.state, command, players, now, ctx.random)
    const events =
      command.type === "tick"
        ? result.events
        : [...elapsed.events, ...result.events]
    if (events.length) {
      saveAuction(ctx, lobbyId, result.state)
      for (const event of events)
        logAction(ctx, lobbyId, event.kind, event.message, event.data)
    }
  } catch (error) {
    throw new SenderError(
      error instanceof Error ? error.message : "Could not update the auction."
    )
  }
}
function requireTeam(
  ctx: Context,
  lobbyId: string,
  teamId: number,
  allowOwner = false
) {
  const userId = requireClerkUser(ctx)
  const record = ctx.db.lobby.id.find(lobbyId)
  if (allowOwner && record?.ownerClerkId === userId) return
  const state = readAuction(ctx, lobbyId)
  const team = state.teams.find((row) => row.id === teamId)
  const membership = team && ctx.db.captain.playerId.find(team.captainPlayerId)
  if (
    !membership ||
    membership.lobbyId !== lobbyId ||
    membership.clerkUserId !== userId
  ) {
    throw new SenderError("Only this team's signed-in captain can do this.")
  }
}

const rankRuleInput = t.object("RankRuleInput", {
  tier: t.string(),
  minimum: t.u32(),
  low: t.u32(),
  high: t.u32(),
})
export const configureAuction = spacetimedb.reducer(
  {
    lobbyId: t.string(),
    name: t.string(),
    teamCount: t.u32(),
    bidSeconds: t.u32(),
    revealSeconds: t.u32(),
    breakSeconds: t.u32(),
    rankRules: t.array(rankRuleInput),
    teams: t.array(
      t.object("TeamInput", {
        captainPlayerId: t.u32(),
        name: t.string(),
        budget: t.u32(),
        position: t.string(),
      })
    ),
  },
  (ctx, { lobbyId, teams, rankRules, ...settings }) => {
    requireOwner(ctx, lobbyId)
    const previous = ctx.db.auction.lobbyId.find(lobbyId)
    if (previous && readAuction(ctx, lobbyId).phase !== "setup")
      throw new SenderError(
        "The event has started; use the live controls to make changes."
      )
    for (const team of teams) {
      if (
        ctx.db.captain.playerId.find(team.captainPlayerId)?.lobbyId !== lobbyId
      )
        throw new SenderError(
          "Every team needs a captain assigned by the owner."
        )
    }
    try {
      const state = createAuction(
        { ...settings, rankRules: rankRules as RankRule[] },
        teams as TeamInput[],
        enginePlayers(ctx, lobbyId)
      )
      saveAuction(ctx, lobbyId, state)
      logAction(
        ctx,
        lobbyId,
        "configure",
        "Event settings and starting balances saved",
        { settings, teams, rankRules }
      )
    } catch (error) {
      throw new SenderError(
        error instanceof Error ? error.message : "Invalid event settings."
      )
    }
  }
)
export const nominatePlayer = spacetimedb.reducer(
  {
    lobbyId: t.string(),
    teamId: t.u32(),
    playerId: t.u32().optional(),
    random: t.bool(),
  },
  (ctx, { lobbyId, ...command }) => {
    requireTeam(ctx, lobbyId, command.teamId, true)
    runAuction(ctx, lobbyId, { type: "nominate", ...command })
  }
)
export const placeBid = spacetimedb.reducer(
  {
    lobbyId: t.string(),
    teamId: t.u32(),
    amount: t.u32(),
    nominationId: t.u32(),
  },
  (ctx, { lobbyId, ...command }) => {
    requireTeam(ctx, lobbyId, command.teamId)
    runAuction(ctx, lobbyId, { type: "bid", ...command })
  }
)
export const controlAuction = spacetimedb.reducer(
  { lobbyId: t.string(), action: t.string() },
  (ctx, { lobbyId, action }) => {
    requireOwner(ctx, lobbyId)
    const allowed = [
      "start",
      "startBidding",
      "advance",
      "pause",
      "resume",
      "resetTimer",
      "resetBid",
      "cancelNomination",
      "undoSale",
      "end",
    ] as const
    const type = allowed.find((value) => value === action)
    if (!type) throw new SenderError("Unknown auction control.")
    runAuction(ctx, lobbyId, { type })
  }
)
export const adjustWallet = spacetimedb.reducer(
  { lobbyId: t.string(), teamId: t.u32(), amount: t.i32(), reason: t.string() },
  (ctx, { lobbyId, ...command }) => {
    requireOwner(ctx, lobbyId)
    runAuction(ctx, lobbyId, { type: "wallet", ...command })
  }
)
export const returnPlayer = spacetimedb.reducer(
  { lobbyId: t.string(), teamId: t.u32(), playerId: t.u32() },
  (ctx, { lobbyId, ...command }) => {
    requireTeam(ctx, lobbyId, command.teamId, true)
    const state = readAuction(ctx, lobbyId)
    const owner =
      ctx.db.lobby.id.find(lobbyId)!.ownerClerkId === requireClerkUser(ctx)
    const team = state.teams.find((row) => row.id === command.teamId)
    if (
      !owner &&
      (state.phase !== "break" ||
        !team ||
        !isOverBudget(state, team, enginePlayers(ctx, lobbyId)))
    )
      throw new SenderError(
        "Captains return purchased players during the round break when over budget."
      )
    runAuction(ctx, lobbyId, { type: "return", ...command })
  }
)
export const assignPlayerRole = spacetimedb.reducer(
  {
    lobbyId: t.string(),
    teamId: t.u32(),
    playerId: t.u32(),
    position: t.string(),
  },
  (ctx, { lobbyId, ...command }) => {
    requireTeam(ctx, lobbyId, command.teamId, true)
    runAuction(ctx, lobbyId, { type: "role", ...command })
  }
)
export const transferPlayer = spacetimedb.reducer(
  { lobbyId: t.string(), playerId: t.u32(), teamId: t.u32() },
  (ctx, { lobbyId, ...command }) => {
    requireOwner(ctx, lobbyId)
    runAuction(ctx, lobbyId, { type: "transfer", ...command })
  }
)
export const editPickOrder = spacetimedb.reducer(
  { lobbyId: t.string(), order: t.array(t.u32()) },
  (ctx, { lobbyId, order }) => {
    requireOwner(ctx, lobbyId)
    runAuction(ctx, lobbyId, { type: "order", order })
  }
)
export const updateAuctionTimers = spacetimedb.reducer(
  {
    lobbyId: t.string(),
    bidSeconds: t.u32(),
    revealSeconds: t.u32(),
    breakSeconds: t.u32(),
  },
  (ctx, { lobbyId, ...command }) => {
    requireOwner(ctx, lobbyId)
    runAuction(ctx, lobbyId, { type: "timers", ...command })
  }
)
export const setAuctionTimer = spacetimedb.reducer(
  { lobbyId: t.string(), seconds: t.u32() },
  (ctx, { lobbyId, seconds }) => {
    requireOwner(ctx, lobbyId)
    runAuction(ctx, lobbyId, { type: "setTimer", seconds })
  }
)
export const updateRankRules = spacetimedb.reducer(
  { lobbyId: t.string(), rankRules: t.array(rankRuleInput) },
  (ctx, { lobbyId, rankRules }) => {
    requireOwner(ctx, lobbyId)
    runAuction(ctx, lobbyId, {
      type: "rankRules",
      rankRules: rankRules as RankRule[],
    })
  }
)
export const expireAuctionTimer = spacetimedb.reducer(
  { onSchedule: auctionTimer },
  { arg: auctionTimer.rowType },
  (ctx, { arg }) => {
    if (!ctx.sender.isEqual(ctx.databaseIdentity))
      throw new SenderError("Only the server can expire auction timers.")
    if (ctx.db.auction.lobbyId.find(arg.lobbyId)?.revision !== arg.revision)
      return
    runAuction(ctx, arg.lobbyId, { type: "tick" })
  }
)
export const serverTime = spacetimedb.procedure(
  t.f64(),
  (ctx) => Number(ctx.timestamp.microsSinceUnixEpoch) / 1000
)

export const updatePlayerProfile = spacetimedb.reducer(
  {
    playerId: t.u32(),
    ...playerFields,
    currentLp: t.u32(),
    peakLp: t.u32(),
    tournamentWins: t.u32(),
    effectivePeakRank: t.string(),
    opggUrl: t.string(),
  },
  (ctx, { playerId, ...fields }) => {
    const lobbyId = playerLobby(ctx, playerId)
    requireOwner(ctx, lobbyId)
    if (ctx.db.auction.lobbyId.find(lobbyId)) {
      try {
        idleForOverride(readAuction(ctx, lobbyId))
      } catch (error) {
        throw new SenderError((error as Error).message)
      }
    }
    const previous = ctx.db.player.id.find(playerId)!
    if (
      [
        fields.name,
        fields.discord,
        fields.riotIdGameName,
        fields.riotIdTagline,
      ].some((value) => !value.trim() || value.length > 100)
    )
      throw new SenderError("Names and usernames must be 1–100 characters.")
    if (
      fields.effectivePeakRank &&
      !/^(Unranked|Master|Grandmaster|Challenger|(Iron|Bronze|Silver|Gold|Platinum|Emerald|Diamond)(I|Ii|Iii|Iv))$/.test(
        fields.effectivePeakRank
      )
    )
      throw new SenderError("Choose a valid effective peak rank.")
    validOpgg(fields.opggUrl)
    ctx.db.player.id.update({ ...previous, ...fields })
    logAction(ctx, lobbyId, "profile", `Player ${playerId} profile updated`, {
      before: previous,
      after: fields,
    })
  }
)
export const saveScoutingNote = spacetimedb.reducer(
  { playerId: t.u32(), text: t.string() },
  (ctx, { playerId, text }) => {
    requireClerkUser(ctx)
    playerLobby(ctx, playerId)
    if ([...text].length > 280)
      throw new SenderError("Private notes must be 280 characters or fewer.")
    const key = `${ctx.sender.toHexString()}:${playerId}`
    if (ctx.db.scoutingNote.key.find(key))
      ctx.db.scoutingNote.key.update({ key, text })
    else ctx.db.scoutingNote.insert({ key, text })
  }
)
export const myScoutingNote = spacetimedb.procedure(
  { playerId: t.u32() },
  t.string(),
  (ctx, { playerId }) =>
    ctx.withTx((tx) => {
      requireClerkUser(tx)
      return (
        tx.db.scoutingNote.key.find(`${tx.sender.toHexString()}:${playerId}`)
          ?.text ?? ""
      )
    })
)
