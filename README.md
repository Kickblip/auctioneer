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

Pull Request exercise - Add your name to this list:

- Wyatt - Orange
