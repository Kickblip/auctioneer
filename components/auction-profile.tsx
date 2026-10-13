"use client"
import { useEffect, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { Blobatar } from "@blobatar/react"
import { Rank, Role, type Player } from "@/src/module_bindings/types"
import { useAuthenticatedAction } from "@/components/spacetime-provider"
import { useAuctionMutation } from "@/components/auction-hooks"
import { PlayerAdminNotes } from "@/components/player-admin-notes"
import { PlayerCaptain } from "@/components/player-captain"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  rankName,
  positionName,
  rankColor,
  opggLink,
} from "@/lib/auction/presentation"
const inputClass = "w-full rounded border bg-background px-2 py-1 text-sm"

export function AuctionProfile({
  player,
  isOwner,
  captainsLocked,
}: {
  player: Player
  isOwner: boolean
  captainsLocked: boolean
}) {
  const { userId } = useAuth()
  return (
    <>
      <h2 className="text-sm font-semibold">Player Details</h2>
      <div className="flex items-center gap-3">
        <Blobatar name={player.riotIdGameName} size={64} />
        <div className="min-w-0">
          <h3 className="text-lg font-semibold break-words">
            {player.riotIdGameName}#{player.riotIdTagline}
          </h3>
          <p className="text-sm">{player.name}</p>
          <p className="text-xs text-muted-foreground">
            Discord: {player.discord}
          </p>
        </div>
      </div>
      <Button asChild variant="outline">
        <a href={opggLink(player)} target="_blank" rel="noopener noreferrer">
          View on OP.GG
        </a>
      </Button>
      <div className="grid grid-cols-2 gap-4">
        {[
          {
            label: "Current Rank",
            rank: player.currentRank.tag,
            lp: player.currentLp,
          },
          { label: "Peak Rank", rank: player.peakRank.tag, lp: player.peakLp },
        ].map((row) => (
          <div key={row.label}>
            <p className="text-xs text-muted-foreground">{row.label}</p>
            <p className={`font-semibold ${rankColor(row.rank)}`}>
              {rankName(row.rank)}
            </p>
            <p className="text-sm">{row.lp} LP</p>
          </div>
        ))}
        <div>
          <p className="text-xs text-muted-foreground">Primary role</p>
          <p>{positionName(player.mainRole?.tag ?? "Unspecified")}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Secondary role</p>
          <p>{positionName(player.secondaryRole?.tag ?? "Unspecified")}</p>
        </div>
      </div>
      {player.effectivePeakRank && (
        <p className={`text-sm ${rankColor(player.effectivePeakRank)}`}>
          Effective peak: {rankName(player.effectivePeakRank)}
        </p>
      )}
      <p className="text-sm">Tournament wins: {player.tournamentWins}</p>
      <PlayerCaptain
        playerId={player.id}
        isOwner={isOwner && !captainsLocked}
      />
      <PlayerAdminNotes
        key={`admin-${player.id}`}
        player={player}
        isOwner={isOwner}
      />
      {userId && (
        <ScoutingNotes key={`${userId}:${player.id}`} playerId={player.id} />
      )}
      {isOwner && <ProfileEditor key={`edit-${player.id}`} player={player} />}
    </>
  )
}
function ScoutingNotes({ playerId }: { playerId: number }) {
  const authenticate = useAuthenticatedAction()
  const { run, busy, error: saveError } = useAuctionMutation()
  const [text, setText] = useState("")
  const [saved, setSaved] = useState("")
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState("")
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let current = true
    void authenticate(async (connection) => {
      const note = await connection.procedures.myScoutingNote({ playerId })
      if (current) {
        setText(note)
        setSaved(note)
        setLoaded(true)
        setLoadError("")
      }
    }).catch((error) => {
      if (current)
        setLoadError(
          error instanceof Error ? error.message : "Could not load notes."
        )
    })
    return () => {
      current = false
    }
  }, [authenticate, playerId, retry])
  return (
    <form
      className="flex flex-col gap-2 border-t pt-4"
      onSubmit={async (event) => {
        event.preventDefault()
        if (
          await run((connection) =>
            connection.reducers.saveScoutingNote({ playerId, text })
          )
        )
          setSaved(text)
      }}
    >
      <label htmlFor="scouting-notes" className="text-sm font-medium">
        My notes{" "}
        <span className="font-normal text-muted-foreground">· private</span>
      </label>
      <Textarea
        id="scouting-notes"
        value={text}
        onChange={(event) => setText(event.target.value)}
        maxLength={280}
        disabled={!loaded || busy}
        placeholder={
          loaded ? "Only you can read these notes." : "Loading notes…"
        }
      />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{[...text].length}/280</span>
        <Button size="sm" disabled={!loaded || busy || text === saved}>
          Save notes
        </Button>
      </div>
      {(loadError || saveError) && (
        <p role="alert" className="text-sm text-destructive">
          {loadError || saveError}
        </p>
      )}
      {loadError && (
        <Button
          type="button"
          variant="outline"
          onClick={() => setRetry((value) => value + 1)}
        >
          Retry loading notes
        </Button>
      )}
    </form>
  )
}
function ProfileEditor({ player }: { player: Player }) {
  const { run, busy, error } = useAuctionMutation()
  const [saved, setSaved] = useState(false)
  return (
    <details className="border-t pt-4">
      <summary className="cursor-pointer text-sm font-semibold">
        Edit player profile
      </summary>
      <form
        className="mt-3 flex flex-col gap-3"
        onSubmit={async (event) => {
          event.preventDefault()
          const data = new FormData(event.currentTarget)
          const value = (key: string) => String(data.get(key) ?? "")
          const ok = await run((connection) =>
            connection.reducers.updatePlayerProfile({
              playerId: player.id,
              name: value("name"),
              discord: value("discord"),
              riotIdGameName: value("riotIdGameName"),
              riotIdTagline: value("riotIdTagline"),
              currentRank: Rank[value("currentRank") as Rank["tag"]],
              peakRank: Rank[value("peakRank") as Rank["tag"]],
              mainRole: value("mainRole")
                ? Role[value("mainRole") as Role["tag"]]
                : undefined,
              secondaryRole: value("secondaryRole")
                ? Role[value("secondaryRole") as Role["tag"]]
                : undefined,
              currentLp: Number(value("currentLp")),
              peakLp: Number(value("peakLp")),
              tournamentWins: Number(value("tournamentWins")),
              effectivePeakRank: value("effectivePeakRank"),
              opggUrl: value("opggUrl"),
            })
          )
          setSaved(ok)
        }}
      >
        {(["name", "discord", "riotIdGameName", "riotIdTagline"] as const).map(
          (field) => (
            <label key={field} className="text-xs">
              {
                {
                  name: "Full name",
                  discord: "Discord",
                  riotIdGameName: "Riot game name",
                  riotIdTagline: "Riot tag",
                }[field]
              }
              <input
                name={field}
                defaultValue={player[field]}
                maxLength={100}
                required
                className={inputClass}
              />
            </label>
          )
        )}
        {(["currentRank", "peakRank", "effectivePeakRank"] as const).map(
          (field) => (
            <label key={field} className="text-xs">
              {
                {
                  currentRank: "Current rank",
                  peakRank: "Peak rank",
                  effectivePeakRank: "Effective peak (smurf correction)",
                }[field]
              }
              <select
                name={field}
                defaultValue={
                  field === "effectivePeakRank"
                    ? player[field]
                    : player[field].tag
                }
                className={inputClass}
              >
                {field === "effectivePeakRank" && (
                  <option value="">Use recorded peak</option>
                )}
                {Object.keys(Rank.variants).map((rank) => (
                  <option key={rank} value={rank}>
                    {rankName(rank)}
                  </option>
                ))}
              </select>
            </label>
          )
        )}
        {(["mainRole", "secondaryRole"] as const).map((field) => (
          <label key={field} className="text-xs">
            {field === "mainRole" ? "Primary role" : "Secondary role"}
            <select
              name={field}
              defaultValue={player[field]?.tag ?? ""}
              className={inputClass}
            >
              <option value="">Unspecified</option>
              {Object.keys(Role.variants).map((position) => (
                <option key={position} value={position}>
                  {positionName(position)}
                </option>
              ))}
            </select>
          </label>
        ))}
        {(["currentLp", "peakLp", "tournamentWins"] as const).map((field) => (
          <label key={field} className="text-xs">
            {
              {
                currentLp: "Current LP",
                peakLp: "Peak LP",
                tournamentWins: "Tournament wins",
              }[field]
            }
            <input
              name={field}
              type="number"
              min={0}
              step={1}
              required
              defaultValue={player[field]}
              className={inputClass}
            />
          </label>
        ))}
        <label className="text-xs">
          OP.GG URL
          <input
            type="url"
            name="opggUrl"
            defaultValue={player.opggUrl}
            placeholder="https://op.gg/lol/summoners/na/…"
            className={inputClass}
          />
        </label>
        <Button disabled={busy}>Save player</Button>
        {saved && (
          <p role="status" className="text-xs">
            Player saved.
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </form>
    </details>
  )
}
