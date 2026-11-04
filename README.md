# Outreach Console (frontend)

The Outreach Console design, built in React 19, Vite 8 and TypeScript, and connected to the backend's HTTP API (`LinkedIn-MCP-Engine-Backend/src/api`). It reads the Sheet through the backend and writes Status, Subject and DraftBody back. AutoBooker (Apps Script) still does the sending. The browser never holds a Google key.

## Folders

```
D:\
├── LinkedIn-MCP-Engine\                 backend (engine, MCP server, HTTP API)
└── LinkedIn-MCP-Engine-Frontend\        this app
    ├── index.html
    ├── vite.config.ts                   dev server :5173, forwards /api to the backend :8787
    └── src\
        ├── main.tsx                     starts React
        ├── App.tsx                      backend check, token screen, page layout
        ├── api\
        │   ├── client.ts                fetch + token + error messages
        │   ├── endpoints.ts             one function per backend route
        │   └── types.ts                 response shapes, each naming the backend file it mirrors
        ├── context\
        │   ├── DataContext.tsx          Sheet rows, counts, settings; approve/reject/edit
        │   └── ToastContext.tsx         the message at the bottom of the screen
        ├── hooks\                       useHashRoute, usePolling, useStoredState
        ├── components\
        │   ├── layout\Rail.tsx          left rail with counts and Sheet status
        │   ├── layout\Topbar.tsx        title, search, Refresh from Sheet, Run job search
        │   ├── Drawer.tsx               review panel for one row
        │   └── ui.tsx                   Pill, Stat, Switch, Banner, Loading, Modal
        ├── pages\
        │   ├── routes.ts                the six pages and their titles
        │   ├── QueuePage.tsx            #queue
        │   ├── JobsPage.tsx             #jobs
        │   ├── PipelinePage.tsx         #pipeline
        │   ├── campaigns\               #campaigns (list + form)
        │   ├── RunsPage.tsx             #runs
        │   └── AutomationPage.tsx       #automation
        ├── utils\                       format, jobs (role family, post or listing), draftChecks
        └── styles\app.css               the design's CSS
```

## Which page calls which route

| Page | Routes |
|---|---|
| Every page (rail, counts) | `GET /api/health`, `GET /api/pipeline`, `GET /api/pipeline/left-out`, `GET /api/pipeline/summary`, `GET /api/settings`, `GET /api/search/latest` |
| Review queue, Job posts, Pipeline (drawer) | `POST /api/pipeline/:email/approve`, `/reject`, `/reopen`, `PATCH /api/pipeline/:email/draft` |
| Runs | `POST /api/search`, `GET /api/search`, `GET /api/search/:id` (every 3 s while running), `POST /api/runs`, `GET /api/runs`, `GET /api/runs/:id` |
| Campaigns | `GET /api/campaigns`, `GET /api/campaigns/:name`, `POST /api/campaigns`, `PATCH /api/campaigns/:name`, `POST /api/campaigns/:name/active` |
| Automation | `GET /api/settings`, `PUT /api/settings` |

## Run

```powershell
# development, two terminals
cd D:\LinkedIn-MCP-Engine;            npm run api      # http://127.0.0.1:8787
cd D:\LinkedIn-MCP-Engine-Frontend;   npm install; npm run dev   # http://localhost:5173

# one app
cd D:\LinkedIn-MCP-Engine-Frontend;   npm run build
cd D:\LinkedIn-MCP-Engine;            npm run api      # serves the UI at http://127.0.0.1:8787
```

When the backend has `API_TOKEN` set, the app asks for it once and keeps it in this browser.
