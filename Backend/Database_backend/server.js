import express from "express";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import cors from "cors";
import pkg from "aws-sdk";
const { CognitoIdentityServiceProvider, S3, config: awsConfig } = pkg;

//AWS credentials, add these to your .env file if they're not there already
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

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

//MySQL pool, injects connection info from .env file to establish connection with RDS instance
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
});

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

//Used for testing if RDS connection is successful
(async () => {
  try {
    const conn = await db.getConnection();
    console.log("Connected to RDS MySQL");

    //Add verified and created_at columns if they don't already exist 
    //(in case errors, since verified is must have for user form to function)
    await conn.execute(`
      ALTER TABLE UserData
        ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        ADD COLUMN IF NOT EXISTS avatarUrl VARCHAR(500) NULL DEFAULT NULL
    `);
    console.log("UserData table ready with verified, created_at, and avatarUrl columns");

    conn.release();
  } catch (err) {
    console.error("server.js: RDS connection failed:", err);
  }
})();

//Used for testing if backend server is online
app.get("/", (req, res) => {
  res.send("Backend server is running");
});

//UserSession API, saves user info into db after ending session 
//Note that avgFocus is set to 0, update when data could be fetched for it
app.post("/session", async (req, res) => {
  const { userId, sessionStart, sessionEnd } = req.body;
  try {
    await db.execute(
      "INSERT INTO UserSession (UserID, sessionStart, sessionEnd, avgFocus) VALUES (?, ?, ?, ?)",
      [userId, sessionStart, sessionEnd, 0]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Session insert error" });
  }
});

//Fetches 3 most recent sessions for a user (based on userID), used for homepage session snapshots
app.get("/sessions/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const [rows] = await db.execute(
      "SELECT sessionStart, sessionEnd FROM UserSession WHERE UserID = ? ORDER BY sessionStart DESC LIMIT 3",
      [userId]
    );
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
    await db.execute(
      "INSERT INTO UserData (uEmail, uName, uPassword, verified, created_at) VALUES (?, ?, ?, FALSE, NOW())",
      [email, username, password]
    );
    res.json({ message: "User registered" });
  } catch (err) {
    console.error(err);
    //This would also trigger if cognito doesn't delete its copy of user 
    if (err.code === "ER_DUP_ENTRY" || err.errno === 1062) {
      return res.status(400).json({ message: "server.js: Email already exists" });
    }
    return res.status(500).json({ message: "server.js: User register error" });
  }
});

//Rolls back an rds insert if cognitoSignUp fails after /register succeeds,
//prevents the email from being permanently locked out(rds side) until cleanup runs
//basically removes the unverified user that was inserted into RDS if cognito sign up fails
app.delete("/register-rollback", async (req, res) => {
  const { email } = req.body;
  try {
    await db.execute(
      "DELETE FROM UserData WHERE uEmail = ? AND verified = FALSE",
      [email]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("server.js: register-rollback error:", err);
    res.status(500).json({ success: false, message: "Rollback failed" });
  }
});

//Login API, only allows verified users to log in
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const [rows] = await db.execute(
    "SELECT * FROM UserData WHERE uEmail=? AND uPassword=?",
    [email, password]
  );

  //row>0 means user already exist 
  if (rows.length > 0) {
    //Block unverified users from logging in
    if (!rows[0].verified) {
      return res.json({ success: false, message: "Please verify your email before logging in." });
    }
    //note that since user info are unique, rows[0] is the only row,
    //and it represents said users info 
    res.json({ success: true,
               username: rows[0].uName,
               email: rows[0].uEmail,
               userId: rows[0].UserID,
               avatarUrl: rows[0].avatarUrl ?? null });
  } else {
    res.json({ success: false, message: "server.js: Invalid email or password" });
  }
});

//Updates username in mysql
app.put("/user/username", async (req, res) => {
  const { userId, newUsername } = req.body;
  try {
    await db.execute(
      "UPDATE UserData SET uName = ? WHERE UserID = ?",
      [newUsername, userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to update username" });
  }
});

//Updates password in mysql
app.put("/user/password", async (req, res) => {
  const { userId, currentPassword, newPassword } = req.body;
  try {
    //Verify current password matches before password update
    const [rows] = await db.execute(
      "SELECT * FROM UserData WHERE UserID = ? AND uPassword = ?",
      [userId, currentPassword]
    );
    if (rows.length === 0) {
      return res.json({ success: false, message: "Current password incorrect" });
    }
    await db.execute(
      "UPDATE UserData SET uPassword = ? WHERE UserID = ?",
      [newPassword, userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to update password" });
  }
});

//Check if email is already taken in rds before creating a cognito user,
//prevents phantom users from being created for duplicate emails
//differs from /user/email in that this is ran in profile.tsx before cognitoSignUp
app.get("/check-email", async (req, res) => {
  const { email } = req.query;
  try {
    const [rows] = await db.execute(
      "SELECT UserID FROM UserData WHERE uEmail = ?",
      [email]
    );
    res.json({ available: rows.length === 0 });
  } catch (err) {
    console.error("server.js: check-email error:", err);
    res.status(500).json({ available: false, message: "Check failed" });
  }
});

//Updates email in sql, checks for duplicate email first
//Deletes cognito temp user after verification same as register flow
//this runs after cognito verification is complete 
app.put("/user/email", async (req, res) => {
  const { userId, newEmail } = req.body;
  try {
    //Check if new email already exists
    //mostly for race condition edge case between two users 
    const [existing] = await db.execute(
      "SELECT * FROM UserData WHERE uEmail = ?",
      [newEmail]
    );
    if (existing.length > 0) {
      return res.json({ success: false, message: "Email in use" });
    }

    //Update email in sql
    await db.execute(
      "UPDATE UserData SET uEmail = ? WHERE UserID = ?",
      [newEmail, userId]
    );

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

//Called after Cognito email verification, marks user as verified in RDS
//then deletes temp user from Cognito so RDS is the only instance to store user info
app.post("/verify-complete", async (req, res) => {
  console.log("verify-complete hit with:", req.body)
  const { email } = req.body;
  try {
    //Mark user as verified in RDS
    await db.execute(
      "UPDATE UserData SET verified = TRUE WHERE uEmail = ?",
      [email]
    );

    //Delete from cognito, RDS holds data so no phantoms in cognito
    try {
      await deleteCognitoUserByEmail(email);
    } catch (cognitoErr) {
      //Log but don't fail, user is already verified in RDS
      //this error just means that if user gets deleted from RDS instance, creates a phantom user in cognito
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

//Saves the S3 public URL to the user's profile in mysql
app.put("/user/avatar", async (req, res) => {
  const { userId, avatarUrl } = req.body;
  try {
    await db.execute(
      "UPDATE UserData SET avatarUrl = ? WHERE UserID = ?",
      [avatarUrl, userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to save avatar URL" });
  }
});

//Cleanup job, runs every 24 hours
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
    const [unverifiedUsers] = await db.execute(`
      SELECT uEmail FROM UserData
      WHERE verified = FALSE
      AND created_at < NOW() - INTERVAL 24 HOUR
    `);

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

      //Also deletes unverified users from RDS
      await db.execute("DELETE FROM UserData WHERE uEmail = ?", [email]);
      console.log(`server.js: Cleaned up unverified user: ${email}`);
    }

    console.log(`server.js: Cleanup complete. Removed ${unverifiedUsers.length} unverified user(s).`);
  } catch (err) {
    console.error("server.js: Cleanup job error:", err);
  }
}

//Run cleanup immediately on startup, then every 24 hours
cleanupUnverifiedUsers();
setInterval(cleanupUnverifiedUsers, CLEANUP_INTERVAL_MS);

//Runs on port 5000, can be updated as needed
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));