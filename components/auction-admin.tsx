"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useAuctionMutation } from "@/components/auction-hooks"
import {
  defaultSettings,
  positions,
  type Auction,
  type RankRule,
  type Settings,
} from "@/lib/auction/rules"
import { money, positionName, rankColors } from "@/lib/auction/presentation"
import type { Captain, Player } from "@/src/module_bindings/types"
const inputClass = "w-full rounded border bg-background px-2 py-1 text-sm"

export function AuctionSetup({
  lobbyId,
  state,
  captains,
  players,
}: {
  lobbyId: string
  state: Auction | null
  captains: readonly Captain[]
  players: readonly Player[]
}) {
  const [settings, setSettings] = useState<Settings>(
    state?.settings ?? defaultSettings
  )
  const { run, busy, error } = useAuctionMutation()
  const [saved, setSaved] = useState(false)
  return (
    <form
      className="flex flex-col gap-4 border bg-sidebar p-4"
      onSubmit={async (event) => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        const teams = Array.from(
          { length: settings.teamCount },
          (_, index) => ({
            captainPlayerId: Number(data.get(`captain-${index}`)),
            name: String(data.get(`name-${index}`)),
            budget: Number(data.get(`budget-${index}`)),
            position: String(data.get(`position-${index}`)),
          })
        )
        setSaved(
          await run((connection) =>
            connection.reducers.configureAuction({
              lobbyId,
              ...settings,
              teams,
            })
          )
        )
      }}
    >
      <h2 className="font-semibold">Event setup</h2>
      <p className="text-sm text-muted-foreground">
        Select players in the pool and use Make captain first. Set each team’s
        starting balance here; captains occupy one roster slot. Captain
        assignments lock when settings are saved.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          Event name
          <input
            required
            maxLength={100}
            value={settings.name}
            onChange={(event) =>
              setSettings({ ...settings, name: event.target.value })
            }
            className={inputClass}
          />
        </label>
        <label className="text-sm">
          Teams
          <input
            type="number"
            min={2}
            max={16}
            value={settings.teamCount}
            onChange={(event) =>
              setSettings({
                ...settings,
                teamCount: Math.max(
                  2,
                  Math.min(16, Number(event.target.value))
                ),
              })
            }
            className={inputClass}
          />
        </label>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {(["bidSeconds", "revealSeconds", "breakSeconds"] as const).map(
          (field) => (
            <label key={field} className="text-xs">
              {
                {
                  bidSeconds: "Bid timer (seconds)",
                  revealSeconds: "Reveal (seconds)",
                  breakSeconds: "Round break (seconds)",
                }[field]
              }
              <input
                type="number"
                min={field === "bidSeconds" ? 1 : 0}
                max={
                  field === "bidSeconds"
                    ? 600
                    : field === "revealSeconds"
                      ? 60
                      : 3600
                }
                required
                value={settings[field]}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    [field]: Number(event.target.value),
                  })
                }
                className={inputClass}
              />
            </label>
          )
        )}
      </div>
      {Array.from({ length: settings.teamCount }, (_, index) => {
        const team = state?.teams[index]
        return (
          <fieldset key={index} className="grid grid-cols-2 gap-2 border p-3">
            <legend className="px-1 text-sm">Team {index + 1}</legend>
            <label className="text-xs">
              Team name
              <input
                required
                maxLength={60}
                name={`name-${index}`}
                defaultValue={team?.name ?? `Team ${index + 1}`}
                className={inputClass}
              />
            </label>
            <label className="text-xs">
              Captain
              <select
                required
                name={`captain-${index}`}
                defaultValue={
                  team?.captainPlayerId ?? captains[index]?.playerId ?? ""
                }
                className={inputClass}
              >
                <option value="">Choose captain</option>
                {captains.map((captain) => (
                  <option key={captain.playerId} value={captain.playerId}>
                    {players.find((player) => player.id === captain.playerId)
                      ?.riotIdGameName ?? captain.playerId}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              Starting currency
              <input
                name={`budget-${index}`}
                type="number"
                min={0}
                max={1000000000}
                step={1}
                required
                defaultValue={team?.initialBalance ?? ""}
                placeholder="Enter starting balance"
                className={inputClass}
              />
            </label>
            <label className="text-xs">
              Captain position
              <select
                name={`position-${index}`}
                defaultValue={
                  team?.roster.find((slot) => slot.captain)?.position ?? "Top"
                }
                className={inputClass}
              >
                {positions.map((position) => (
                  <option key={position} value={position}>
                    {positionName(position)}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>
        )
      })}
      <details>
        <summary className="cursor-pointer text-sm font-semibold">
          Rank minimums and expected values
        </summary>
        <RankFields
          rules={settings.rankRules}
          onChange={(rankRules) => setSettings({ ...settings, rankRules })}
        />
      </details>
      <Button disabled={busy}>
        {busy ? "Saving…" : "Save event settings"}
      </Button>
      {saved && (
        <p role="status" className="text-sm">
          Settings saved. Use Start auction below when ready.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  )
}

export function AuctionAdmin({
  lobbyId,
  state,
  selectedPlayerId,
  players,
}: {
  lobbyId: string
  state: Auction
  selectedPlayerId?: number
  players: readonly Player[]
}) {
  const { run, busy, error } = useAuctionMutation()
  const [rankRules, setRankRules] = useState(state.settings.rankRules)
  const control = (action: string) =>
    void run((connection) =>
      connection.reducers.controlAuction({ lobbyId, action })
    )
  const active = ["reveal", "awaitingStart", "bidding"].includes(state.phase)
  return (
    <details className="border bg-sidebar p-4" open={state.phase === "setup"}>
      <summary className="cursor-pointer font-semibold">
        Auctioneer controls
      </summary>
      <div className="mt-4 flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {state.phase === "setup" && (
            <Button disabled={busy} onClick={() => control("start")}>
              Start auction
            </Button>
          )}
          <Button
            disabled={busy || state.phase !== "awaitingStart" || state.paused}
            onClick={() => control("startBidding")}
          >
            Start bid timer
          </Button>
          <Button
            disabled={
              busy || !["sold", "break"].includes(state.phase) || state.paused
            }
            onClick={() => control("advance")}
          >
            Advance{state.phase === "break" ? " to next round" : ""}
          </Button>
          <Button
            variant="outline"
            disabled={busy || ["setup", "complete"].includes(state.phase)}
            onClick={() => control(state.paused ? "resume" : "pause")}
          >
            {state.paused ? "Resume" : "Pause"}
          </Button>
          <Button
            variant="outline"
            disabled={
              busy || !["bidding", "reveal", "break"].includes(state.phase)
            }
            onClick={() => control("resetTimer")}
          >
            Reset timer
          </Button>
          <Button
            variant="outline"
            disabled={busy || !active}
            onClick={() => control("resetBid")}
          >
            Reset bid
          </Button>
          <Button
            variant="outline"
            disabled={busy || !active}
            onClick={() => control("cancelNomination")}
          >
            Cancel nomination
          </Button>
          <Button
            variant="outline"
            disabled={busy || active || !state.lastSale}
            onClick={() => control("undoSale")}
          >
            Undo last sale
          </Button>
          <Button
            variant="destructive"
            disabled={busy || state.phase === "complete"}
            onClick={() => {
              if (
                window.confirm(
                  "End this auction? Current bidding will stop and unsold players will stay in the pool."
                )
              )
                control("end")
            }}
          >
            End auction
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            const data = new FormData(event.currentTarget)
            void run((connection) =>
              connection.reducers.setAuctionTimer({
                lobbyId,
                seconds: Number(data.get("seconds")),
              })
            )
          }}
        >
          <label className="text-xs">
            Current timer (seconds)
            <input
              name="seconds"
              type="number"
              min={0}
              max={3600}
              required
              defaultValue={10}
              className={inputClass}
            />
          </label>
          <Button
            variant="outline"
            disabled={
              busy || !["bidding", "reveal", "break"].includes(state.phase)
            }
          >
            Set timer
          </Button>
        </form>
        <form
          className="grid grid-cols-2 gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            const data = new FormData(event.currentTarget)
            void run((connection) =>
              connection.reducers.adjustWallet({
                lobbyId,
                teamId: Number(data.get("team")),
                amount: Number(data.get("amount")),
                reason: String(data.get("reason")),
              })
            )
          }}
        >
          <label className="text-xs">
            Wallet team
            <select name="team" className={inputClass}>
              {state.teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name} · {money(team.balance)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            Add/subtract currency
            <input
              name="amount"
              type="number"
              step={1}
              required
              placeholder="e.g. -100 or 500"
              className={inputClass}
            />
          </label>
          <label className="col-span-2 text-xs">
            Reason
            <input
              name="reason"
              required
              maxLength={500}
              className={inputClass}
            />
          </label>
          <Button
            variant="outline"
            disabled={busy || active}
            className="col-span-2"
          >
            Adjust wallet
          </Button>
        </form>
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            const data = new FormData(event.currentTarget)
            void run((connection) =>
              connection.reducers.editPickOrder({
                lobbyId,
                order: String(data.get("order"))
                  .split(",")
                  .map((value) => Number(value.trim())),
              })
            )
          }}
        >
          <label className="text-xs">
            Pick order (team numbers separated by commas)
            <input
              key={`${state.round}:${state.order.join(",")}`}
              name="order"
              defaultValue={state.order.join(",")}
              required
              className={inputClass}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            {state.teams.map((team) => `${team.id}: ${team.name}`).join(" · ")}
          </p>
          <Button
            variant="outline"
            disabled={busy || state.phase !== "nomination"}
          >
            Save pick order
          </Button>
        </form>
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            const data = new FormData(event.currentTarget)
            if (selectedPlayerId)
              void run((connection) =>
                connection.reducers.transferPlayer({
                  lobbyId,
                  playerId: selectedPlayerId,
                  teamId: Number(data.get("destination")),
                })
              )
          }}
        >
          <p className="text-xs">
            Reassign selected purchased player:{" "}
            <strong>
              {players.find((player) => player.id === selectedPlayerId)
                ?.riotIdGameName ?? "Select a player"}
            </strong>
            . The original price is refunded to the old team and charged to the
            new team.
          </p>
          <select
            name="destination"
            aria-label="Destination team"
            className={inputClass}
          >
            {state.teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            disabled={busy || active || !selectedPlayerId}
          >
            Reassign player
          </Button>
        </form>
        <details>
          <summary className="cursor-pointer text-sm">Timer settings</summary>
          <form
            className="mt-2 grid grid-cols-3 gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              const data = new FormData(event.currentTarget)
              void run((connection) =>
                connection.reducers.updateAuctionTimers({
                  lobbyId,
                  bidSeconds: Number(data.get("bidSeconds")),
                  revealSeconds: Number(data.get("revealSeconds")),
                  breakSeconds: Number(data.get("breakSeconds")),
                })
              )
            }}
          >
            {(["bidSeconds", "revealSeconds", "breakSeconds"] as const).map(
              (field) => (
                <label key={field} className="text-xs">
                  {
                    {
                      bidSeconds: "Bid seconds",
                      revealSeconds: "Reveal seconds",
                      breakSeconds: "Break seconds",
                    }[field]
                  }
                  <input
                    name={field}
                    type="number"
                    min={field === "bidSeconds" ? 1 : 0}
                    max={
                      field === "bidSeconds"
                        ? 600
                        : field === "revealSeconds"
                          ? 60
                          : 3600
                    }
                    defaultValue={state.settings[field]}
                    required
                    className={inputClass}
                  />
                </label>
              )
            )}
            <Button variant="outline" disabled={busy} className="col-span-3">
              Save future timer lengths
            </Button>
          </form>
        </details>
        <details>
          <summary className="cursor-pointer text-sm">Rank settings</summary>
          <RankFields rules={rankRules} onChange={setRankRules} />
          <Button
            variant="outline"
            disabled={busy || active}
            onClick={() =>
              void run((connection) =>
                connection.reducers.updateRankRules({ lobbyId, rankRules })
              )
            }
          >
            Save rank values
          </Button>
        </details>
      </div>
    </details>
  )
}
function RankFields({
  rules,
  onChange,
}: {
  rules: RankRule[]
  onChange: (rules: RankRule[]) => void
}) {
  return (
    <div className="my-3 grid grid-cols-4 gap-2 text-xs">
      <span>Tier</span>
      <span>Minimum bid</span>
      <span>Expected low</span>
      <span>Expected high</span>
      {rules.map((rule, index) => (
        <div key={rule.tier} className="contents">
          <span className={`self-center ${rankColors[rule.tier]}`}>
            {rule.tier}
          </span>
          {(["minimum", "low", "high"] as const).map((field) => (
            <input
              key={field}
              type="number"
              min={1}
              max={1000000}
              step={1}
              required
              aria-label={`${rule.tier} ${field}`}
              value={rule[field]}
              onChange={(event) =>
                onChange(
                  rules.map((row, i) =>
                    i === index
                      ? { ...row, [field]: Number(event.target.value) }
                      : row
                  )
                )
              }
              className={inputClass}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
