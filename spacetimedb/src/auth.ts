import { SenderError, type AuthCtx } from "spacetimedb/server"

// This must match the Clerk instance used by the frontend, including in production.
export const clerkIssuer = "https://ample-goldfish-9114.clerk.accounts.dev"

export function requireClerkUser(ctx: {
  senderAuth: AuthCtx
  timestamp: { microsSinceUnixEpoch: bigint }
}) {
  const jwt = ctx.senderAuth.jwt
  if (
    !jwt ||
    jwt.issuer !== clerkIssuer ||
    !jwt.subject ||
    typeof jwt.fullPayload.exp !== "number" ||
    jwt.fullPayload.exp <=
      Number(ctx.timestamp.microsSinceUnixEpoch) / 1_000_000
  ) {
    throw new SenderError("Sign in with Clerk to continue.")
  }
  return jwt.subject
}
