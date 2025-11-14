/*
=====================================================
    CAREER PLATFORM - BACKEND SERVER (server.js)
=====================================================
    This file handles all API logic:
    - User Authentication (Req 1)
    - Profile Management (Req 2)
    - Job & Resource Fetching (Req 3, 4)
    - Smart Matching (Req 5, Req 2.Part2, Req 3.Part2)
*/

// --- 1. Import All Our Tools ---
const express = require("express");
const mysql = require("mysql2");
const bodyParser = require("body-parser"); // Note: Corrected typo from earlier
const cors = require("cors");
const bcrypt = require("bcryptjs"); // For password hashing
const jwt = require("jsonwebtoken"); // For "login" tokens

// --- 2. Create the App & Connect to DB ---
const app = express();
app.use(cors()); // Allow frontend to talk to us
app.use(bodyParser.json()); // Allow server to read JSON data

// This is the "phone" to your XAMPP database
const db = mysql.createConnection({
  host: "localhost",
  user: "root", // Default XAMPP username
  password: "", // Default XAMPP password
  database: "hackathon_db",
});

db.connect((err) => {
  if (err) {
    console.error("Error connecting to database:", err);
    return;
  }
  console.log("Connected to MySQL database!");
});

// --- 3. Define a "Secret Key" for tokens ---
// This key proves that *we* are the ones who created a login token
const JWT_SECRET = "your-super-secret-key-for-the-hackathon-part-2";

// --- 4. "Middleware" (Our "Security Guard") ---
// This function checks if a user is logged in before giving them access
const authenticateToken = (req, res, next) => {
  // Get the "key card" (token) from the request
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Format is "Bearer TOKEN"

  if (token == null) {
    return res.sendStatus(401); // 401 = Unauthorized (No token)
  }

  // Check if the "key card" is valid
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.sendStatus(403); // 403 = Forbidden (Token is invalid)
    }
    // It's a valid token. Attach the user's info to the request
    req.user = user;
    next(); // Let the user proceed
  });
};

// --- 5. API Endpoints (The "Brain's" Thoughts) ---

/*
 * Req 1: User Registration
 */
app.post("/register", async (req, res) => {
  try {
    const { fullName, email, password, education, experience, track } =
      req.body;

    // Validation (Req 1b)
    if (!fullName || !email || !password) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    // Hash the password (so we don't store the real one)
    const password_hash = await bcrypt.hash(password, 10);

    // Store in DB (Req 1c)
    const sql =
      "INSERT INTO users (full_name, email, password_hash, education_level, experience_level, career_track, skills) VALUES (?, ?, ?, ?, ?, ?, ?)";

    db.query(
      sql,
      [fullName, email, password_hash, education, experience, track, ""],
      (err, result) => {
        if (err) {
          console.error(err);
          return res
            .status(500)
            .json({ message: "Email may already be in use" });
        }
        res.status(201).json({ message: "User registered successfully!" });
      }
    );
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

/*
 * Req 1: User Login
 */
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  const sql = "SELECT * FROM users WHERE email = ?";
  db.query(sql, [email], async (err, results) => {
    if (err) return res.status(500).json({ message: "Server error" });

    // 1. Check if user exists
    if (results.length === 0) {
      return res.status(400).json({ message: "Invalid email or password" });
    }
    const user = results[0];

    // 2. Check if password matches
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // 3. Create a login token (the "key card")
    const token = jwt.sign(
      { userId: user.id, email: user.email }, // This is the data *inside* the token
      JWT_SECRET, // This is the secret key
      { expiresIn: "1h" } // It expires in 1 hour
    );

    // 4. Send the token to the frontend
    res.json({ message: "Login successful!", token: token });
  });
});

/*
 * Req 6 & 5 & 2.Part2 & 3.Part2: Dashboard (The "Smart" Endpoint)
 * This is a PROTECTED route (requires login)
 */
app.get("/dashboard", authenticateToken, async (req, res) => {
  const userId = req.user.userId;

  try {
    // 1. Get User, Jobs, and Resources all at once
    const [userRows] = await db
      .promise()
      .query(
        "SELECT full_name, email, career_track, skills FROM users WHERE id = ?",
        [userId]
      );
    const [jobRows] = await db.promise().query("SELECT * FROM jobs");
    const [resourceRows] = await db.promise().query("SELECT * FROM resources");

    if (userRows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = {
      name: userRows[0].full_name,
      email: userRows[0].email,
      track: userRows[0].career_track,
      skills: (userRows[0].skills || "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s),
    };

    // 2. Calculate "Smart" Matches (Req 5 & 2.Part2)
    const recommendedJobs = jobRows
      .map(
        (job) => calculateMatch(job, user, resourceRows) // NEW: Pass resources for skill gap
      )
      .filter((job) => job.matchPercent > 0) // Only recommend jobs with some match
      .sort((a, b) => b.matchPercent - a.matchPercent); // Sort by best match

    // 3. Recommend Resources (Req 5)
    const recommendedResources = resourceRows
      .map((resource) => {
        const { matches } = getMatches(user.skills, resource.related_skills);
        return {
          ...resource,
          matchCount: matches.length,
        };
      })
      .filter((res) => res.matchCount > 0)
      .sort((a, b) => b.matchCount - a.matchCount);

    // 4. Send all data to dashboard
    res.json({
      user: user,
      jobs: recommendedJobs.slice(0, 5), // Send top 5 job recommendations
      resources: recommendedResources.slice(0, 5), // Send top 5 resource recommendations
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/*
 * Req 2: User Profile (Get & Update)
 * PROTECTED routes
 */
// GET data to fill the profile page
app.get("/profile", authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const sql =
    "SELECT full_name, email, education_level, experience_level, career_track, skills, experience_notes, target_roles, cv_text FROM users WHERE id = ?";

  db.query(sql, [userId], (err, results) => {
    if (err) return res.status(500).json({ message: "Server error" });
    if (results.length === 0)
      return res.status(404).json({ message: "User not found" });
    res.json(results[0]);
  });
});

// POST new data to save the profile page
app.post("/profile", authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const {
    fullName,
    education,
    level,
    track,
    roles, // from details form
    skills,
    experience, // from skills form
    cv_text, // from cv form
  } = req.body;

  const sql = `
        UPDATE users SET 
            full_name = ?, education_level = ?, experience_level = ?, 
            career_track = ?, target_roles = ?, skills = ?, 
            experience_notes = ?, cv_text = ?
        WHERE id = ?
    `;

  db.query(
    sql,
    [
      fullName,
      education,
      level,
      track,
      roles,
      skills,
      experience,
      cv_text,
      userId,
    ],
    (err, result) => {
      if (err) {
        console.error("Profile save error:", err);
        return res.status(500).json({ message: "Failed to update profile" });
      }
      res.json({ message: "Profile updated successfully!" });
    }
  );
});

/*
 * Req 3: Jobs Page
 * PROTECTED route (so we can show match scores)
 */
app.get("/jobs", authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { title, location, type } = req.query;

  try {
    // 1. Get User and Resources (for matching)
    const [userRows] = await db
      .promise()
      .query("SELECT skills FROM users WHERE id = ?", [userId]);
    const [resourceRows] = await db.promise().query("SELECT * FROM resources");

    const user = {
      skills: (userRows[0].skills || "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s),
    };

    // 2. Build Job Query with Filters
    let sql = "SELECT * FROM jobs WHERE 1=1"; // Start with a "true" statement
    const params = [];

    if (title) {
      sql += " AND job_title LIKE ?";
      params.push(`%${title}%`); // % is a wildcard for "anything"
    }
    if (location) {
      sql += " AND location = ?";
      params.push(location);
    }
    if (type) {
      sql += " AND job_type = ?";
      params.push(type);
    }

    // 3. Get Filtered Jobs
    const [jobRows] = await db.promise().query(sql, params);

    // 4. Calculate "Smart" Matches for all filtered jobs
    const jobsWithMatch = jobRows
      .map(
        (job) => calculateMatch(job, user, resourceRows) // Pass resources for skill gap
      )
      .sort((a, b) => b.matchPercent - a.matchPercent); // Sort by best match

    res.json(jobsWithMatch);
  } catch (err) {
    console.error("Jobs page error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/*
 * Req 4: Resources Page
 * PUBLIC route (no login needed)
 */
app.get("/resources", (req, res) => {
  db.query("SELECT * FROM resources", (err, results) => {
    if (err) return res.status(500).json({ message: "Server error" });
    res.json(results);
  });
});

// --- 6. Helper Functions ---

/**
 * (Req 5) Simple skill match (used for resources)
 * @param {string[]} userSkills - e.g., ['js', 'react']
 * @param {string} requiredSkillsCsv - e.g., "React,Node.js"
 * @returns {object} - { matches: ['react'], matchCount: 1 }
 */
function getMatches(userSkills, requiredSkillsCsv) {
  if (!requiredSkillsCsv) return { matches: [], matchCount: 0 };

  const required = requiredSkillsCsv
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s);
  const matches = required.filter((skill) => userSkills.includes(skill));

  return {
    matches: matches,
    matchCount: matches.length,
  };
}

/**
 * (Req 2.Part2 & 3.Part2) The "Smart" Match Calculator
 * This is the new, upgraded function!
 * @param {object} job - The job object from the DB
 * @param {object} user - The user object { skills: [...] }
 * @param {array} allResources - The complete list of all resources
 * @returns {object} - The job with new "matchPercent", "matches", "missing", "recommendedResources"
 */
function calculateMatch(job, user, allResources) {
  const userSkills = user.skills;
  const jobSkills = (job.required_skills || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s); // ['js', 'react', 'redux']

  if (jobSkills.length === 0) {
    // If job has no skills, it's a 0% match (or 100%? Let's say 0%)
    return {
      ...job,
      matchPercent: 0,
      matches: [],
      missing: [],
      recommendedResources: [],
    };
  }

  const matches = jobSkills.filter((skill) => userSkills.includes(skill));
  const missing = jobSkills.filter((skill) => !userSkills.includes(skill));

  const matchPercent = Math.round((matches.length / jobSkills.length) * 100);

  // (Req 3.Part2) Find resources for the missing skills
  let recommendedResources = [];
  if (missing.length > 0) {
    // This is a bit slow, but ok for a hackathon
    recommendedResources = allResources.filter((res) => {
      const resourceSkills = (res.related_skills || "")
        .split(",")
        .map((s) => s.trim().toLowerCase());
      // Does any missing skill appear in this resource's skills?
      return missing.some((missingSkill) =>
        resourceSkills.includes(missingSkill)
      );
    });
  }

  return {
    ...job,
    matchPercent: matchPercent, // e.g., 66
    matches: matches, // e.g., ['js', 'react']
    missing: missing, // e.g., ['redux']
    recommendedResources: recommendedResources.slice(0, 2), // Max 2 recommendations
  };
}
console.log("New, smarter calculateMatch function is ready!");

// --- 7. Start the Server ---
const PORT = 3001; // We use 3001 because 3000 is common for React
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
