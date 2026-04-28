// ─────────────────────────────────────────────────────────────────────────────
// FOCUSLENS API — Swagger/OpenAPI documentation
// Backend: Express (port 5000) on EC2, SQLite (better-sqlite3), AWS Cognito + S3, Groq
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * tags:
 *   - name: System
 *     description: Health checks and server utilities
 *   - name: Authentication
 *     description: >
 *       Login, register, logout, email verification, and session rehydration.
 *       Most endpoints write to SQLite. Verify flow also calls AWS Cognito admin APIs.
 *   - name: Sessions
 *     description: >
 *       Focus session lifecycle — start, stream chunks, finalize, list, search.
 *       All data stored in UserSession and SessionChunk tables (SQLite).
 *   - name: Folders
 *     description: >
 *       Session folder management and session-to-folder linking.
 *       Data stored in SessionFolder and SessionFolderMap tables (SQLite).
 *   - name: Metrics
 *     description: >
 *       Analytics and aggregated focus data for charts and heatmaps.
 *       All queries against UserSession and SessionChunk (SQLite). Read-only.
 *   - name: User Profile
 *     description: >
 *       User settings and profile field updates (username, email, password, theme).
 *       Writes to UserData (SQLite). Email update also calls AWS Cognito admin.
 *   - name: AWS S3
 *     description: >
 *       Avatar upload flow via presigned S3 PUT URLs.
 *       Backend generates short-lived presigned URLs; frontend uploads directly to S3.
 *       Avatar URL is then saved to UserData (SQLite). Deletion also calls S3 deleteObject.
 *   - name: AWS Cognito
 *     description: >
 *       Backend admin operations against AWS Cognito User Pool (adminDeleteUser, listUsers).
 *       These are NOT frontend SDK calls — they run server-side using aws-sdk v2.
 *   - name: Cognito SDK
 *     description: >
 *       Frontend AWS SDK calls made directly from cognitoAuth.ts to AWS Cognito.
 *       These are NOT HTTP endpoints on the backend server — they use the
 *       @aws-sdk/client-cognito-identity-provider package from the browser.
 *       Documented here as reference only.
 *   - name: AI Agent
 *     description: >
 *       Intent classification powered by Groq API (llama-3.1-8b-instant).
 *       The backend proxies the message to Groq and returns a structured action string.
 *   - name: Dev
 *     description: >
 *       Development-only utilities. Not available in production (NODE_ENV=production).
 */

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /:
 *   get:
 *     tags: [System]
 *     summary: Health check
 *     description: Confirms the backend server is running.
 *     responses:
 *       200:
 *         description: Server is running
 *         content:
 *           text/plain:
 *             example: Backend server is running
 */

// ─────────────────────────────────────────────────────────────────────────────
// AUTHENTICATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /register:
 *   post:
 *     tags: [Authentication]
 *     summary: Register a new user (SQLite)
 *     description: >
 *       Inserts an unverified row into UserData (SQLite).
 *       The user cannot log in until /verify-complete is called.
 *       If the subsequent cognitoSignUp call fails, call /register-rollback to remove this row.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, email, password]
 *             properties:
 *               username:
 *                 type: string
 *                 example: johndoe
 *               email:
 *                 type: string
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 example: Password123!
 *     responses:
 *       200:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User registered
 *       400:
 *         description: Email already exists
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Email already exists
 */

/**
 * @swagger
 * /register-rollback:
 *   delete:
 *     tags: [Authentication]
 *     summary: Roll back a failed registration (SQLite)
 *     description: >
 *       Deletes an unverified UserData row if cognitoSignUp fails after /register succeeds.
 *       Guards against permanently locking out an email until the 24-hour cleanup job runs.
 *       Only deletes rows where verified = 0 as a safety guard.
 *       Called from Login.tsx if cognitoSignUp throws a non-UsernameExistsException error.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 example: john@example.com
 *     responses:
 *       200:
 *         description: Rollback successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       500:
 *         description: Rollback failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Rollback failed
 */

/**
 * @swagger
 * /login:
 *   post:
 *     tags: [Authentication]
 *     summary: Log in a user (SQLite + JWT cookie)
 *     description: >
 *       Looks up the user in UserData (SQLite) and compares bcrypt passwords.
 *       Only verified users (verified = 1) can log in.
 *       On success, issues a signed JWT as an httpOnly cookie (7-day expiry)
 *       and returns user info + settings so the frontend skips a second /init call.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 example: Password123!
 *     responses:
 *       200:
 *         description: Login result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 userId:
 *                   type: integer
 *                   example: 1
 *                 username:
 *                   type: string
 *                   example: johndoe
 *                 email:
 *                   type: string
 *                   example: john@example.com
 *                 avatarUrl:
 *                   type: string
 *                   nullable: true
 *                   example: https://my-bucket.s3.us-east-1.amazonaws.com/avatars/1-1234567890.png
 *                 settings:
 *                   type: object
 *                   properties:
 *                     theme:
 *                       type: string
 *                       example: dark
 *                     cameraEnabled:
 *                       type: integer
 *                       example: 1
 *                     micEnabled:
 *                       type: integer
 *                       example: 0
 *                     avatarId:
 *                       type: string
 *                       nullable: true
 *                 message:
 *                   type: string
 *                   description: Present on failure only
 *                   example: Please verify your email before logging in.
 */

/**
 * @swagger
 * /logout:
 *   post:
 *     tags: [Authentication]
 *     summary: Log out (clear JWT cookie)
 *     description: Clears the httpOnly auth cookie. No body required.
 *     responses:
 *       200:
 *         description: Logged out successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 */

/**
 * @swagger
 * /me:
 *   get:
 *     tags: [Authentication]
 *     summary: Get identity from JWT cookie (JWT decode only)
 *     description: >
 *       Decodes the httpOnly JWT cookie and returns the embedded user identity fields.
 *       Does NOT hit the database — values come directly from the token payload.
 *       Use /init instead on app startup to also get settings in one round-trip.
 *     responses:
 *       200:
 *         description: Token decoded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 userId:
 *                   type: integer
 *                   example: 1
 *                 username:
 *                   type: string
 *                   example: johndoe
 *                 email:
 *                   type: string
 *                   example: john@example.com
 *                 avatarUrl:
 *                   type: string
 *                   nullable: true
 *       401:
 *         description: Missing, invalid, or expired token
 */

/**
 * @swagger
 * /init:
 *   get:
 *     tags: [Authentication]
 *     summary: App init — identity + settings in one call (JWT + SQLite)
 *     description: >
 *       Decodes the JWT cookie for identity, then reads theme/camera/mic/avatarId
 *       from UserData (SQLite) in a single query.
 *       Replaces the old /me + /user/settings waterfall on app startup.
 *     responses:
 *       200:
 *         description: Init data returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 userId:
 *                   type: integer
 *                   example: 1
 *                 username:
 *                   type: string
 *                   example: johndoe
 *                 email:
 *                   type: string
 *                   example: john@example.com
 *                 avatarUrl:
 *                   type: string
 *                   nullable: true
 *                 settings:
 *                   type: object
 *                   properties:
 *                     theme:
 *                       type: string
 *                       example: dark
 *                     cameraEnabled:
 *                       type: integer
 *                     micEnabled:
 *                       type: integer
 *                     avatarId:
 *                       type: string
 *                       nullable: true
 *       401:
 *         description: Missing or invalid token
 *       404:
 *         description: User not found in database
 */

/**
 * @swagger
 * /verify-complete:
 *   post:
 *     tags: [Authentication]
 *     summary: Complete email verification (SQLite + AWS Cognito)
 *     description: >
 *       Marks the user as verified in UserData (SQLite) and deletes the temporary
 *       Cognito user via adminDeleteUser so only SQLite holds user data.
 *       Called from Login.tsx after cognitoConfirmSignUp succeeds during registration.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 example: john@example.com
 *     responses:
 *       200:
 *         description: Verification complete
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Internal server error
 */

/**
 * @swagger
 * /check-email:
 *   get:
 *     tags: [Authentication]
 *     summary: Check if email is available (SQLite)
 *     description: >
 *       Queries UserData to see if an email is already registered.
 *       Called from Profile.tsx before cognitoSignUp in the email update flow
 *       to prevent phantom Cognito users from being created for duplicate emails.
 *       /user/email also checks for duplicates as a race condition guard.
 *     parameters:
 *       - in: query
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *           example: john@example.com
 *     responses:
 *       200:
 *         description: Availability result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 available:
 *                   type: boolean
 *                   example: true
 *       500:
 *         description: Check failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 available:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Check failed
 */

// ─────────────────────────────────────────────────────────────────────────────
// SESSIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /session:
 *   post:
 *     tags: [Sessions]
 *     summary: Save a completed session in one call (SQLite)
 *     description: >
 *       Legacy endpoint. Inserts a full UserSession row with start, end, name, description,
 *       and activeDuration in a single call. avgFocus is set to 0.
 *       Prefer the /session/start → /session/chunk → PATCH /sessions/:sessionId flow for live sessions.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, sessionStart, sessionEnd, sessionName]
 *             properties:
 *               userId:
 *                 type: integer
 *                 example: 1
 *               sessionStart:
 *                 type: string
 *                 example: "2026-04-02 11:17:39"
 *               sessionEnd:
 *                 type: string
 *                 example: "2026-04-02 12:03:15"
 *               sessionName:
 *                 type: string
 *                 example: Morning Study
 *               sessionDescription:
 *                 type: string
 *                 nullable: true
 *               activeDuration:
 *                 type: integer
 *                 description: Active seconds in the session
 *                 example: 2736
 *     responses:
 *       200:
 *         description: Session saved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       500:
 *         description: Session insert error
 */

/**
 * @swagger
 * /session/start:
 *   post:
 *     tags: [Sessions]
 *     summary: Start a new session (SQLite)
 *     description: >
 *       Pre-creates a UserSession row the moment the user clicks Start Session.
 *       Returns the generated sessionId so dmb.py can tag focus chunks against
 *       a real DB row from the beginning of the session.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, sessionStart]
 *             properties:
 *               userId:
 *                 type: integer
 *                 description: FK reference to UserData.UserID
 *                 example: 1
 *               sessionStart:
 *                 type: string
 *                 description: Session start timestamp (YYYY-MM-DD HH:MM:SS)
 *                 example: "2026-04-02 11:17:39"
 *     responses:
 *       200:
 *         description: Session created, sessionId returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 sessionId:
 *                   type: integer
 *                   example: 42
 *       500:
 *         description: Session start error
 */

/**
 * @swagger
 * /session/chunk:
 *   post:
 *     tags: [Sessions]
 *     summary: Save a 5-minute focus chunk (SQLite)
 *     description: >
 *       Inserts a row into SessionChunk linked to an active session.
 *       Called by dmb.py every 5 active minutes and once on session end.
 *       chunkStatus is computed from the MediaPipe gaze/head pose data for that interval.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionId, userId, chunkStatus]
 *             properties:
 *               sessionId:
 *                 type: integer
 *                 description: FK → UserSession.SessionID (from /session/start)
 *                 example: 42
 *               userId:
 *                 type: integer
 *                 description: FK → UserData.UserID
 *                 example: 1
 *               chunkStatus:
 *                 type: string
 *                 description: Focus classification for this interval
 *                 enum: [VF, SF, SU, VU]
 *                 example: SF
 *     responses:
 *       200:
 *         description: Chunk saved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       500:
 *         description: Chunk insert error
 */

/**
 * @swagger
 * /sessions/{sessionId}:
 *   patch:
 *     tags: [Sessions]
 *     summary: Update or finalize a session (SQLite)
 *     description: >
 *       Two modes depending on whether sessionEnd is included in the body.
 *
 *       **Finalize** (sessionEnd provided): sets sessionEnd, activeDuration, sessionFeedback,
 *       and computes avgFocus from all SessionChunk rows (VF=3, SF=2, SU=1, VU=0).
 *       Called when the user clicks Stop Session.
 *
 *       **Partial update** (no sessionEnd): updates only sessionName and sessionDescription.
 *       Called from the Sessions page edit modal.
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: integer
 *           example: 42
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionName]
 *             properties:
 *               sessionName:
 *                 type: string
 *                 example: Morning Study
 *               sessionDescription:
 *                 type: string
 *                 nullable: true
 *               sessionEnd:
 *                 type: string
 *                 description: Include to trigger finalize mode
 *                 example: "2026-04-02 12:03:15"
 *               activeDuration:
 *                 type: integer
 *                 description: Total active seconds (finalize mode only)
 *                 example: 2736
 *               sessionFeedback:
 *                 type: string
 *                 nullable: true
 *                 description: AI-generated feedback string (finalize mode only)
 *     responses:
 *       200:
 *         description: Session updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       500:
 *         description: Failed to update session
 *   delete:
 *     tags: [Sessions]
 *     summary: Delete a session (SQLite)
 *     description: >
 *       Deletes the UserSession row. Cascade removes linked SessionChunk and SessionFolderMap rows.
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: integer
 *           example: 42
 *     responses:
 *       200:
 *         description: Session deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       500:
 *         description: Failed to delete session
 */

/**
 * @swagger
 * /sessions/{sessionId}/chunks:
 *   get:
 *     tags: [Sessions]
 *     summary: Get all chunks for a session (SQLite)
 *     description: >
 *       Returns all SessionChunk rows for a session ordered by endOfChunk ASC.
 *       Used by the Session Details modal to render the focus timeline.
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: integer
 *           example: 42
 *     responses:
 *       200:
 *         description: Chunks returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       ChunkId:
 *                         type: integer
 *                         example: 7
 *                       chunkStatus:
 *                         type: string
 *                         enum: [VF, SF, SU, VU]
 *                         example: SF
 *                       endOfChunk:
 *                         type: string
 *                         example: "2026-04-02 11:22:39"
 *       500:
 *         description: Failed to fetch session chunks
 */

/**
 * @swagger
 * /sessions/{sessionId}/folders:
 *   get:
 *     tags: [Sessions]
 *     summary: Get folder IDs containing a session (SQLite)
 *     description: >
 *       Returns all FolderIDs from SessionFolderMap for the given session.
 *       Used by the folder picker to pre-check checkboxes for folders that already contain the session.
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: integer
 *           example: 42
 *     responses:
 *       200:
 *         description: Folder IDs returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 folderIds:
 *                   type: array
 *                   items:
 *                     type: integer
 *                   example: [2, 5]
 *       500:
 *         description: Failed to fetch session folders
 */

/**
 * @swagger
 * /sessions/paginated/{userId}:
 *   get:
 *     tags: [Sessions]
 *     summary: Get paginated sessions for a user (SQLite)
 *     description: >
 *       Returns a page of UserSession rows with sorting and case-insensitive name search.
 *       Uses COUNT(*) OVER() as a window function so total and results come from one query.
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 5
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           description: Case-insensitive session name filter
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [date, duration]
 *           default: date
 *       - in: query
 *         name: sortDir
 *         schema:
 *           type: string
 *           enum: [ASC, DESC]
 *           default: DESC
 *     responses:
 *       200:
 *         description: Sessions page returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 sessions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       SessionID:
 *                         type: integer
 *                       sessionStart:
 *                         type: string
 *                       sessionEnd:
 *                         type: string
 *                       sessionName:
 *                         type: string
 *                       sessionDescription:
 *                         type: string
 *                         nullable: true
 *                       avgFocus:
 *                         type: number
 *                       activeDuration:
 *                         type: integer
 *                       sessionFeedback:
 *                         type: string
 *                         nullable: true
 *                 total:
 *                   type: integer
 *                   description: Total matching rows (before pagination)
 *                   example: 23
 *       500:
 *         description: Failed to fetch paginated sessions
 */

/**
 * @swagger
 * /sessions/{userId}:
 *   get:
 *     tags: [Sessions]
 *     summary: Get 4 most recent sessions for a user (SQLite)
 *     description: >
 *       Returns the 4 most recent UserSession rows ordered by sessionStart DESC.
 *       Used by Home.tsx to populate the session snapshot cards.
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Recent sessions returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 sessions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       sessionStart:
 *                         type: string
 *                         example: "2026-04-04T23:43:05.000Z"
 *                       sessionEnd:
 *                         type: string
 *                         example: "2026-04-04T23:43:06.000Z"
 *                       sessionName:
 *                         type: string
 *                       sessionDescription:
 *                         type: string
 *                         nullable: true
 *                       activeDuration:
 *                         type: integer
 *       500:
 *         description: Failed to fetch sessions
 */

// ─────────────────────────────────────────────────────────────────────────────
// FOLDERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /folders/{userId}:
 *   get:
 *     tags: [Folders]
 *     summary: List all folders for a user (SQLite)
 *     description: >
 *       Returns all SessionFolder rows for a user with a session count per folder.
 *       Uses a LEFT JOIN on SessionFolderMap so empty folders are included.
 *       Ordered by createdAt DESC.
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Folders returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 folders:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       FolderID:
 *                         type: integer
 *                         example: 3
 *                       folderName:
 *                         type: string
 *                         example: Deep Work
 *                       folderDescription:
 *                         type: string
 *                         nullable: true
 *                       sessionCount:
 *                         type: integer
 *                         example: 5
 *       500:
 *         description: Failed to fetch folders
 */

/**
 * @swagger
 * /folders:
 *   post:
 *     tags: [Folders]
 *     summary: Create a new folder (SQLite)
 *     description: Inserts a new row into SessionFolder for the given user.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, folderName]
 *             properties:
 *               userId:
 *                 type: integer
 *                 example: 1
 *               folderName:
 *                 type: string
 *                 example: Deep Work
 *               folderDescription:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Folder created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 folderId:
 *                   type: integer
 *                   example: 3
 *       400:
 *         description: userId and folderName are required
 *       500:
 *         description: Failed to create folder
 */

/**
 * @swagger
 * /folders/{folderId}:
 *   patch:
 *     tags: [Folders]
 *     summary: Update folder name or description (SQLite)
 *     description: >
 *       Updates folderName and/or folderDescription. At least one field must be provided.
 *       Only provided fields are changed.
 *     parameters:
 *       - in: path
 *         name: folderId
 *         required: true
 *         schema:
 *           type: integer
 *           example: 3
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               folderName:
 *                 type: string
 *                 example: Evening Sessions
 *               folderDescription:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Folder updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Nothing to update
 *       500:
 *         description: Failed to update folder
 *   delete:
 *     tags: [Folders]
 *     summary: Delete a folder (SQLite)
 *     description: >
 *       Deletes the SessionFolder row. Cascade removes SessionFolderMap links.
 *       Sessions themselves are not deleted.
 *     parameters:
 *       - in: path
 *         name: folderId
 *         required: true
 *         schema:
 *           type: integer
 *           example: 3
 *     responses:
 *       200:
 *         description: Folder deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       500:
 *         description: Failed to delete folder
 */

/**
 * @swagger
 * /folders/{folderId}/sessions:
 *   get:
 *     tags: [Folders]
 *     summary: Get paginated sessions in a folder (SQLite)
 *     description: >
 *       Same pagination, sorting, and search params as /sessions/paginated/:userId,
 *       but filters by folder membership via SessionFolderMap.
 *     parameters:
 *       - in: path
 *         name: folderId
 *         required: true
 *         schema:
 *           type: integer
 *           example: 3
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 5
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [date, duration]
 *           default: date
 *       - in: query
 *         name: sortDir
 *         schema:
 *           type: string
 *           enum: [ASC, DESC]
 *           default: DESC
 *     responses:
 *       200:
 *         description: Folder sessions returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 sessions:
 *                   type: array
 *                   items:
 *                     type: object
 *                 total:
 *                   type: integer
 *                   example: 5
 *       500:
 *         description: Failed to fetch folder sessions
 *   post:
 *     tags: [Folders]
 *     summary: Add a session to a folder (SQLite)
 *     description: >
 *       Inserts a row into SessionFolderMap. Uses INSERT OR IGNORE so duplicate
 *       links are safe to call multiple times.
 *     parameters:
 *       - in: path
 *         name: folderId
 *         required: true
 *         schema:
 *           type: integer
 *           example: 3
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionId]
 *             properties:
 *               sessionId:
 *                 type: integer
 *                 example: 42
 *     responses:
 *       200:
 *         description: Session added to folder
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       500:
 *         description: Failed to add session to folder
 */

/**
 * @swagger
 * /folders/{folderId}/sessions/{sessionId}:
 *   delete:
 *     tags: [Folders]
 *     summary: Remove a session from a folder (SQLite)
 *     description: >
 *       Deletes the SessionFolderMap row linking this session to this folder.
 *       The session itself is not deleted.
 *     parameters:
 *       - in: path
 *         name: folderId
 *         required: true
 *         schema:
 *           type: integer
 *           example: 3
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: integer
 *           example: 42
 *     responses:
 *       200:
 *         description: Session removed from folder
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       500:
 *         description: Failed to remove session from folder
 */

// ─────────────────────────────────────────────────────────────────────────────
// METRICS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /sessions/metrics/monthly/{userId}:
 *   get:
 *     tags: [Metrics]
 *     summary: Monthly session aggregates for heatmap (SQLite)
 *     description: >
 *       Returns one row per day in the requested month with session count,
 *       total active duration, and average focus score.
 *       Used by the Metrics page monthly heatmap calendar.
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *       - in: query
 *         name: year
 *         required: true
 *         schema:
 *           type: string
 *           example: "2026"
 *       - in: query
 *         name: month
 *         required: true
 *         schema:
 *           type: string
 *           description: Zero-padded month number
 *           example: "04"
 *     responses:
 *       200:
 *         description: Monthly aggregates returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       day:
 *                         type: string
 *                         example: "2026-04-03"
 *                       sessionCount:
 *                         type: integer
 *                         example: 2
 *                       totalDuration:
 *                         type: integer
 *                         description: Sum of activeDuration in seconds
 *                         example: 5400
 *                       avgFocus:
 *                         type: number
 *                         example: 1.75
 *       400:
 *         description: year and month query params are required
 *       500:
 *         description: Failed to fetch monthly metrics
 */

/**
 * @swagger
 * /metrics/focus-over-time/{userId}:
 *   get:
 *     tags: [Metrics]
 *     summary: Daily focus scores for line chart (SQLite)
 *     description: >
 *       Aggregates UserSession rows by date and returns focusScore (0–100),
 *       session count, and total duration per day.
 *
 *       Two query modes:
 *       - **Range preset** (range param): 7D (default), 1M, or 1Y relative to now.
 *       - **Custom range** (start + end params): exact date range (YYYY-MM-DD), takes precedence over range.
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           enum: [7D, 1M, 1Y]
 *           default: 7D
 *       - in: query
 *         name: start
 *         schema:
 *           type: string
 *           example: "2026-03-01"
 *         description: Custom range start date (YYYY-MM-DD). Requires end.
 *       - in: query
 *         name: end
 *         schema:
 *           type: string
 *           example: "2026-03-31"
 *         description: Custom range end date (YYYY-MM-DD). Requires start.
 *     responses:
 *       200:
 *         description: Focus time series returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:
 *                         type: string
 *                         example: "2026-04-03"
 *                       focusScore:
 *                         type: number
 *                         description: avgFocus * 100 / 3 (0–100 scale)
 *                         example: 66.67
 *                       sessionCount:
 *                         type: integer
 *                         example: 2
 *                       totalDuration:
 *                         type: integer
 *                         example: 5400
 *       500:
 *         description: Failed to fetch focus data
 */

/**
 * @swagger
 * /metrics/weekly-summary/{userId}:
 *   get:
 *     tags: [Metrics]
 *     summary: Weekly focus summary for diamond wheel (SQLite)
 *     description: >
 *       Aggregates the last 7 days of UserSession data grouped by day of week (0=Sun, 6=Sat).
 *       Returns computed focus, eye, and deep scores derived from avgFocus,
 *       plus total duration and session count per day.
 *       Used by the Metrics page diamond wheel visualization.
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Weekly summary returned (always 7 entries, one per weekday)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   description: Index 0 = Sunday, 6 = Saturday
 *                   items:
 *                     type: object
 *                     properties:
 *                       focus:
 *                         type: integer
 *                         example: 66
 *                       eye:
 *                         type: integer
 *                         example: 56
 *                       deep:
 *                         type: integer
 *                         example: 50
 *                       duration:
 *                         type: string
 *                         example: "45m"
 *                       distractions:
 *                         type: integer
 *                         example: 3
 *       500:
 *         description: Failed to fetch weekly data
 */

// ─────────────────────────────────────────────────────────────────────────────
// USER PROFILE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /user/settings:
 *   get:
 *     tags: [User Profile]
 *     summary: Get user settings (JWT + SQLite)
 *     description: >
 *       Decodes the JWT cookie to get userId, then reads theme, cameraEnabled,
 *       micEnabled, and avatarId from UserData (SQLite).
 *       Prefer /init on app startup to avoid a double round-trip.
 *     responses:
 *       200:
 *         description: Settings returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 theme:
 *                   type: string
 *                   example: dark
 *                 cameraEnabled:
 *                   type: integer
 *                   example: 1
 *                 micEnabled:
 *                   type: integer
 *                   example: 0
 *                 avatarId:
 *                   type: string
 *                   nullable: true
 *       401:
 *         description: Missing or invalid token
 *       404:
 *         description: User not found
 *   put:
 *     tags: [User Profile]
 *     summary: Save user settings (SQLite)
 *     description: Updates theme, cameraEnabled, micEnabled, and avatarId in UserData.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId]
 *             properties:
 *               userId:
 *                 type: integer
 *                 example: 1
 *               theme:
 *                 type: string
 *                 example: dark
 *               cameraEnabled:
 *                 type: integer
 *                 example: 1
 *               micEnabled:
 *                 type: integer
 *                 example: 0
 *               avatarId:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Settings saved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: userId required
 *       500:
 *         description: Failed to save settings
 */

/**
 * @swagger
 * /user/username:
 *   put:
 *     tags: [User Profile]
 *     summary: Update username (SQLite + JWT refresh)
 *     description: >
 *       Updates uName in UserData and re-issues the JWT cookie so the new username
 *       is reflected immediately without a page reload.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, newUsername]
 *             properties:
 *               userId:
 *                 type: integer
 *                 example: 1
 *               newUsername:
 *                 type: string
 *                 example: janedoe
 *     responses:
 *       200:
 *         description: Username updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       500:
 *         description: Failed to update username
 */

/**
 * @swagger
 * /user/email:
 *   put:
 *     tags: [User Profile]
 *     summary: Update email after Cognito verification (SQLite + AWS Cognito)
 *     description: >
 *       Updates uEmail in UserData after Cognito verification completes.
 *       Checks for duplicate emails as a race condition guard (pre-check done by /check-email).
 *       Also calls adminDeleteUser to delete the temp Cognito user, same pattern as /verify-complete.
 *       Called from Profile.tsx after cognitoConfirmSignUp succeeds in the email update flow.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, newEmail]
 *             properties:
 *               userId:
 *                 type: integer
 *                 example: 1
 *               newEmail:
 *                 type: string
 *                 example: newemail@example.com
 *     responses:
 *       200:
 *         description: Email update result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   description: Present only on failure
 *                   example: Email in use
 *       500:
 *         description: Failed to update email
 */

/**
 * @swagger
 * /user/password:
 *   put:
 *     tags: [User Profile]
 *     summary: Update password (SQLite)
 *     description: >
 *       Hashes the new password with bcrypt and updates uPassword in UserData.
 *       Does not verify the current password — authentication is enforced by the JWT cookie.
 *       Called from Profile.tsx when the user submits the password change modal.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, newPassword]
 *             properties:
 *               userId:
 *                 type: integer
 *                 example: 1
 *               newPassword:
 *                 type: string
 *                 example: NewPassword456!
 *     responses:
 *       200:
 *         description: Password updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       500:
 *         description: Failed to update password
 */

/**
 * @swagger
 * /reset-password:
 *   put:
 *     tags: [User Profile]
 *     summary: Reset password by email (SQLite — no auth required)
 *     description: >
 *       Hashes the new password and updates uPassword in UserData by email.
 *       Used in the forgot-password flow where the user is not logged in and
 *       no userId is available. Authentication is provided by the Cognito OTP
 *       flow that precedes this call.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, newPassword]
 *             properties:
 *               email:
 *                 type: string
 *                 example: john@example.com
 *               newPassword:
 *                 type: string
 *                 example: NewPassword456!
 *     responses:
 *       200:
 *         description: Password reset
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       500:
 *         description: Failed to reset password
 */

/**
 * @swagger
 * /user/account:
 *   delete:
 *     tags: [User Profile]
 *     summary: Delete user account (SQLite + AWS S3)
 *     description: >
 *       Verifies the password, deletes the user's S3 avatar if one exists,
 *       then deletes the UserData row. Cascade removes all sessions, chunks, and folders.
 *       Called from Profile.tsx when the user confirms account deletion.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, password]
 *             properties:
 *               userId:
 *                 type: integer
 *                 example: 1
 *               password:
 *                 type: string
 *                 description: Current password used to confirm deletion intent
 *                 example: Password123!
 *     responses:
 *       200:
 *         description: Account deletion result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   description: Present on failure only
 *                   example: Incorrect password
 *       500:
 *         description: Failed to delete account
 */

// ─────────────────────────────────────────────────────────────────────────────
// AWS S3
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /user/avatar/presigned-url:
 *   post:
 *     tags: [AWS S3]
 *     summary: Generate a presigned S3 PUT URL for avatar upload
 *     description: >
 *       Calls s3.getSignedUrlPromise("putObject") to produce a short-lived (60s) presigned URL.
 *       The frontend PUTs the file directly to S3 using this URL without routing data through the backend.
 *       Also returns the final public URL that should be passed to PUT /user/avatar after upload.
 *       S3 key format: avatars/{userId}-{timestamp}.{ext}
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, fileType]
 *             properties:
 *               userId:
 *                 type: integer
 *                 description: Used to name the S3 key
 *                 example: 1
 *               fileType:
 *                 type: string
 *                 description: MIME type of the image
 *                 example: image/png
 *     responses:
 *       200:
 *         description: Presigned URL generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 uploadUrl:
 *                   type: string
 *                   description: Presigned S3 PUT URL (expires in 60s)
 *                   example: https://my-bucket.s3.amazonaws.com/avatars/1-1234567890.png?X-Amz-Signature=...
 *                 publicUrl:
 *                   type: string
 *                   description: Final public URL to pass to PUT /user/avatar
 *                   example: https://my-bucket.s3.us-east-1.amazonaws.com/avatars/1-1234567890.png
 *       500:
 *         description: Failed to generate upload URL
 */

/**
 * @swagger
 * /user/avatar:
 *   put:
 *     tags: [AWS S3]
 *     summary: Save new avatar URL (SQLite + S3 delete old)
 *     description: >
 *       Saves the public S3 URL to avatarUrl in UserData.
 *       If the user had a previous avatar, calls s3.deleteObject to remove the old S3 object first.
 *       Re-issues the JWT cookie so avatarUrl is reflected immediately.
 *       Called from Profile.tsx after the direct-to-S3 PUT completes.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, avatarUrl]
 *             properties:
 *               userId:
 *                 type: integer
 *                 example: 1
 *               avatarUrl:
 *                 type: string
 *                 description: Public S3 URL returned by /user/avatar/presigned-url
 *                 example: https://my-bucket.s3.us-east-1.amazonaws.com/avatars/1-1234567890.png
 *     responses:
 *       200:
 *         description: Avatar URL saved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       500:
 *         description: Failed to save avatar URL
 *   delete:
 *     tags: [AWS S3]
 *     summary: Remove avatar (SQLite + S3 delete)
 *     description: >
 *       Sets avatarUrl to NULL in UserData and deletes the corresponding S3 object.
 *       Called from Profile.tsx when the user clicks Remove Avatar.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId]
 *             properties:
 *               userId:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       200:
 *         description: Avatar removed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       500:
 *         description: Failed to remove avatar
 */

// ─────────────────────────────────────────────────────────────────────────────
// AWS COGNITO (backend admin)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /delete-cognito-user:
 *   post:
 *     tags: [AWS Cognito]
 *     summary: Delete a Cognito user by email (AWS Cognito adminDeleteUser)
 *     description: >
 *       Calls listUsers to resolve the real Cognito username (UUID) from email,
 *       then calls adminDeleteUser. Passing email directly to adminDeleteUser fails
 *       with MissingRequiredParameter — the UUID lookup is required.
 *
 *       Used as a fallback to clean up orphaned Cognito users.
 *       Also called from Profile.tsx when the email-verify modal is closed mid-flow
 *       to prevent a phantom user from accumulating in Cognito.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 example: john@example.com
 *     responses:
 *       200:
 *         description: Cognito user deleted (or not found — safe to call either way)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       500:
 *         description: Server error
 */

// ─────────────────────────────────────────────────────────────────────────────
// COGNITO SDK (frontend SDK reference — not HTTP endpoints)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /cognito/signup:
 *   post:
 *     tags: [Cognito SDK]
 *     summary: cognitoSignUp() — frontend SDK call, not a backend endpoint
 *     description: >
 *       Frontend SDK call using SignUpCommand from @aws-sdk/client-cognito-identity-provider.
 *       Creates a temporary Cognito user and triggers a 6-digit verification email.
 *
 *       Called from Login.tsx after a successful /register backend call.
 *       Also called from Profile.tsx during the email update flow after /check-email confirms availability.
 *
 *       If cognitoSignUp throws UsernameExistsException, the frontend calls /delete-cognito-user to
 *       clear the phantom and retries. The Cognito user is deleted server-side after verification
 *       via /verify-complete (registration) or /user/email (email update).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, username]
 *             properties:
 *               email:
 *                 type: string
 *                 description: Used as Cognito Username (pool uses email alias)
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 description: Real password for registration; random temp password for email update flow
 *                 example: Password123!
 *               username:
 *                 type: string
 *                 description: Stored as preferred_username attribute in Cognito
 *                 example: johndoe
 *     responses:
 *       200:
 *         description: Cognito user created, verification email sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 UserConfirmed:
 *                   type: boolean
 *                   example: false
 *                   description: Always false — user must confirm via email code
 */

/**
 * @swagger
 * /cognito/confirm:
 *   post:
 *     tags: [Cognito SDK]
 *     summary: cognitoConfirmSignUp() — frontend SDK call, not a backend endpoint
 *     description: >
 *       Frontend SDK call using ConfirmSignUpCommand from @aws-sdk/client-cognito-identity-provider.
 *       Validates the 6-digit code the user received via email.
 *
 *       On success during registration, Login.tsx calls /verify-complete on the backend.
 *       On success during email update, Profile.tsx calls /user/email on the backend.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, code]
 *             properties:
 *               email:
 *                 type: string
 *                 description: Used as Cognito Username
 *                 example: john@example.com
 *               code:
 *                 type: string
 *                 description: 6-digit verification code from email
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Email verified in Cognito
 *       400:
 *         description: Invalid or expired code
 */

/**
 * @swagger
 * /cognito/resend:
 *   post:
 *     tags: [Cognito SDK]
 *     summary: cognitoResendCode() — frontend SDK call, not a backend endpoint
 *     description: >
 *       Frontend SDK call using ResendConfirmationCodeCommand from @aws-sdk/client-cognito-identity-provider.
 *       Resends the verification email if the code expired or wasn't received.
 *
 *       Called from Login.tsx ("Resend code" during registration verify stage) and
 *       from Profile.tsx ("Resend code" during email update verify modal).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 description: Used as Cognito Username
 *                 example: john@example.com
 *     responses:
 *       200:
 *         description: Verification code resent
 *       400:
 *         description: User not found or already confirmed
 */

// ─────────────────────────────────────────────────────────────────────────────
// AI AGENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /agent:
 *   post:
 *     tags: [AI Agent]
 *     summary: Classify user intent via Groq (llama-3.1-8b-instant)
 *     description: >
 *       Proxies the user's message to the Groq API with a fixed system prompt that
 *       maps natural language to one of a set of navigation/action intents.
 *       Returns a structured action string. Temperature is 0 for deterministic output.
 *
 *       Possible action values: navigate_sessions, navigate_sessions_folders,
 *       navigate_metrics, navigate_profile, navigate_studies, navigate_about,
 *       start_session, unknown.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message:
 *                 type: string
 *                 example: Show me my focus stats
 *     responses:
 *       200:
 *         description: Intent classified
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 action:
 *                   type: string
 *                   example: navigate_metrics
 *       400:
 *         description: Empty message
 *       500:
 *         description: Groq API error, falls back to action "unknown"
 */

// ─────────────────────────────────────────────────────────────────────────────
// DEV
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /dev/checkpoint:
 *   post:
 *     tags: [Dev]
 *     summary: Flush SQLite WAL to main DB (dev only)
 *     description: >
 *       Runs PRAGMA wal_checkpoint(FULL) so tools like Adminer see a fully up-to-date snapshot.
 *       Only registered when NODE_ENV !== "production".
 *     responses:
 *       200:
 *         description: Checkpoint complete
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 */
