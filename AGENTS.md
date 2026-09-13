# AGENTS.md — Etsy MCP Server

## Purpose

This repository implements a TypeScript Model Context Protocol (MCP) server for the Etsy API. It exposes Etsy shop, listing, image/file, inventory, and seller-taxonomy tools over stdio for MCP clients. Credentials are supplied through `ETSY_API_KEY`, `ETSY_SHARED_SECRET`, `ETSY_REFRESH_TOKEN`, or an untracked `etsy_mcp_settings.json` copied from `etsy_mcp_settings.example.json`.

## Canon Block

- **Mode:** `single-main`.
- **Default branch:** `master` is the current remote default and is the shared canon branch for this repo until it is renamed.
- **Merge-gate command:** `npm run lint && npm test && npm run build`
- **Standing deviations:** legacy default branch name is `master`; feature branches prefixed `fhah-tools-*` may exist only as parked fhah-tools integration work and must not be landed from this repo without explicit owner scope.

## Repository Rules

- Read this file before work; stricter user or repo-local instructions win.
- Work canon-style on the default branch: pull/rebase, reserve files with Agent Mail before edits, run the merge gate, commit directly to the shared branch, push, and release reservations.
- Do not commit Etsy credentials, OAuth refresh tokens, settings files containing secrets, `.env`, or MCP client private configuration.
- This server is stdio-driven and intended to be launched by MCP clients; do not treat it as a long-running HTTP daemon unless a future design explicitly adds that mode.

## Common Commands

```bash
npm install
npm run lint
npm test
npm run build
npm start
npm run inspector
```
