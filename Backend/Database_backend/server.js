import express from "express";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import cors from "cors";
import pkg from "aws-sdk";
const { CognitoIdentityServiceProvider, config: awsConfig } = pkg;

//AWS credentials, add these to your .env file if they're not there already
awsConfig.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: "us-east-1",
});

/*
BUGS NEED FIXING:
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

//MySQL pool, injects connection info from .env file to establish connection
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
});

const cognito = new CognitoIdentityServiceProvider({ region: "us-east-1" });
const USER_POOL_ID = "us-east-1_F6PXA7rXB";

//Used for testing if RDS connection is successful
(async () => {
  try {
    const conn = await db.getConnection();
    console.log("Connected to RDS MySQL");

    //Add verified and created_at columns if they don't already exist (in case errors, since verified  is must)
    await conn.execute(`
      ALTER TABLE UserData
        ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    `);
    console.log("UserData table ready with verified and created_at columns");

    conn.release();
  } catch (err) {
    console.error("RDS connection failed:", err);
  }
})();

//Used for testing if backend server is online
app.get("/", (req, res) => {
  res.send("Backend server is running");
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
      return res.status(400).json({ message: "Email already exists" });
    }
    return res.status(500).json({ message: "User register error" });
  }
});

//Login API, only allows verified users to log in
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const [rows] = await db.execute(
    "SELECT * FROM UserData WHERE uEmail=? AND uPassword=?",
    [email, password]
  );

  if (rows.length > 0) {
    //Block unverified users from logging in
    if (!rows[0].verified) {
      return res.json({ success: false, message: "Please verify your email before logging in." });
    }
    res.json({ success: true, username: rows[0].uName, email: rows[0].uEmail });
  } else {
    res.json({ success: false, message: "Invalid email or password" });
  }
});

//Called after Cognito email verification, marks user as verified in RDS
//then deletes them from Cognito so RDS is the only user store
app.post("/verify-complete", async (req, res) => {
  console.log("verify-complete hit with:", req.body)
  const { email } = req.body;
  try {
    // Mark as verified in RDS
    await db.execute(
      "UPDATE UserData SET verified = TRUE WHERE uEmail = ?",
      [email]
    );

    //Delete from cognito, RDS holds data so no phantoms in cognito
    try {
      await cognito.adminDeleteUser({
        UserPoolId: USER_POOL_ID,
        Username: email,
      }).promise();
    } catch (cognitoErr) {
      //Log but don't fail, user is already verified in RDS
      console.error("Cognito delete error (non-fatal):", cognitoErr.message);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("verify-complete error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

//Fallback delete endpoint (kept for manual use if needed)
app.post("/delete-cognito-user", async (req, res) => {
  const { email } = req.body;
  try {
    await cognito.adminDeleteUser({
      UserPoolId: USER_POOL_ID,
      Username: email,
    }).promise();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

//Cleanup job, runs every 24 hours
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; 

async function cleanupUnverifiedUsers() {
  console.log("Running unverified user cleanup...");
  try {
    //Find all unverified users older than 24 hours and execute 
    const [unverifiedUsers] = await db.execute(`
      SELECT uEmail FROM UserData
      WHERE verified = FALSE
      AND created_at < NOW() - INTERVAL 24 HOUR
    `);

    for (const user of unverifiedUsers) {
      const email = user.uEmail;
      try {
        //Delete from cognito first (may already be gone, so ignore errors)
        await cognito.adminDeleteUser({
          UserPoolId: USER_POOL_ID,
          Username: email,
        }).promise();
      } catch (cognitoErr) {
        //User may not exist in cognito anymore 
        console.log(`Cognito delete skipped for ${email}: ${cognitoErr.message}`);
      }

      //Delete from RDS
      await db.execute("DELETE FROM UserData WHERE uEmail = ?", [email]);
      console.log(`Cleaned up unverified user: ${email}`);
    }

    console.log(`Cleanup complete. Removed ${unverifiedUsers.length} unverified user(s).`);
  } catch (err) {
    console.error("Cleanup job error:", err);
  }
}

//Run cleanup immediately on startup, then every 24 hours
cleanupUnverifiedUsers();
setInterval(cleanupUnverifiedUsers, CLEANUP_INTERVAL_MS);

//Runs on port 5000 (localhost 5000), can be updated as needed
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));