# FocusLens Frontend

A React + TypeScript + Vite single-page application that provides the user interface for the FocusLens focus-tracking tool.

---

## Tech Stack

| Tool | Purpose |
|------|---------|
| React 18 | UI library |
| TypeScript | Type safety |
| Vite | Dev server and bundler |
| React Router v6 | Client-side routing |

---

## Getting Started

From the `Frontend/` directory:

```bash
npm install      # install dependencies
npm run dev      # start dev server (http://localhost:5173)
npm run build    # production build → dist/
npm run preview  # preview the production build locally
```

The backend must be running on `http://localhost:5000` for login/register to work.

---

## Folder Structure

```
Frontend/
├── index.html                  # HTML entry point
├── vite.config.ts              # Vite configuration
├── src/
│   ├── main.tsx                # React root — mounts <App /> into #root
│   ├── App.tsx                 # Router setup, session state, AuthProvider wrapper
│   ├── index.css               # Global base styles
│   ├── App.css                 # App-level styles
│   ├── context/
│   │   └── AuthContext.tsx     # Auth state (user, login, logout) shared app-wide
│   └── components/
│       ├── Layout/             # Persistent shell (TopBar + RightSidebar + page outlet)
│       ├── TopBar/             # Header bar with title and dropdown nav menu
│       │   ├── TopBar.tsx
│       │   └── DropdownMenu.tsx
│       ├── RightSidebar/       # Webcam feed + Start/Stop Session button
│       ├── WebcamFeed/         # Webcam access via MediaDevices API
│       ├── Home/               # Default page — session snapshots placeholder
│       ├── Metrics/            # Metrics/analytics page (placeholder)
│       ├── Profile/            # User profile page (reads from AuthContext)
│       └── Login/              # Login and register form
```

---

## Routing

All routes share the `Layout` shell (TopBar + RightSidebar). The page content swaps inside the `<Outlet />`.

| Path | Component | Description |
|------|-----------|-------------|
| `/` | `Home` | Session snapshots view |
| `/profile` | `Profile` | Logged-in user info |
| `/metrics` | `Metrics` | Focus analytics |
| `/login` | `Login` | Login / Register form |

Navigation is handled by the `DropdownMenu` inside `TopBar`. Clicking the "FocusLens" title navigates back to `/`.

---

## Key Components

### `App.tsx`
The root component. Manages `isSessionActive` state and passes it down to `Layout`. Wraps the entire app in `AuthProvider` and `BrowserRouter`.

### `Layout`
The persistent page shell. Renders `TopBar` at the top, the current page inside `<main>`, and `RightSidebar` on the right. Receives session state from `App` and passes it to `RightSidebar`.

### `TopBar`
Fixed header bar. Contains the "Menu ▼" button that toggles `DropdownMenu`, and the app title which acts as a home link.

### `DropdownMenu`
Dropdown navigation with links to Profile, Metrics, and Login. Closes automatically on outside click via a `mousedown` listener.

### `RightSidebar`
Persistent right panel. Renders the `WebcamFeed` and a "Start Session" / "Stop Session" toggle button. Session state is owned by `App` and passed down as props.

### `WebcamFeed`
Accesses the user's camera via `navigator.mediaDevices.getUserMedia`. The stream starts when `isActive` is `true` and is fully stopped (all tracks released) when `isActive` becomes `false` or the component unmounts. Shows an error message if camera permission is denied.

### `Login`
Handles both login and registration in a single form, toggling between modes with a link. On submit it POSTs to the backend (`/login` or `/register`). On successful login it calls `login()` from `AuthContext` to store the user and redirects to `/`.

### `Profile`
Reads the current user from `AuthContext` and displays their username and email. Shows placeholder text when no user is logged in.

### `Metrics`
Placeholder page for future focus analytics and productivity tracking data.

### `Home`
Placeholder page for session snapshots that will populate after focus sessions are completed.

---

## Auth Context (`context/AuthContext.tsx`)

Provides a lightweight authentication state layer across the app using React Context.

**Shape:**
```ts
interface AuthContextType {
  user: { username: string; email: string } | null;
  login: (user: User) => void;
  logout: () => void;
}
```

- `AuthProvider` wraps the entire app in `App.tsx`.
- Any component can call `useAuth()` to read or update auth state.
- Auth state is in-memory only — it resets on page refresh. Persistent sessions (e.g. via localStorage or a token) are not yet implemented.

---

## Session Flow

1. User clicks **"Start Session"** in `RightSidebar`.
2. `isSessionActive` flips to `true` in `App`.
3. `WebcamFeed` receives `isActive={true}` and requests camera access.
4. The live video feed appears in the sidebar.
5. Clicking **"Stop Session"** flips `isSessionActive` to `false`, stopping and releasing the camera stream.


## About frontend -> backend calls

Note: this is frontend side, backend looks different
  'fetch' is the function thats makes http request to backend,
  and 'POST' is the method of sending data over to the backend

  Think of 'fetch' as being a tool that makes request,
  and 'POST' is part of 'fetch' used to send that request.

