import express from "express";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import cors from "cors";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import pkg from "aws-sdk";
const { CognitoIdentityServiceProvider, S3, config: awsConfig } = pkg;

dotenv.config();

//AWS credentials (changed to ec2 backend, no longer needed local)
awsConfig.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: "us-east-1",
});

/*
BUGS NEED FIXING (this might be fixed, still need more testing):
rn when registering for account, dupe emails are not allowed,
so if you spam register with the same email, a new account will not be made,
BUT, UserID still gets incremented, resulting in incosistency between # of users and userIDs

TO ADD:
Friend feature where users can add other unique users to a friend list.
Several inital checks, isUserVerifed? isRequestSent? requestStatus? (update base on needs),
This also requries new APIs such as /send-friend-request and such,
make to update swagger API routes when adding

D3 Observe, to graph db values and poten tables, point is to have it run as a server.js
without external softwares to be downloaded
*/

const app = express();
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || "http://localhost:5174",
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());

//Issues a signed JWT as an httpOnly cookie
function issueAuthCookie(res, user) {
  const token = jwt.sign(
    { userId: user.UserID, username: user.uName, email: user.uEmail, avatarUrl: user.avatarUrl ?? null },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

//SQLite connection - file-based, no network credentials needed
const db = new Database(process.env.DB_PATH || "./focuslens.db");
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

//Initialize schema - CREATE TABLE IF NOT EXISTS is idempotent, safe to run every startup
db.exec(`
  CREATE TABLE IF NOT EXISTS UserData (
    UserID        INTEGER PRIMARY KEY AUTOINCREMENT,
    uEmail        TEXT NOT NULL UNIQUE,
    uName         TEXT NOT NULL,
    uPassword     TEXT NOT NULL,
    verified      INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    avatarUrl     TEXT NULL DEFAULT NULL,
    isDarkMode    INTEGER,
    cameraEnabled INTEGER,
    micEnabled    INTEGER,
    avatarId      TEXT
  );

  CREATE TABLE IF NOT EXISTS UserSession (
    SessionID          INTEGER PRIMARY KEY AUTOINCREMENT,
    UserID             INTEGER NOT NULL,
    sessionStart       TEXT NOT NULL DEFAULT (datetime('now')),
    sessionEnd         TEXT NOT NULL DEFAULT (datetime('now')),
    avgFocus           REAL NOT NULL,
    sessionName        TEXT NOT NULL DEFAULT '',
    sessionDescription TEXT NULL,
    FOREIGN KEY (UserID) REFERENCES UserData(UserID) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS SessionChunk (
    ChunkId     INTEGER PRIMARY KEY AUTOINCREMENT,
    SessionID   INTEGER NOT NULL,
    UserID      INTEGER NOT NULL,
    endOfChunk  TEXT NOT NULL DEFAULT (datetime('now')),
    chunkStatus TEXT CHECK(chunkStatus IN ('VF', 'SF', 'VU', 'SU')),
    FOREIGN KEY (SessionID) REFERENCES UserSession(SessionID) ON DELETE CASCADE,
    FOREIGN KEY (UserID) REFERENCES UserData(UserID) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_usersession_userid_start
    ON UserSession(UserID, sessionStart DESC);
`);

console.log("Connected to SQLite:", process.env.DB_PATH || "./focuslens.db");

//Cognito client instance, injects connection info from .env file to connect with AWS Cognito
const cognito = new CognitoIdentityServiceProvider({ region: "us-east-1" });

//S3 client using dedicated S3 IAM credentials for avatar uploads
const s3 = new S3({
  accessKeyId: process.env.S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});
const USER_POOL_ID = process.env.USER_POOL_ID;

//Looks up real cognito username via email filter before deleting,
//as adminDeleteUser requires the pool username (a UUID) not the email alias,
//passing the email directly causes failure
async function deleteCognitoUserByEmail(email) {
  const listResult = await cognito.listUsers({
    UserPoolId: USER_POOL_ID,
    Filter: `email = "${email}"`,
    Limit: 1,
  }).promise();

  if (!listResult.Users || listResult.Users.length === 0) {
    console.log(`server.js: No Cognito user found for email ${email}, skipping delete`);
    return;
  }

  const cognitoUsername = listResult.Users[0].Username;
  await cognito.adminDeleteUser({
    UserPoolId: USER_POOL_ID,
    Username: cognitoUsername,
  }).promise();

  console.log(`server.js: Deleted Cognito user ${cognitoUsername} (${email})`);
}

//Used for testing if backend server is online
app.get("/", (_req, res) => {
  res.send("Backend server is running");
});

//UserSession API, saves user info into db after ending session
//Note that avgFocus is set to 0, update when data could be fetched for it
app.post("/session", async (req, res) => {
  const { userId, sessionStart, sessionEnd, sessionName, sessionDescription } = req.body;
  try {
    db.prepare(
      "INSERT INTO UserSession (UserID, sessionStart, sessionEnd, avgFocus, sessionName, sessionDescription) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(userId, sessionStart, sessionEnd, 0, sessionName, sessionDescription);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Session insert error" });
  }
});

//Fetches all sessions for a user with pagination, sorting, and case-insensitive search
app.get("/sessions/paginated/:userId", async (req, res) => {
  const { userId } = req.params;
  const page    = Math.max(1, parseInt(req.query.page)  || 1);
  const limit   = Math.max(1, parseInt(req.query.limit) || 5);
  const offset  = (page - 1) * limit;
  const search  = req.query.search ? String(req.query.search) : '';
  const sortDir = req.query.sortDir === 'ASC' ? 'ASC' : 'DESC';

  // Whitelist to prevent SQL injection (column names can't be parameterized)
  const sortByMap = {
    date:     'sessionStart',
    duration: "(strftime('%s', sessionEnd) - strftime('%s', sessionStart))",
    avgFocus: 'avgFocus',
  };
  const orderExpr = sortByMap[req.query.sortBy] || sortByMap.date;

  try {
    const searchParam = `%${search.toLowerCase()}%`;
    //COUNT(*) OVER() is a window function computed before LIMIT/OFFSET, so it reflects the
    //full matching row count, eliminating the need for a separate COUNT query
    //tldr, one query instead of two for sesssions page
    const rows = db.prepare(
      `SELECT sessionStart, sessionEnd, sessionName, sessionDescription, avgFocus,
              COUNT(*) OVER() AS total
       FROM UserSession
       WHERE UserID = ? AND LOWER(sessionName) LIKE ?
       ORDER BY ${orderExpr} ${sortDir}
       LIMIT ${limit} OFFSET ${offset}`
    ).all(userId, searchParam);
    const total = rows.length > 0 ? Number(rows[0].total) : 0;
    res.json({ success: true, sessions: rows, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to fetch paginated sessions" });
  }
});

//Fetches 3 most recent sessions for a user (based on userID), used for homepage session snapshots
app.get("/sessions/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const rows = db.prepare(
      "SELECT sessionStart, sessionEnd, sessionName, sessionDescription FROM UserSession WHERE UserID = ? ORDER BY sessionStart DESC LIMIT 3"
    ).all(userId);
    res.json({ success: true, sessions: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to fetch sessions" });
  }
});

//Register API, saves user as unverified until email is confirmed
app.post("/register", async (req, res) => {
  const { email, username, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 12);
    db.prepare(
      "INSERT INTO UserData (uEmail, uName, uPassword, verified, created_at) VALUES (?, ?, ?, 0, datetime('now'))"
    ).run(email, username, hashedPassword);
    res.json({ message: "User registered" });
  } catch (err) {
    console.error(err);
    //This would also trigger if cognito doesn't delete its copy of user
    if (err.code === "SQLITE_CONSTRAINT_UNIQUE" || (err.message && err.message.includes("UNIQUE constraint failed"))) {
      return res.status(400).json({ message: "server.js: Email already exists" });
    }
    return res.status(500).json({ message: "server.js: User register error" });
  }
});

//Rolls back a sqlite insert if cognitoSignUp fails after /register succeeds,
//prevents the email from being permanently locked out until cleanup runs
app.delete("/register-rollback", async (req, res) => {
  const { email } = req.body;
  try {
    db.prepare("DELETE FROM UserData WHERE uEmail = ? AND verified = 0").run(email);
    res.json({ success: true });
  } catch (err) {
    console.error("server.js: register-rollback error:", err);
    res.status(500).json({ success: false, message: "Rollback failed" });
  }
});

//Login API, only allows verified users to log in
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const rows = db.prepare("SELECT * FROM UserData WHERE uEmail=?").all(email);

    if (rows.length === 0) {
      return res.json({ success: false, message: "server.js: Invalid email or password" });
    }

    const user = rows[0];
    const passwordMatch = await bcrypt.compare(password, user.uPassword);
    if (!passwordMatch) {
      return res.json({ success: false, message: "server.js: Invalid email or password" });
    }

    //Block unverified users from logging in
    if (!user.verified) {
      return res.json({ success: false, message: "Please verify your email before logging in." });
    }

    //note that since user info are unique, rows[0] is the only row,
    //and it represents said users info
    //Return user + settings in the login response so the frontend doesn't need a second /init call
    issueAuthCookie(res, user);
    res.json({
      success: true,
      userId: user.UserID,
      username: user.uName,
      email: user.uEmail,
      avatarUrl: user.avatarUrl ?? null,
      settings: {
        isDarkMode: user.isDarkMode,
        cameraEnabled: user.cameraEnabled,
        micEnabled: user.micEnabled,
        avatarId: user.avatarId,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "server.js: Login error" });
  }
});

//Returns user data from the JWT cookie — used by frontend on app init to rehydrate session
app.get("/me", (req, res) => {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ success: false });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ success: true, userId: decoded.userId, username: decoded.username, email: decoded.email, avatarUrl: decoded.avatarUrl });
  } catch {
    res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
});

//Combined init endpoint: decodes JWT and fetches user settings in one round-trip
//Replaces separate /me + /user/settings calls on app startup to eliminate a network waterfall
app.get("/init", async (req, res) => {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ success: false });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const row = db.prepare(
      "SELECT isDarkMode, cameraEnabled, micEnabled, avatarId FROM UserData WHERE UserID=?"
    ).get(decoded.userId);
    if (!row) return res.status(404).json({ success: false });
    res.json({
      success: true,
      userId: decoded.userId,
      username: decoded.username,
      email: decoded.email,
      avatarUrl: decoded.avatarUrl ?? null,
      settings: row,
    });
  } catch {
    res.status(401).json({ success: false });
  }
});

//Clears the auth cookie to log the user out
app.post("/logout", (_req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
  res.json({ success: true });
});

//Returns the user's settings from the DB
app.get("/user/settings", async (req, res) => {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ success: false });
  try {
    const { userId } = jwt.verify(token, process.env.JWT_SECRET);
    const row = db.prepare(
      "SELECT isDarkMode, cameraEnabled, micEnabled, avatarId FROM UserData WHERE UserID=?"
    ).get(userId);
    if (!row) return res.status(404).json({ success: false });
    res.json({ success: true, ...row });
  } catch {
    res.status(401).json({ success: false });
  }
});

//Saves the user's settings to the DB
app.put("/user/settings", async (req, res) => {
  const { userId, isDarkMode, cameraEnabled, micEnabled, avatarId } = req.body;
  if (!userId) return res.status(400).json({ success: false, message: "userId required" });
  try {
    db.prepare(
      "UPDATE UserData SET isDarkMode=?, cameraEnabled=?, micEnabled=?, avatarId=? WHERE UserID=?"
    ).run(isDarkMode, cameraEnabled, micEnabled, avatarId, userId);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to save settings" });
  }
});

//Updates username in sqlite
app.put("/user/username", async (req, res) => {
  const { userId, newUsername } = req.body;
  try {
    db.prepare("UPDATE UserData SET uName = ? WHERE UserID = ?").run(newUsername, userId);
    // Re-issue JWT so the new username is reflected immediately on refresh
    const user = db.prepare("SELECT * FROM UserData WHERE UserID = ?").get(userId);
    if (user) issueAuthCookie(res, user);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to update username" });
  }
});

//Updates password in sqlite
app.put("/user/password", async (req, res) => {
  const { userId, newPassword } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    db.prepare("UPDATE UserData SET uPassword = ? WHERE UserID = ?").run(hashedPassword, userId);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to update password" });
  }
});

//Resets password by email for forgot-password flow (user not logged in, no userId available)
app.put("/reset-password", async (req, res) => {
  const { email, newPassword } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    db.prepare("UPDATE UserData SET uPassword = ? WHERE uEmail = ?").run(hashedPassword, email);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to reset password" });
  }
});

//Check if email is already taken before creating a cognito user,
//prevents phantom users from being created for duplicate emails
//differs from /user/email in that this is ran in profile.tsx before cognitoSignUp
app.get("/check-email", async (req, res) => {
  const { email } = req.query;
  try {
    const row = db.prepare("SELECT UserID FROM UserData WHERE uEmail = ?").get(email);
    res.json({ available: !row });
  } catch (err) {
    console.error("server.js: check-email error:", err);
    res.status(500).json({ available: false, message: "Check failed" });
  }
});

//Updates email in sqlite, checks for duplicate email first
//Deletes cognito temp user after verification same as register flow
//this runs after cognito verification is complete
app.put("/user/email", async (req, res) => {
  const { userId, newEmail } = req.body;
  try {
    //Check if new email already exists
    //mostly for race condition edge case between two users
    const existing = db.prepare("SELECT UserID FROM UserData WHERE uEmail = ?").get(newEmail);
    if (existing) {
      return res.json({ success: false, message: "Email in use" });
    }

    //Update email in sqlite
    db.prepare("UPDATE UserData SET uEmail = ? WHERE UserID = ?").run(newEmail, userId);

    //Delete temp cognito user after verification, same pattern as register
    try {
      await deleteCognitoUserByEmail(newEmail);
    } catch (cognitoErr) {
      //Non-fatal, log and continue, resolve on cognito side if this shows up
      console.error("server.js: Cognito delete error (non-fatal):", cognitoErr.message);
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to update email" });
  }
});

//Called after Cognito email verification, marks user as verified in sqlite
//then deletes temp user from Cognito so sqlite is the only instance to store user info
app.post("/verify-complete", async (req, res) => {
  console.log("verify-complete hit with:", req.body);
  const { email } = req.body;
  try {
    //Mark user as verified in sqlite
    db.prepare("UPDATE UserData SET verified = 1 WHERE uEmail = ?").run(email);

    //Delete from cognito, sqlite holds data so no phantoms in cognito
    try {
      await deleteCognitoUserByEmail(email);
    } catch (cognitoErr) {
      //Log but don't fail, user is already verified in sqlite
      console.error("server.js: Cognito delete error (non-fatal):", cognitoErr.message);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("server.js: verify-complete error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

//Manual delete endpoint (for when not logged onto cognito instance via web)
app.post("/delete-cognito-user", async (req, res) => {
  const { email } = req.body;
  try {
    await deleteCognitoUserByEmail(email);
    res.json({ success: true });
  } catch (err) {
    console.error("server.js: delete-cognito-user error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

//Generates a presigned S3 PUT URL so the frontend can upload directly to S3
app.post("/user/avatar/presigned-url", async (req, res) => {
  const { userId, fileType } = req.body;
  const ext = fileType.split("/")[1];
  const key = `avatars/${userId}-${Date.now()}.${ext}`;
  const params = {
    Bucket: process.env.S3_AVATAR_BUCKET,
    Key: key,
    ContentType: fileType,
    Expires: 60,
  };
  try {
    const uploadUrl = await s3.getSignedUrlPromise("putObject", params);
    const publicUrl = `https://${process.env.S3_AVATAR_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    res.json({ uploadUrl, publicUrl });
  } catch (err) {
    console.error("server.js: presigned URL error:", err);
    res.status(500).json({ success: false, message: "Failed to generate upload URL" });
  }
});

//Saves the S3 public URL to the user's profile in sqlite, deletes old S3 object if one exists
app.put("/user/avatar", async (req, res) => {
  const { userId, avatarUrl } = req.body;
  try {
    //Fetch old avatar URL before overwriting
    const row = db.prepare("SELECT avatarUrl FROM UserData WHERE UserID = ?").get(userId);
    const oldUrl = row?.avatarUrl;

    //Update DB with new URL
    db.prepare("UPDATE UserData SET avatarUrl = ? WHERE UserID = ?").run(avatarUrl, userId);

    //Delete old S3 object if it exists and is in our bucket
    if (oldUrl && oldUrl.includes(process.env.S3_AVATAR_BUCKET)) {
      const oldKey = new URL(oldUrl).pathname.slice(1); // strip leading "/"
      await s3.deleteObject({
        Bucket: process.env.S3_AVATAR_BUCKET,
        Key: oldKey,
      }).promise();
      console.log(`server.js: Deleted old avatar from S3: ${oldKey}`);
    }

    // Re-issue JWT so the new avatarUrl is reflected immediately on refresh
    const user = db.prepare("SELECT * FROM UserData WHERE UserID = ?").get(userId);
    if (user) issueAuthCookie(res, user);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to save avatar URL" });
  }
});

//Removes avatar URL from DB and deletes the S3 object
app.delete("/user/avatar", async (req, res) => {
  const { userId } = req.body;
  try {
    const row = db.prepare("SELECT avatarUrl FROM UserData WHERE UserID = ?").get(userId);
    const oldUrl = row?.avatarUrl;

    db.prepare("UPDATE UserData SET avatarUrl = NULL WHERE UserID = ?").run(userId);

    if (oldUrl && oldUrl.includes(process.env.S3_AVATAR_BUCKET)) {
      const oldKey = new URL(oldUrl).pathname.slice(1);
      await s3.deleteObject({
        Bucket: process.env.S3_AVATAR_BUCKET,
        Key: oldKey,
      }).promise();
      console.log(`server.js: Deleted avatar from S3: ${oldKey}`);
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to remove avatar" });
  }
});

//Deletes user account from sqlite and their S3 avatar if one exists
app.delete("/user/account", async (req, res) => {
  const { userId, password } = req.body;
  try {
    const row = db.prepare("SELECT avatarUrl, uPassword FROM UserData WHERE UserID = ?").get(userId);
    if (!row) return res.json({ success: false, message: "User not found" });
    const passwordMatch = await bcrypt.compare(password, row.uPassword);
    if (!passwordMatch) return res.json({ success: false, message: "Incorrect password" });

    const avatarUrl = row.avatarUrl;

    if (avatarUrl && avatarUrl.includes(process.env.S3_AVATAR_BUCKET)) {
      const key = new URL(avatarUrl).pathname.slice(1);
      await s3.deleteObject({
        Bucket: process.env.S3_AVATAR_BUCKET,
        Key: key,
      }).promise();
      console.log(`server.js: Deleted avatar from S3 for user ${userId}`);
    }

    db.prepare("DELETE FROM UserData WHERE UserID = ?").run(userId);
    console.log(`server.js: Deleted account for user ${userId}`);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to delete account" });
  }
});

//Cleanup job, runs every hour
//Needs more testing to be done, for now keep as is
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

//The purpose of this is to remove users who didn't finish their verification,
//users that verify gets deleted off of cognito right away,
//but those that don't won't be, as such it creates phantoms,
//this is a way to resolve the issue
async function cleanupUnverifiedUsers() {
  console.log("server.js: Running unverified user cleanup");
  try {
    //Defines unverified users older than 24 hours
    const unverifiedUsers = db.prepare(`
      SELECT uEmail FROM UserData
      WHERE verified = 0
      AND created_at < datetime('now', '-24 hours')
    `).all();

    //Basic for loop that traverse userData table to find unverified users
    //Not final, needs to be reviewed at later point (might be bad given larger user base)
    for (const user of unverifiedUsers) {
      const email = user.uEmail;
      try {
        //Delete from cognito first (may already be gone, so ignore errors)
        await deleteCognitoUserByEmail(email);
      } catch (cognitoErr) {
        //User may not exist in cognito anymore
        console.log(`server.js: Cognito delete skipped for ${email}: ${cognitoErr.message}`);
      }

      //Also deletes unverified users from sqlite
      db.prepare("DELETE FROM UserData WHERE uEmail = ?").run(email);
      console.log(`server.js: Cleaned up unverified user: ${email}`);
    }

    console.log(`server.js: Cleanup complete. Removed ${unverifiedUsers.length} unverified user(s).`);
  } catch (err) {
    console.error("server.js: Cleanup job error:", err);
  }
}

//Run cleanup immediately on startup, then every hour
cleanupUnverifiedUsers();
setInterval(cleanupUnverifiedUsers, CLEANUP_INTERVAL_MS);

//Runs on port 5000, can be updated as needed
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
