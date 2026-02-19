import express from "express";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import cors from "cors";

/*
BUGS NEED FIXING:

rn when registering for account, dupe emails are not allowed,
so if you spam register with the same email, a new account will not be made,
BUT, UserID still gets incremented, resulting in incosistency between # of users and userIDs

*/

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// MySQL pool, injects connection info from .env file to establish connection
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT
});

// Used for testing if RDS connection is successful
(async () => {
  try {
    const conn = await db.getConnection();
    console.log("Connected to RDS MySQL");
    conn.release();
  } catch (err) {
    console.error("RDS connection failed:", err);
  }
})();

// Used for testing if backend server is online
app.get("/", (req, res) => {
  res.send("Backend server is running");
});

// Register API
app.post("/register", async (req, res) => {
  const { email, username, password } = req.body;
  try {
    await db.execute(
      "INSERT INTO UserData (uEmail, uName, uPassword) VALUES (?, ?, ?)",
      [email, username, password]
    );
    res.json({ message: "User registered" });
  } catch (err) {
    console.error(err);
    if (err.code === "ER_DUP_ENTRY" || err.errno === 1062) {
      return res.status(400).json({ message: "Email already exists" });
    }

    return res.status(500).json({ message: "User register error" });
  }
});

// Login API
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const [rows] = await db.execute(
    "SELECT * FROM UserData WHERE uName=? AND uPassword=?",
    [username, password]
  );

  // row exists if user exists hence (row.length > 0)
  if (rows.length > 0) {
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

// rn runs on port 5000 (localhost 5000), can be updated as needed
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
