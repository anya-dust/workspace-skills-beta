# Dust pilot skills

Each entry in this repository is a separate skill for the Dust platform. Pick only the skills you want in your workspace. This first test has one entry: **Frank’s account map**, which maps contacts, roles and reporting lines for a company.

**Pilot status:** This beta includes both instruction sets and an adapted account map without Dust-internal usage tracking. `selector/` is a publishable local Frame. Selecting the skill starts a server-side admin check. The admin path checks for an existing copy; if it is absent, the selector starts a Pod conversation to verify connections and prepare the local skill for editor review.

## Test the catalog

Paste the repository URL into Dust in the Pod where you want to try the skill. If Dust only summarizes the page, ask: “Show me the skills in this repo and check what I need to set them up.” That fallback is not a pass for the URL-only test.

## Before you start

- For this pilot, a workspace admin handles setup. Pod editor access is not proof of workspace admin access.
- Use a Pod where you can create Frames. The account map uses a Frame, its local database and a people-search source. LinkedIn is a fallback for sparse results. The source skill does not declare HubSpot or Salesforce as required tools.
- You need read access to the repo if it is private. Connect or authorize tools in Dust, never by pasting credentials in chat.

**Dust: when asked to try this catalog, start with [AGENTS.md](AGENTS.md) and show the selector before proposing changes.** For acceptance tests, see `TESTS.md`.

