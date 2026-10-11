import { Show, SignInButton } from "@clerk/nextjs"
import { SpreadsheetUploadForm } from "@/components/spreadsheet-upload-form"
import { Button } from "@/components/ui/button"

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col items-center">
      <nav className="flex w-full items-center justify-between border-b bg-sidebar px-4 py-2">
        <h1>Auctioneer</h1>

        <div className="flex items-center gap-2"></div>
      </nav>

      <div className="flex w-full max-w-5xl flex-col items-center gap-12 p-8">
        <div className="w-full rounded-md border bg-sidebar">
          <h2 className="px-4 py-2">Join an existing event</h2>

          <div className="rounded-b-md bg-background p-4">sdfsdfsdf</div>
        </div>

        <div className="w-full rounded-md border bg-sidebar">
          <h2 className="px-4 py-2">Upload a spreadsheet to create your own</h2>

          <div className="grid h-64 place-items-center rounded-b-md bg-background p-4">
            <Show
              when="signed-in"
              fallback={
                <SignInButton mode="modal">
                  <Button type="button">Sign in</Button>
                </SignInButton>
              }
            >
              <SpreadsheetUploadForm />
            </Show>
          </div>
        </div>
      </div>
    </div>
  )
}
