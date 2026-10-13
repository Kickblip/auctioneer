import { LobbyAccess } from "@/components/lobby-access"
import { Suspense } from "react"

export default async function LobbyLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lobbyId: string }>
}) {
  const { lobbyId } = await params
  return (
    <Suspense
      fallback={
        <p role="status" className="p-8">
          Loading lobby…
        </p>
      }
    >
      <LobbyAccess key={lobbyId} lobbyId={lobbyId}>
        {children}
      </LobbyAccess>
    </Suspense>
  )
}
