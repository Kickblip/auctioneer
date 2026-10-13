import {
  BottomRoleIcon,
  JungleRoleIcon,
  MiddleRoleIcon,
  SupportRoleIcon,
  TopRoleIcon,
} from "@/lib/icons"
import { Blobatar } from "@blobatar/react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"

export default function Page() {
  return (
    <div className="flex min-h-dvh w-full">
      <div className="shrink-0 border-r bg-sidebar p-4">
        <p>A</p>
      </div>

      <div className="flex w-xs shrink-0 flex-col justify-between border-r bg-sidebar">
        <div className="flex flex-col">
          <div className="flex flex-col gap-2 border-b p-4">
            <p className="text-sm font-medium">Player Pool</p>

            <div className="rounded-md bg-secondary px-4 py-1.5">
              <span className="text-sm text-muted-foreground">
                Type to search...
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 border-b p-2">
            <div className="bg-secondary">
              <Blobatar name="Player1" size={64} />
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="text-lg font-medium">Player1</p>
              <div className="flex items-center gap-2.5">
                <TopRoleIcon className="h-6.5 w-6.5 bg-secondary p-0.5" />
                <MiddleRoleIcon className="h-6.5 w-6.5 bg-secondary p-0.5" />

                <div className="flex items-center gap-1 bg-secondary px-2 py-0.5">
                  <Image
                    src="/icons/rank/small/CHALLENGER.webp"
                    alt=""
                    width={24}
                    height={24}
                  />
                  <span className="text-xs font-semibold">Challenger</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 border-b p-2">
            <div className="bg-secondary">
              <Blobatar name="Player2" size={64} />
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="text-lg font-medium">Player2</p>
              <div className="flex items-center gap-2.5">
                <JungleRoleIcon className="h-6.5 w-6.5 bg-secondary p-0.5" />
                <SupportRoleIcon className="h-6.5 w-6.5 bg-secondary p-0.5" />

                <div className="flex items-center gap-1 bg-secondary px-2 py-0.5">
                  <Image
                    src="/icons/rank/small/DIAMOND.webp"
                    alt=""
                    width={24}
                    height={24}
                  />
                  <span className="text-xs font-semibold">Diamond</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t p-4">
          <p className="text-sm font-medium">My Team</p>

          <div className="flex items-center gap-2">
            <TopRoleIcon className="h-6.5 w-6.5 bg-secondary p-0.5" />
            <span className="font-medium">Player1</span>
          </div>
          <div className="flex items-center gap-2">
            <JungleRoleIcon className="h-6.5 w-6.5 bg-secondary p-0.5" />
            <span className="font-medium text-muted-foreground italic">
              No Assignment
            </span>
          </div>
          <div className="flex items-center gap-2">
            <MiddleRoleIcon className="h-6.5 w-6.5 bg-secondary p-0.5" />
            <span className="font-medium">Player2</span>
          </div>
          <div className="flex items-center gap-2">
            <BottomRoleIcon className="h-6.5 w-6.5 bg-secondary p-0.5" />
            <span className="font-medium text-muted-foreground italic">
              No Assignment
            </span>
          </div>
          <div className="flex items-center gap-2">
            <SupportRoleIcon className="h-6.5 w-6.5 bg-secondary p-0.5" />
            <span className="font-medium text-muted-foreground italic">
              No Assignment
            </span>
          </div>
        </div>
      </div>

      <div className="min-w-0 flex-1 p-4">
        <p>C</p>
      </div>

      <div className="flex w-xs shrink-0 flex-col gap-4 border-l bg-sidebar p-4">
        <p className="text-sm font-medium">Player Details</p>

        <div className="flex items-center gap-3">
          <div className="aspect-square bg-secondary">
            <Blobatar name="Player1" size={64} />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xl font-medium">Player1</span>
            <span className="text-sm font-medium text-muted-foreground">
              #1234
            </span>
          </div>
        </div>

        <Button asChild size="lg" className="font-medium">
          <Link href="/op.gg">View on OP.GG</Link>
        </Button>

        <div className="flex items-center gap-4">
          <div className="aspect-square bg-secondary p-2">
            <Image
              src="/icons/rank/large/CHALLENGER.webp"
              alt=""
              width={50}
              height={50}
            />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium text-muted-foreground">
              Current Rank
            </span>
            <span className="text-lg font-medium">Challenger</span>
            <span className="text-sm font-medium">1200 LP</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="aspect-square bg-secondary p-2">
            <Image
              src="/icons/rank/large/CHALLENGER.webp"
              alt=""
              width={50}
              height={50}
            />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium text-muted-foreground">
              Peak Rank
            </span>
            <span className="text-lg font-medium">Challenger</span>
            <span className="text-sm font-medium">2356 LP</span>
          </div>
        </div>

        <div className="grid grid-cols-2">
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">Primary Role</p>
            <div className="flex items-center gap-2">
              <TopRoleIcon className="h-6.5 w-6.5 bg-secondary p-0.5" />
              <p className="text-lg font-medium">Top</p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">Secondary Role</p>
            <div className="flex items-center gap-2">
              <MiddleRoleIcon className="h-6.5 w-6.5 bg-secondary p-0.5" />
              <p className="text-lg font-medium">Middle</p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Admin Notes</span>
            <span className="text-xs font-medium text-muted-foreground italic">
              Read Only
            </span>
          </div>
          <Textarea value="Type your message here." disabled />
        </div>
      </div>
    </div>
  )
}
