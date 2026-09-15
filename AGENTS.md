# Etsy MCP server

TypeScript MCP server exposing Etsy tools over stdio. `src/index.ts` connects
`StdioServerTransport` and routes tool definitions to `src/handlers/`.
`CLAUDE.md` points here; keep one repository instruction source.

## Scope and authority

The default branch is `master`. Work in a verified, task-owned local or
provider-hosted checkout on an isolated branch. Preserve unrelated changes and
coordinate overlapping paths in the existing issue, not a shared mutable
branch or a duplicate tracker. Parked `fhah-tools-*` integration branches need
explicit owner scope before landing.

Do not require Agent Mail, inherited `/data/projects/AGENTS.md`, ai-machine,
RCH or replacement infrastructure/monitoring. Preserve historical Beads records.
Independent review and current-revision CI remain separate from authoring;
this file does not authorise merging, publishing or deployment.

## Protocol and credential boundaries

Keep stdio protocol output separate from diagnostics; use stderr for logs.
An HTTP daemon or new hosting arrangement is not the existing runtime model.
Read `README.md` for client setup only when changing configuration or launch
behaviour. `npm start` launches `build/index.js`; build first. Use
`npm run inspector` for explicitly scoped protocol debugging, not as a gate
for unrelated edits.

`src/config.ts` prefers `ETSY_API_KEY`, `ETSY_SHARED_SECRET` and
`ETSY_REFRESH_TOKEN`, then fills missing values from the optional untracked
`etsy_mcp_settings.json`. Keep credentials, refresh tokens, secret settings,
`.env` and private MCP client configuration out of Git, logs and evidence.
Tests must use synthetic credentials in a task-owned test checkout: the current
config loader deletes the optional settings file when `NODE_ENV=test`.
Never run that test path with an owner's real settings file present.

Live verification requires explicit authority for the shop and operation;
do not mutate listings, inventory or other real shop data merely to prove
that a code change works. Mocked responses are not live Etsy proof.

## Checks and completion

Match `.github/workflows/ci.yml`: Node 22, `npm ci`, lint, build and Vitest.
The existing local gate is `npm run lint && npm test && npm run build`.
Use relevant existing tests while editing; preserve the full current-revision
CI gate and configured hooks. Report checks not run rather than bypassing or
weakening them. A successful build does not prove an MCP client connection or
a live Etsy journey; report those boundaries separately with the revision.
