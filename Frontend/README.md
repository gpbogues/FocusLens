# FocusLens Frontend

A React + TypeScript + Vite single-page application that provides the user interface for the FocusLens focus-tracking tool.

---

## Tech Stack

| Tool | Purpose |
|------|---------|
| React 19 | UI library |
| TypeScript | Type safety |
| Vite | Dev server and bundler |
| React Router v7 | Client-side routing |
| Chart.js | Line chart on Metrics page |
| Recharts | Donut chart on Sessions chunk modal |
| Framer Motion | Animations on Home page |
| AWS SDK (S3) | Custom avatar image uploads |
| concurrently | Runs Vite + dmb.py together in dev |

---

## Getting Started

From the `frontend/` directory:

```bash
npm install      # install dependencies
npm run dev      # start Vite + dmb.py together (http://localhost:5173)
npm run build    # production build → dist/
npm run preview  # preview the production build locally
```

`npm run dev` runs both the Vite dev server and `../Backend/dmb.py` (the local focus-detection Flask server) concurrently.

Two backend services must be reachable:
- **EC2 backend** — URL set via `VITE_API_URL` in `.env` (login, sessions, metrics, user data)
- **Local dmb.py** — URL set via `VITE_DMB_URL` in `.env`, defaults to `http://localhost:5000` (webcam focus detection)

---

## Folder Structure

```
frontend/
├── index.html                      # HTML entry point
├── vite.config.ts                  # Vite configuration
├── .env                            # VITE_API_URL, VITE_DMB_URL
└── src/
    ├── main.tsx                    # React root — mounts <App /> into #root
    ├── App.tsx                     # Router setup, ProtectedRoute/PublicRoute guards, AuthProvider + SettingsProvider wrapper
    ├── index.css                   # Global base styles
    ├── App.css                     # App-level styles
    ├── context/
    │   ├── AuthContext.tsx         # Auth state (user, login, logout, updateUser, session signals)
    │   └── SettingsContext.tsx     # User settings (theme, cameraEnabled, micEnabled, avatarId)
    ├── utils/
    │   └── greeting.ts             # Time-based greeting helper
    └── components/
        ├── Layout/                 # Persistent shell (TopBar + RightSidebar + page outlet)
        ├── TopBar/                 # Header bar with title, dropdown nav, and collapsible sidebar
        │   ├── TopBar.tsx
        │   ├── DropdownMenu.tsx
        │   └── Sidebar.tsx         # Slide-out left sidebar for nav links
        ├── RightSidebar/           # Webcam feed, Start/Pause/Stop Session controls, session naming
        ├── WebcamFeed/             # Webcam access via MediaDevices API
        ├── Preloader/              # Animated preloader shown on first login
        ├── Home/                   # Dashboard — recent sessions snapshot, greeting, AgentPrompt
        │   ├── Home.tsx
        │   ├── AgentPrompt.tsx     # AI agent prompt input on Home page
        │   ├── Sidebar.tsx         # Home-specific sidebar
        │   └── WebcamFeed.tsx      # Webcam used inside Home view
        ├── Metrics/                # Focus analytics — line chart, diamond wheel, monthly heatmap
        │   ├── Metrics.tsx
        │   └── MonthlyHeatmap.tsx
        ├── Sessions/               # Session history — list/grid, search, sort, folders, chunk details
        │   └── Sessions.tsx
        ├── Profile/                # User profile — avatar picker, account editing, theme/privacy settings
        │   ├── Profile.tsx
        │   └── AvatarEditor.tsx    # Crop/resize tool for custom avatar uploads
        ├── About/                  # About page
        ├── Studies/                # Studies/resources page
        └── Login/                  # Login, register, email verify, and forgot-password flows
            ├── Login.tsx
            └── cognitoAuth.ts      # AWS Cognito helpers (signUp, confirmSignUp, resendCode)
```

---

## Routing

All authenticated routes share the `Layout` shell (TopBar + RightSidebar). The page content swaps inside `<Outlet />`.

| Path | Component | Access |
|------|-----------|--------|
| `/login` | `Login` | Public only (redirects to `/` if logged in) |
| `/` | `Home` | Protected |
| `/sessions` | `Sessions` | Protected |
| `/metrics` | `Metrics` | Protected |
| `/profile` | `Profile` | Protected |
| `/about` | `About` | Protected |
| `/studies` | `Studies` | Protected |

`ProtectedRoute` redirects unauthenticated users to `/login`. `PublicRoute` redirects authenticated users to `/`. Both return a spinner while the `/init` cookie check is in-flight.

Navigation is handled by the `DropdownMenu` inside `TopBar` and the collapsible `Sidebar`.

---

## Key Components

### `App.tsx`
The root component. Wraps the app in `AuthProvider` → `SettingsProvider` → `BrowserRouter`. Defines `ProtectedRoute` and `PublicRoute` guards. Manages `isSessionActive` and `isPaused` state and passes them down to `Layout`.

### `Layout`
Persistent page shell. Renders `TopBar`, the current page inside `<main>`, and `RightSidebar`. Receives session state from `App` and passes it to `RightSidebar`.

### `TopBar`
Fixed header bar. Contains the "Menu ▼" button that toggles `DropdownMenu`, the app title (home link), and controls for the collapsible `Sidebar`.

### `RightSidebar`
Persistent right panel. Renders `WebcamFeed` and Start / Pause / Stop Session controls. On session start it POSTs to `dmb.py` to begin focus detection; on stop it saves the session to the EC2 backend (via `VITE_API_URL`). Supports session naming.

### `WebcamFeed`
Accesses the user's camera via `navigator.mediaDevices.getUserMedia`. Starts when `isActive` is `true`, fully stops (releases all tracks) when `isActive` becomes `false` or the component unmounts. Respects the `cameraEnabled` setting from `SettingsContext`.

### `Preloader`
Animated intro shown after the first successful login in a browser session (detected via `sessionStorage`).

### `Home`
Dashboard page. Fetches recent sessions, shows a time-based greeting, displays a sessions snapshot, and includes the `AgentPrompt` AI input.

### `Metrics`
Full analytics page with three visualizations:
- **Line chart** (Chart.js) — avg focus, total time, or session count over 7D / 1M / 1Y
- **Diamond Wheel** — custom canvas chart showing focus, eye contact, and deep focus by day of week
- **MonthlyHeatmap** — calendar heatmap of session activity

### `Sessions`
Session history with:
- Paginated list or grid layout with search and sort (date / duration)
- Expand/collapse for session details and AI feedback
- Session chunk modal — donut chart (Recharts) + timeline bar showing VF/SF/SU/VU focus states
- Folders tab — create, rename, and delete folders; add/remove sessions from folders

### `Profile`
- **Avatar picker** — 8 emoji presets or custom photo upload (cropped via `AvatarEditor`, stored in S3 via presigned URL)
- **Account section** — edit username, email (Cognito-verified), or password; delete account
- **Settings** — color theme picker (8 themes), camera toggle, microphone toggle; all persisted to the backend

### `Login`
Multi-stage form handling six flows: `login`, `register`, `verify`, `forgot-email`, `forgot-verify`, `forgot-password`. Registration and email verification use AWS Cognito (`cognitoAuth.ts`); credentials and user data are stored in the EC2 RDS backend. Includes password requirements checklist and show/hide toggle.

---

## Context

### `AuthContext` (`context/AuthContext.tsx`)

Provides app-wide auth state. On mount, calls `/init` (httpOnly cookie check) to restore session without an extra login round-trip.

```ts
interface AuthContextType {
  user: { username: string; email: string; userId: number; avatarUrl: string | null } | null;
  login: (payload: LoginPayload) => void;   // called after /login succeeds
  logout: () => void;                        // clears state + fires /logout to clear cookie
  updateUser: (updates: Partial<User>) => void;
  isLoading: boolean;                        // true while /init is in-flight
  sessionTrigger: number;                    // increments when a session is saved; used by Sessions page
  notifySessionSaved: () => void;
  highlightSession: boolean;                 // signals Sessions page to highlight the newest entry
  requestHighlightSession: () => void;
  clearHighlightSession: () => void;
  openSnapshot: boolean;                     // signals Home to open the snapshot panel
  requestOpenSnapshot: () => void;
  clearOpenSnapshot: () => void;
  initialSettings: InitialSettings | null;   // settings prefetched by /init, consumed by SettingsProvider
}
```

### `SettingsContext` (`context/SettingsContext.tsx`)

Manages user preferences loaded from the backend on login and persisted via `PUT /user/settings` on every change.

```ts
interface SettingsContextType {
  theme: Theme;            // 'dark' | 'light' | 'sunset' | 'rose' | 'stormy' | 'hydrangea' | 'pistachio' | 'softspring'
  setTheme: (t: Theme) => void;
  cameraEnabled: boolean;
  setCameraEnabled: (v: boolean) => void;
  micEnabled: boolean;
  setMicEnabled: (v: boolean) => void;
  avatarId: string;
  setAvatarId: (id: string) => void;
}
```

Theme is applied to the DOM via `data-theme` attribute on `<html>`.

---

## Session Flow

1. User clicks **"Start Session"** in `RightSidebar`.
2. `isSessionActive` flips to `true` in `App`.
3. `WebcamFeed` receives `isActive={true}` and requests camera access.
4. `RightSidebar` POSTs to `dmb.py` (`VITE_DMB_URL`) to begin focus-score streaming.
5. User can click **"Pause"** to temporarily halt detection without ending the session.
6. Clicking **"Stop Session"** ends the session, saves it to the EC2 backend, and calls `notifySessionSaved()` so the Sessions page refreshes.

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `VITE_API_URL` | Base URL for the EC2 backend API (login, sessions, metrics, user data) |
| `VITE_DMB_URL` | Base URL for the local `dmb.py` Flask server; defaults to `http://localhost:5000` |

---

## About frontend → backend calls

`fetch` is the browser API used to make HTTP requests to the backend. `POST`, `GET`, `PUT`, `DELETE`, and `PATCH` are the HTTP methods used to send or request data. Think of `fetch` as the tool and the method as what kind of action you're taking with it.

Requests to `VITE_API_URL` go to the EC2 instance. Requests to `VITE_DMB_URL` go to the local Python process running on the user's machine.
