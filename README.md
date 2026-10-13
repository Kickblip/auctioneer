
Follow these steps to set up this project and run locally

**BEFORE EVERYTHING ELSE:** Install prettier in VSCode (https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode
)

1. Clone and install

```bash
git clone https://github.com/Kickblip/auctioneer
cd auctioneer
npm install
```

If you do not have npm installed, install Node.js through NVM. npm will be installed with Node. https://nodejs.org/en/download

2. Make a copy of the `.env.example` file and rename it to `.env`

3. Check https://stache.utexas.edu/ and populate the environment variables with the values shared by Wyatt. If you see nothing in stache let Wyatt know

4. Install spacetime CLI https://spacetimedb.com/install

5. Generate spacetime types with `npm run spacetime:generate`

And now run the project:
Run the following commands in separate terminal windows:

```bash
spacetime start
npm run spacetime:publish:local
npm run dev
```

Then navigate to `http://localhost:3000` in your browser and you should see the project there

After pulling schema or reducer changes, republish the module with
`npm run spacetime:publish:local` and regenerate bindings with
`npm run spacetime:generate`. Refresh open browser tabs after publishing.
The admin notes and Clerk ownership columns have defaults for existing rows;
no database reset is needed. Owners can save up to 5,000 characters of notes per
player. Other viewers can read them.

Opening a lobby asks whether to join as Owner, Captain, or Spectator. Owners
must sign in with the Clerk account that created the lobby. For a lobby created
before Clerk ownership was added, first join as Owner from the original browser
to link the signed-in account once; subsequent visits can use that account on
any device. The original browser token alone cannot edit notes or captains.

Owners assign captains in Player Details. Captains select their assigned player,
sign in, and join to bind their account. The first account to claim a slot owns it;
removing captain powers clears that binding. Reassign the player to reopen the
slot. Spectators do not need to sign in. The sidebar displays the selected role.

The backend verifies Clerk tokens against the exact issuer in
`spacetimedb/src/auth.ts`. Change that issuer and republish when switching Clerk
instances (for example, to production). Public subscriptions use a guest
connection; each protected action uses a separate connection with a current
Clerk session token. No custom Clerk JWT template is required.

Run reducer permission, role-view, and parser tests with Node 22.18+:

```bash
node --experimental-test-module-mocks --test --test-concurrency=1 tests/*.test.mjs
```

Reducer tests run the actual handlers with in-memory tables and validated-claim
fixtures; they do not test Clerk's login UI or SpacetimeDB's JWT signature checks.

Pull Request exercise - Add your name to this list:

- Wyatt - Orange
- Ayush - Green
- Gaoyu - Blue
- Erik - Red
- Enoch - Red
