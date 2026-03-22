# giganttic
PM system that integrates information from multiple sources (Discord, Slack, Gmail, Google Docs, Firefly.io, etc) to maintain gantt charts and keep PM up to date.

## Prerequisites

- **Node.js 24+** (see `engines` in `package.json`). Use [nvm](https://github.com/nvm-sh/nvm): `nvm install` / `nvm use` (this repo includes `.nvmrc`).

Initialize submodules before running the frontend so DHTMLX Gantt assets are present:

```bash
git submodule update --init --recursive
```
