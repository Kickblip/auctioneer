// Pure rules: the caller supplies time and randomness.
export const positions = ["Top", "Jungle", "Mid", "Adc", "Support"] as const
export type Position = (typeof positions)[number]
export const tiers = [
  "Unranked",
  "Iron",
  "Bronze",
  "Silver",
  "Gold",
  "Platinum",
  "Emerald",
  "Diamond",
  "Master",
  "Grandmaster",
  "Challenger",
] as const
export type Tier = (typeof tiers)[number]
export type RankRule = {
  tier: Tier
  minimum: number
  low: number
  high: number
}
export const defaultRankRules: RankRule[] = tiers.map((tier, i) => ({
  tier,
  minimum: [100, 100, 100, 100, 100, 200, 500, 1000, 2000, 3000, 4000][i],
  low: [100, 100, 250, 500, 750, 1000, 1500, 2750, 4500, 6000, 8000][i],
  high: [100, 100, 250, 500, 750, 1250, 2500, 4000, 4500, 6000, 8000][i],
}))
export type Settings = {
  name: string
  teamCount: number
  bidSeconds: number
  revealSeconds: number
  breakSeconds: number
  rankRules: RankRule[]
}
export const defaultSettings: Settings = {
  name: "Coven Auction",
  teamCount: 8,
  bidSeconds: 10,
  revealSeconds: 5,
  breakSeconds: 60,
  rankRules: defaultRankRules,
}
export const graceMs = 1000
export type AuctionPlayer = {
  id: number
  peakRank: string
  mainRole?: string
  secondaryRole?: string
}
export type RosterSlot = {
  playerId: number
  position: Position
  price: number
  captain: boolean
}
export type Team = {
  id: number
  captainPlayerId: number
  name: string
  initialBalance: number
  balance: number
  roster: RosterSlot[]
}
export type TeamInput = {
  captainPlayerId: number
  name: string
  budget: number
  position: Position
}
export type Bid = { teamId: number; amount: number; at: number }
export type Nomination = {
  id: number
  playerId: number
  nominatorId: number
  bid: number
  bidderId: number
  random: boolean
  revealedAt: number
  bids: Bid[]
}
export type Phase =
  | "setup"
  | "nomination"
  | "reveal"
  | "awaitingStart"
  | "bidding"
  | "sold"
  | "break"
  | "complete"
export type Sale = {
  playerId: number
  teamId: number
  price: number
  round: number
  order: number[]
  turnIndex: number
  nomination: Nomination
}
export type Auction = {
  settings: Settings
  teams: Team[]
  phase: Phase
  round: number
  order: number[]
  turnIndex: number
  sequence: number
  nomination: Nomination | null
  deadline: number | null
  paused: boolean
  remainingMs: number
  lastSale: Sale | null
}
export type Audit = { kind: string; message: string; data?: unknown }
export type Command =
  | {
      type:
        | "start"
        | "startBidding"
        | "advance"
        | "pause"
        | "resume"
        | "resetTimer"
        | "resetBid"
        | "cancelNomination"
        | "undoSale"
        | "end"
        | "tick"
    }
  | { type: "nominate"; teamId: number; playerId?: number; random: boolean }
  | { type: "bid"; teamId: number; amount: number; nominationId: number }
  | { type: "return"; playerId: number; teamId: number }
  | { type: "wallet"; teamId: number; amount: number; reason: string }
  | { type: "role"; teamId: number; playerId: number; position: string }
  | { type: "transfer"; playerId: number; teamId: number }
  | { type: "order"; order: number[] }
  | {
      type: "timers"
      bidSeconds: number
      revealSeconds: number
      breakSeconds: number
    }
  | { type: "setTimer"; seconds: number }
  | { type: "rankRules"; rankRules: RankRule[] }

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}
export function integer(
  value: number,
  min: number,
  max: number,
  label: string
) {
  check(
    Number.isSafeInteger(value) && value >= min && value <= max,
    `${label} must be a whole number between ${min} and ${max}.`
  )
  return value
}
export function rankTier(rank: string): Tier {
  return tiers.find((tier) => rank.startsWith(tier)) ?? "Unranked"
}
export function minimumBid(player: AuctionPlayer, rules: RankRule[]) {
  return rules.find((rule) => rule.tier === rankTier(player.peakRank))!.minimum
}
export function expectedValue(player: AuctionPlayer, rules: RankRule[]) {
  const rule = rules.find((row) => row.tier === rankTier(player.peakRank))!
  const division = ["Iv", "Iii", "Ii", "I"].indexOf(
    player.peakRank.slice(rule.tier.length)
  )
  return Math.round(
    rule.low + ((rule.high - rule.low) * Math.max(0, division)) / 3
  )
}
export function rankOrder(rank: string) {
  return (
    tiers.indexOf(rankTier(rank)) * 4 +
    Math.max(
      0,
      ["Iv", "Iii", "Ii", "I"].indexOf(rank.slice(rankTier(rank).length))
    )
  )
}
export function emptySlots(team: Team) {
  return 5 - team.roster.length
}
export function poolPlayers(
  state: Auction,
  players: AuctionPlayer[],
  excludeStand = true
) {
  const sold = new Set(
    state.teams.flatMap((team) => team.roster.map((slot) => slot.playerId))
  )
  return players.filter(
    (player) =>
      !sold.has(player.id) &&
      (!excludeStand || player.id !== state.nomination?.playerId)
  )
}
export function reserveCost(
  pool: AuctionPlayer[],
  slots: number,
  rules: RankRule[]
) {
  if (slots <= 0) return 0
  if (pool.length < slots) return Infinity
  return pool
    .map((player) => minimumBid(player, rules))
    .sort((a, b) => a - b)
    .slice(0, slots)
    .reduce((sum, price) => sum + price, 0)
}
export function maximumBid(
  state: Auction,
  team: Team,
  players: AuctionPlayer[],
  standId = state.nomination?.playerId
) {
  if (emptySlots(team) <= 0) return 0
  const pool = poolPlayers(state, players, false).filter(
    (player) => player.id !== standId
  )
  return Math.max(
    0,
    team.balance -
      reserveCost(pool, emptySlots(team) - 1, state.settings.rankRules)
  )
}
export function isOverBudget(
  state: Auction,
  team: Team,
  players: AuctionPlayer[]
) {
  return (
    team.balance <
    reserveCost(
      poolPlayers(state, players, false),
      emptySlots(team),
      state.settings.rankRules
    )
  )
}
export function assignPosition(
  roster: RosterSlot[],
  primary?: string,
  secondary?: string
): Position {
  const open = positions.filter(
    (position) => !roster.some((slot) => slot.position === position)
  )
  check(open.length, "This team has no empty roster slots.")
  return (
    ([primary, secondary].find((position) =>
      open.includes(position as Position)
    ) as Position | undefined) ?? open[0]
  )
}
export function pickOrder(teams: Team[], random: () => number) {
  const shuffled = teams.filter((team) => emptySlots(team) > 0).slice()
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.sort((a, b) => b.balance - a.balance).map((team) => team.id)
}
export function randomPlayer(pool: AuctionPlayer[], random: () => number) {
  check(pool.length, "No players remain in the pool.")
  return pool[Math.floor(random() * pool.length)]
}
export function validateRankRules(rules: RankRule[]) {
  check(
    Array.isArray(rules) &&
      rules.length === tiers.length &&
      new Set(rules.map((row) => row.tier)).size === tiers.length,
    "Provide one rank rule for every tier."
  )
  for (const row of rules) {
    check(tiers.includes(row.tier), "Unknown rank tier.")
    integer(row.minimum, 1, 1_000_000, "Minimum bid")
    integer(row.low, 1, 1_000_000, "Expected value")
    integer(row.high, row.low, 1_000_000, "Expected high value")
  }
}
export function validateTimers(
  settings: Pick<Settings, "bidSeconds" | "revealSeconds" | "breakSeconds">
) {
  integer(settings.bidSeconds, 1, 600, "Bid seconds")
  integer(settings.revealSeconds, 0, 60, "Reveal seconds")
  integer(settings.breakSeconds, 0, 3600, "Break seconds")
}
export function createAuction(
  settings: Settings,
  inputs: TeamInput[],
  players: AuctionPlayer[]
): Auction {
  check(
    typeof settings.name === "string" &&
      settings.name.trim().length > 0 &&
      settings.name.length <= 100,
    "Event name is required (100 characters maximum)."
  )
  integer(settings.teamCount, 2, 16, "Number of teams")
  validateTimers(settings)
  validateRankRules(settings.rankRules)
  check(
    inputs.length === settings.teamCount,
    "Assign one captain and starting balance to each team."
  )
  check(
    new Set(inputs.map((team) => team.captainPlayerId)).size === inputs.length,
    "A captain can only lead one team."
  )
  const teams = inputs.map((input, index): Team => {
    check(
      players.some((player) => player.id === input.captainPlayerId),
      "Captain not found in this lobby."
    )
    check(
      typeof input.name === "string" &&
        input.name.trim().length > 0 &&
        input.name.length <= 60,
      "Team names must be between 1 and 60 characters."
    )
    check(
      positions.includes(input.position),
      "Choose a captain's roster position."
    )
    integer(input.budget, 0, 1_000_000_000, "Starting balance")
    return {
      id: index + 1,
      captainPlayerId: input.captainPlayerId,
      name: input.name.trim(),
      initialBalance: input.budget,
      balance: input.budget,
      roster: [
        {
          playerId: input.captainPlayerId,
          position: input.position,
          price: 0,
          captain: true,
        },
      ],
    }
  })
  return {
    settings: { ...settings, name: settings.name.trim() },
    teams,
    phase: "setup",
    round: 0,
    order: [],
    turnIndex: 0,
    sequence: 0,
    nomination: null,
    deadline: null,
    paused: false,
    remainingMs: 0,
    lastSale: null,
  }
}
export function teamById(state: Auction, id: number) {
  const team = state.teams.find((row) => row.id === id)
  check(team, "Team not found.")
  return team
}
export function idleForOverride(state: Auction) {
  check(
    !["reveal", "awaitingStart", "bidding"].includes(state.phase),
    "Cancel the current nomination before changing wallets, players, or rank rules."
  )
}
function standingPlayer(state: Auction, players: AuctionPlayer[]) {
  const player = players.find((row) => row.id === state.nomination?.playerId)
  check(player && state.nomination, "No player is on the stand.")
  return player
}
function validStandingBid(state: Auction, players: AuctionPlayer[]) {
  const player = standingPlayer(state, players)
  const bid = state.nomination!
  const team = teamById(state, bid.bidderId)
  check(emptySlots(team) > 0, "This team has no empty roster slots.")
  check(
    bid.bid >= minimumBid(player, state.settings.rankRules),
    "The bid is below this player's minimum."
  )
  check(
    bid.bid <= maximumBid(state, team, players),
    "The bid exceeds this team's maximum bid."
  )
}
export function remainingDisplayMs(state: Auction, now: number) {
  const remaining = state.paused
    ? state.remainingMs
    : state.deadline === null
      ? 0
      : state.deadline - now
  return Math.max(0, remaining - (state.phase === "bidding" ? graceMs : 0))
}

export function applyCommand(
  original: Auction,
  command: Command,
  players: AuctionPlayer[],
  now: number,
  random: () => number = () => 0.5
): { state: Auction; events: Audit[] } {
  const state: Auction = JSON.parse(JSON.stringify(original))
  const events: Audit[] = []
  const log = (kind: string, message: string, data?: unknown) =>
    events.push({ kind, message, data })
  const active = () => check(!state.paused, "Auction paused.")
  const resetTimer = () => {
    check(
      ["bidding", "reveal", "break"].includes(state.phase),
      "No running timer to reset."
    )
    const duration =
      state.phase === "bidding"
        ? state.settings.bidSeconds * 1000 + graceMs
        : (state.phase === "reveal"
            ? state.settings.revealSeconds
            : state.settings.breakSeconds) * 1000
    state.remainingMs = duration
    state.deadline = state.paused ? null : now + duration
  }
  switch (command.type) {
    case "start": {
      check(state.phase === "setup", "The event has already started.")
      check(
        players.length >= state.teams.length * 5,
        "Import enough players to fill every team's five slots."
      )
      check(
        state.teams.every((team) => !isOverBudget(state, team, players)),
        "Every team must afford its minimum roster reserve before starting."
      )
      state.round = 1
      state.order = pickOrder(state.teams, random)
      state.turnIndex = 0
      state.phase = "nomination"
      log("start", "Auction started", { order: state.order })
      break
    }
    case "nominate": {
      active()
      check(
        state.phase === "nomination",
        "Wait for the auctioneer to advance to a nomination."
      )
      check(
        state.order[state.turnIndex] === command.teamId,
        "It is not this captain's turn to nominate."
      )
      const team = teamById(state, command.teamId)
      const pool = poolPlayers(state, players)
      const player = command.random
        ? randomPlayer(pool, random)
        : pool.find((row) => row.id === command.playerId)
      check(player, "Select an unsold player from the pool.")
      const bid = minimumBid(player, state.settings.rankRules)
      check(
        emptySlots(team) > 0 &&
          bid <= maximumBid(state, team, players, player.id),
        `This player's $${bid} opening bid exceeds ${team.name}'s maximum bid. Adjust the wallet, resolve returns, or choose another player.`
      )
      state.nomination = {
        id: ++state.sequence,
        playerId: player.id,
        nominatorId: team.id,
        bid,
        bidderId: team.id,
        random: command.random,
        revealedAt: now,
        bids: [{ teamId: team.id, amount: bid, at: now }],
      }
      state.phase = "reveal"
      state.deadline = now + state.settings.revealSeconds * 1000
      log(
        command.random ? "random" : "nomination",
        `${team.name} nominated player ${player.id}`,
        state.nomination
      )
      break
    }
    case "startBidding":
      active()
      check(
        state.phase === "awaitingStart",
        "Wait until the player reveal finishes before starting bids."
      )
      validStandingBid(state, players)
      state.phase = "bidding"
      resetTimer()
      log("startBidding", "Bidding opened")
      break
    case "bid": {
      active()
      check(
        state.phase === "bidding" &&
          state.deadline !== null &&
          now < state.deadline,
        "Bidding is closed."
      )
      check(
        state.nomination?.id === command.nominationId,
        "This nomination has changed. Check the current player before bidding."
      )
      integer(command.amount, 1, 1_000_000_000, "Bid")
      check(
        command.amount > state.nomination.bid,
        "Your bid must be higher than the current bid."
      )
      const team = teamById(state, command.teamId)
      const player = standingPlayer(state, players)
      check(emptySlots(team) > 0, "Your team has no empty roster slots.")
      check(
        command.amount >= minimumBid(player, state.settings.rankRules),
        "Your bid is below the player's minimum bid."
      )
      check(
        command.amount <= maximumBid(state, team, players),
        `Your bid exceeds your maximum bid of $${maximumBid(state, team, players)}.`
      )
      state.nomination.bid = command.amount
      state.nomination.bidderId = team.id
      state.nomination.bids.push({
        teamId: team.id,
        amount: command.amount,
        at: now,
      })
      resetTimer()
      log("bid", `${team.name} bid $${command.amount}`, {
        playerId: player.id,
        teamId: team.id,
        amount: command.amount,
      })
      break
    }
    case "tick": {
      if (state.paused || state.deadline === null || now < state.deadline) break
      if (state.phase === "reveal") {
        state.phase = "awaitingStart"
        log("reveal", "Reveal complete; waiting for auctioneer")
      }
      if (state.phase === "bidding") {
        validStandingBid(state, players)
        const nomination = state.nomination!
        const team = teamById(state, nomination.bidderId)
        const player = standingPlayer(state, players)
        state.lastSale = {
          playerId: player.id,
          teamId: team.id,
          price: nomination.bid,
          round: state.round,
          order: state.order.slice(),
          turnIndex: state.turnIndex,
          nomination: JSON.parse(JSON.stringify(nomination)),
        }
        team.balance -= nomination.bid
        team.roster.push({
          playerId: player.id,
          position: assignPosition(
            team.roster,
            player.mainRole,
            player.secondaryRole
          ),
          price: nomination.bid,
          captain: false,
        })
        state.phase = "sold"
        log(
          "sale",
          `${team.name} bought player ${player.id} for $${nomination.bid}`,
          state.lastSale
        )
        log(
          "compliance",
          "Budget compliance checked",
          state.teams
            .filter((row) => isOverBudget(state, row, players))
            .map((row) => row.id)
        )
      }
      if (state.phase === "break")
        log("break", "Break timer finished; waiting for auctioneer")
      state.deadline = null
      state.remainingMs = 0
      break
    }
    case "advance": {
      active()
      check(
        state.phase === "sold" || state.phase === "break",
        "Finish the current sale before advancing."
      )
      if (state.teams.every((team) => emptySlots(team) === 0)) {
        state.phase = "complete"
        state.nomination = null
        state.deadline = null
        log("complete", "All rosters are complete")
        break
      }
      if (state.phase === "break") {
        check(
          state.teams.every((team) => !isOverBudget(state, team, players)),
          "Resolve every over-budget team before starting the next round."
        )
        check(
          state.deadline === null || now >= state.deadline,
          "The break timer is still running. Set it to zero to end the break early."
        )
        state.round++
        state.order = pickOrder(state.teams, random)
        state.turnIndex = 0
        state.phase = "nomination"
      } else {
        state.turnIndex++
        while (
          state.turnIndex < state.order.length &&
          emptySlots(teamById(state, state.order[state.turnIndex])) === 0
        )
          state.turnIndex++
        if (state.turnIndex >= state.order.length) {
          state.phase = "break"
          state.deadline = now + state.settings.breakSeconds * 1000
        } else state.phase = "nomination"
      }
      state.nomination = null
      log("advance", `Round ${state.round}: ${state.phase}`, {
        order: state.order,
        turnIndex: state.turnIndex,
      })
      break
    }
    case "pause":
      check(
        !state.paused && state.phase !== "complete" && state.phase !== "setup",
        "There is no active auction to pause."
      )
      state.remainingMs =
        state.deadline === null ? 0 : Math.max(0, state.deadline - now)
      state.deadline = null
      state.paused = true
      log("pause", "Auction paused")
      break
    case "resume":
      check(state.paused, "The auction is not paused.")
      state.paused = false
      state.deadline = ["bidding", "reveal", "break"].includes(state.phase)
        ? now + state.remainingMs
        : null
      log("resume", "Auction resumed")
      break
    case "resetTimer":
      resetTimer()
      log("timer", "Timer reset")
      break
    case "setTimer":
      check(
        ["bidding", "reveal", "break"].includes(state.phase),
        "No running timer to adjust."
      )
      integer(command.seconds, 0, 3600, "Timer seconds")
      state.remainingMs =
        command.seconds * 1000 + (state.phase === "bidding" ? graceMs : 0)
      state.deadline = state.paused ? null : now + state.remainingMs
      log("timer", `Timer adjusted to ${command.seconds} seconds`)
      break
    case "resetBid": {
      check(
        ["reveal", "awaitingStart", "bidding"].includes(state.phase),
        "There is no active bid to reset."
      )
      const player = standingPlayer(state, players)
      state.nomination!.bid = minimumBid(player, state.settings.rankRules)
      state.nomination!.bidderId = state.nomination!.nominatorId
      state.nomination!.bids = [
        {
          teamId: state.nomination!.bidderId,
          amount: state.nomination!.bid,
          at: now,
        },
      ]
      validStandingBid(state, players)
      if (state.phase === "bidding") resetTimer()
      log("resetBid", "Current bid reset to the opening bid", state.nomination)
      break
    }
    case "cancelNomination":
      check(
        ["reveal", "awaitingStart", "bidding"].includes(state.phase),
        "There is no active nomination to cancel."
      )
      log(
        "cancel",
        "Nomination cancelled; player returned to pool",
        state.nomination
      )
      state.nomination = null
      state.deadline = null
      state.remainingMs = 0
      state.phase = "nomination"
      break
    case "return": {
      idleForOverride(state)
      const team = teamById(state, command.teamId)
      const slot = team.roster.find((row) => row.playerId === command.playerId)
      check(
        slot && !slot.captain,
        "Only purchased players can be returned; captains cannot be returned."
      )
      const refund = Math.floor(slot.price / 2)
      team.balance += refund
      team.roster = team.roster.filter((row) => row !== slot)
      if (state.lastSale?.playerId === slot.playerId) state.lastSale = null
      if (state.nomination?.playerId === slot.playerId) state.nomination = null
      if (state.phase === "complete") {
        state.phase = "break"
        state.deadline = null
      }
      log(
        "return",
        `${team.name} returned player ${slot.playerId}; refunded $${refund}`,
        {
          playerId: slot.playerId,
          teamId: team.id,
          refund,
          originalPrice: slot.price,
        }
      )
      break
    }
    case "wallet": {
      idleForOverride(state)
      const team = teamById(state, command.teamId)
      integer(
        command.amount,
        -1_000_000_000,
        1_000_000_000,
        "Wallet adjustment"
      )
      integer(team.balance + command.amount, 0, 1_000_000_000, "New balance")
      check(
        command.reason.trim().length > 0 && command.reason.length <= 500,
        "Enter a reason for the wallet adjustment (500 characters maximum)."
      )
      team.balance += command.amount
      log(
        "wallet",
        `${team.name}: ${command.amount >= 0 ? "+" : ""}$${command.amount} — ${command.reason}`,
        { teamId: team.id, balance: team.balance }
      )
      break
    }
    case "role": {
      const team = teamById(state, command.teamId)
      check(
        positions.includes(command.position as Position),
        "Choose a valid roster position."
      )
      const slot = team.roster.find((row) => row.playerId === command.playerId)
      check(slot, "This player is not on that team.")
      const other = team.roster.find((row) => row.position === command.position)
      if (other) other.position = slot.position
      slot.position = command.position as Position
      log(
        "role",
        `${team.name} moved player ${slot.playerId} to ${command.position}`
      )
      break
    }
    case "transfer": {
      idleForOverride(state)
      const source = state.teams.find((team) =>
        team.roster.some((slot) => slot.playerId === command.playerId)
      )
      const slot = source?.roster.find(
        (row) => row.playerId === command.playerId
      )
      const destination = teamById(state, command.teamId)
      check(
        source && source.id !== destination.id && slot && !slot.captain,
        "Choose a purchased player and a different team."
      )
      check(
        emptySlots(destination) > 0 && destination.balance >= slot.price,
        "The receiving team needs an empty slot and enough funds for the original price."
      )
      source.roster = source.roster.filter((row) => row !== slot)
      source.balance += slot.price
      destination.balance -= slot.price
      const player = players.find((row) => row.id === slot.playerId)!
      destination.roster.push({
        ...slot,
        position: assignPosition(
          destination.roster,
          player.mainRole,
          player.secondaryRole
        ),
      })
      if (state.lastSale?.playerId === slot.playerId) state.lastSale = null
      log(
        "transfer",
        `Player ${slot.playerId} moved from ${source.name} to ${destination.name} at the original price`,
        { price: slot.price }
      )
      break
    }
    case "undoSale": {
      idleForOverride(state)
      const sale = state.lastSale
      check(sale, "No sale is available to undo.")
      const team = teamById(state, sale.teamId)
      check(
        team.roster.some(
          (slot) => slot.playerId === sale.playerId && !slot.captain
        ),
        "The last sold player is no longer on the winning team."
      )
      team.roster = team.roster.filter(
        (slot) => slot.playerId !== sale.playerId
      )
      team.balance += sale.price
      state.round = sale.round
      state.order = sale.order
      state.turnIndex = sale.turnIndex
      state.nomination = { ...sale.nomination, id: ++state.sequence }
      state.phase = "awaitingStart"
      state.deadline = null
      state.remainingMs = 0
      state.lastSale = null
      log(
        "undo",
        `Undid sale of player ${sale.playerId}; refunded $${sale.price} to ${team.name}`,
        sale
      )
      break
    }
    case "order":
      check(
        state.phase === "nomination",
        "Edit the pick order while awaiting a nomination."
      )
      check(
        command.order.length === state.order.length &&
          new Set(command.order).size === state.order.length &&
          command.order.every((id) => state.order.includes(id)),
        "Pick order must include each team in the current round exactly once."
      )
      check(
        command.order
          .slice(0, state.turnIndex)
          .every((id, index) => id === state.order[index]),
        "Completed turns cannot be reordered."
      )
      state.order = command.order.slice()
      log("order", "Auctioneer edited the pick order", state.order)
      break
    case "timers":
      validateTimers(command)
      state.settings.bidSeconds = command.bidSeconds
      state.settings.revealSeconds = command.revealSeconds
      state.settings.breakSeconds = command.breakSeconds
      log(
        "settings",
        "Timer settings updated; current countdown unchanged",
        command
      )
      break
    case "rankRules":
      idleForOverride(state)
      validateRankRules(command.rankRules)
      state.settings.rankRules = command.rankRules
      log(
        "rankRules",
        "Rank minimums and expected values updated",
        command.rankRules
      )
      break
    case "end":
      state.phase = "complete"
      state.nomination = null
      state.deadline = null
      state.remainingMs = 0
      state.paused = false
      log("end", "Auction ended by the auctioneer")
      break
  }
  return { state, events }
}
