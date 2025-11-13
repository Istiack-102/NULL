// --- 1. Import Tools ---
const express = require("express");
const mysql = require("mysql2/promise"); // Use promise-based version for async/await
const cors = require("cors");
const bcrypt = require("bcryptjs"); // For scrambling passwords
const jwt = require("jsonwebtoken"); // For "login tokens"

// --- 2. Create App & Connect to DB ---
const app = express();
app.use(cors()); // Allow our frontend to talk to this backend
app.use(express.json({ limit: "10mb" })); // Allow server to read JSON data, increase limit for CV text

// This is the "phone line" to your XAMPP database
// We use a "pool" for better connection management
const db = mysql.createPool({
  host: "localhost",
  user: "root", // Default XAMPP username
  password: "", // Default XAMPP password
  database: "hackathon_db", // The DB we created
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Test connection
db.getConnection()
  .then((conn) => {
    console.log("Connected to MySQL database!");
    conn.release(); // release connection
  })
  .catch((err) => {
    console.error("Error connecting to database:", err);
  });

// This is a secret key for creating secure login tokens.
const JWT_SECRET = "your-super-secret-key-12345";

// --- 3. Middleware (Token Security Guard) ---

// This function checks for a valid token
const authMiddleware = (req, res, next) => {
  // Get token from the 'Authorization' header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ message: "No token provided, authorization denied." });
  }

  try {
    const token = authHeader.split(" ")[1]; // Get token after 'Bearer '
    const decoded = jwt.verify(token, JWT_SECRET); // Check if token is valid
    req.user = decoded; // Add user info (e.g., userId) to the request
    next(); // Proceed to the protected route
  } catch (err) {
    res.status(401).json({ message: "Token is not valid." });
  }
};

// --- 4. API Routes (The "Brain's" Functions) ---

/*
 * Req 6 & 5: Dashboard & Matching Logic
 * This is a "protected" route, so we add authMiddleware
 */
app.get("/dashboard", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    // 1. Get User Data
    const [userRows] = await db.query(
      "SELECT full_name, email, career_track, skills FROM users WHERE id = ?",
      [userId]
    );
    if (userRows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    const user = userRows[0];
    const userSkills = (user.skills || "")
      .toLowerCase()
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    // 2. Get Jobs and apply matching
    const [jobs] = await db.query("SELECT * FROM jobs");
    const recommendedJobs = jobs
      .map((job) => {
        const jobSkills = (job.required_skills || "")
          .toLowerCase()
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        const matches = getMatches(userSkills, jobSkills);
        return { ...job, matches, matchCount: matches.length };
      })
      .filter((job) => job.matchCount > 0) // Only keep jobs with at least one match
      .sort((a, b) => b.matchCount - a.matchCount); // Sort by best match

    // 3. Get Resources and apply matching
    const [resources] = await db.query("SELECT * FROM resources");
    const recommendedResources = resources
      .map((res) => {
        const resSkills = (res.related_skills || "")
          .toLowerCase()
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        const matches = getMatches(userSkills, resSkills);
        return { ...res, matches, matchCount: matches.length };
      })
      .filter((res) => res.matchCount > 0)
      .sort((a, b) => b.matchCount - a.matchCount);

    // 4. Send all data to frontend
    res.json({
      user: userRows[0],
      recommendedJobs: recommendedJobs.slice(0, 5), // Send top 5
      recommendedResources: recommendedResources.slice(0, 5), // Send top 5
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/*
 * Req 2: Profile Page (Get and Update)
 */
// GET Profile (Protected)
app.get("/profile", authMiddleware, async (req, res) => {
  try {
    const [userRows] = await db.query(
      "SELECT full_name, email, education_level, experience_level, career_track, skills, experience_notes, target_roles, cv_text FROM users WHERE id = ?",
      [req.user.userId]
    );
    if (userRows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(userRows[0]);
  } catch (err) {
    console.error("Get profile error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST Profile (Protected)
app.post("/profile", authMiddleware, async (req, res) => {
  try {
    const { details, skills, cv } = req.body; // We'll update in 3 parts
    const userId = req.user.userId;

    if (details) {
      const { name, education, level, track, roles } = details;
      await db.query(
        "UPDATE users SET full_name = ?, education_level = ?, experience_level = ?, career_track = ?, target_roles = ? WHERE id = ?",
        [name, education, level, track, roles, userId]
      );
    }
    if (skills) {
      const { skillsList, experience } = skills;
      await db.query(
        "UPDATE users SET skills = ?, experience_notes = ? WHERE id = ?",
        [skillsList, experience, userId]
      );
    }
    if (cv) {
      await db.query("UPDATE users SET cv_text = ? WHERE id = ?", [
        cv.text,
        userId,
      ]);
    }

    res.json({ message: "Profile updated successfully!" });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/*
 * Req 3 & 4: Public Job and Resource Pages (No auth needed)
 */
app.get("/jobs", async (req, res) => {
  try {
    // We add search query filters here (Req 3b)
    const { title, location, type } = req.query;

    let sql = "SELECT * FROM jobs WHERE 1=1";
    const params = [];

    if (title) {
      sql += " AND job_title LIKE ?";
      params.push(`%${title}%`);
    }
    if (location) {
      sql += " AND location = ?";
      params.push(location);
    }
    if (type) {
      sql += " AND job_type = ?";
      params.push(type);
    }

    const [jobs] = await db.query(sql, params);
    res.json(jobs);
  } catch (err) {
    console.error("Get jobs error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/resources", async (req, res) => {
  try {
    const [resources] = await db.query("SELECT * FROM resources");
    res.json(resources);
  } catch (err) {
    console.error("Get resources error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/*
 * Req 5: Matching Logic Helper
 * This is a simple helper function, not an API route
 */
function getMatches(userSkills, entitySkills) {
  if (!userSkills || !entitySkills) return [];
  // Find skills that are in both arrays
  return userSkills.filter((skill) => entitySkills.includes(skill));
}

/*
 * Req 1: User Registration
 */
app.post("/register", async (req, res) => {
  // (This code is the same as before, but uses the 'db' pool)
  try {
    const { fullName, email, password, education, experience, track } =
      req.body;
    if (!fullName || !email || !password)
      return res.status(400).json({ message: "Missing required fields" });
    if (password.length < 6)
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });

    const [existing] = await db.query(
      "SELECT email FROM users WHERE email = ?",
      [email]
    );
    if (existing.length > 0) {
      return res.status(400).json({ message: "Email already in use" });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const sql =
      "INSERT INTO users (full_name, email, password_hash, education_level, experience_level, career_track) VALUES (?, ?, ?, ?, ?, ?)";
    await db.query(sql, [
      fullName,
      email,
      password_hash,
      education,
      experience,
      track,
    ]);

    res.status(201).json({ message: "User registered successfully!" });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/*
 * Req 1: User Login
 */
app.post("/login", async (req, res) => {
  // (This code is the same as before, but uses the 'db' pool)
  try {
    const { email, password } = req.body;
    const [results] = await db.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);

    if (results.length === 0) {
      return res.status(400).json({ message: "Invalid email or password" });
    }
    const user = results[0];

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "1h",
    });
    res.json({ message: "Login successful!", token: token });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// --- 5. Start the Server ---
const PORT = 3001; // We use 3001
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
