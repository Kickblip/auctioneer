import type { Player } from "../../src/module_bindings/types"
import { rankTier, type AuctionPlayer, type Tier } from "./rules"

export function auctionPlayer(player: Player): AuctionPlayer {
  return {
    id: player.id,
    peakRank: player.effectivePeakRank || player.peakRank.tag,
    mainRole: player.mainRole?.tag,
    secondaryRole: player.secondaryRole?.tag,
  }
}
export const money = (amount: number) =>
  Number.isFinite(amount)
    ? `$${amount.toLocaleString("en-US")}`
    : "Not enough players"
export const rankName = (rank: string) =>
  rank.replace(/I[iv]*$/, (division) => ` ${division.toUpperCase()}`)
export const positionName = (position: string) =>
  position === "Adc" ? "ADC" : position
export const rankColors: Record<Tier, string> = {
  Unranked: "text-muted-foreground",
  Iron: "text-stone-500",
  Bronze: "text-orange-700 dark:text-orange-400",
  Silver: "text-slate-600 dark:text-slate-300",
  Gold: "text-yellow-700 dark:text-yellow-300",
  Platinum: "text-cyan-700 dark:text-cyan-300",
  Emerald: "text-emerald-700 dark:text-emerald-400",
  Diamond: "text-blue-600 dark:text-blue-300",
  Master: "text-purple-600 dark:text-purple-300",
  Grandmaster: "text-red-600 dark:text-red-400",
  Challenger: "text-amber-600 dark:text-amber-300",
}
export const rankColor = (rank: string) => rankColors[rankTier(rank)]
export function opggLink(player: Player) {
  if (player.opggUrl) return player.opggUrl
  // shortcut: imported profiles without a region link use NA until the owner edits it.
  return `https://op.gg/lol/summoners/na/${encodeURIComponent(player.riotIdGameName)}-${encodeURIComponent(player.riotIdTagline)}`
}
