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
const bodyParser = require("body-parser");
const cors = require("cors");
const bcrypt = require("bcryptjs"); // For password hashing
const jwt = require("jsonwebtoken"); // For "login" tokens
const fetch = require("node-fetch");
// Define the AI constant
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=";
const GEMINI_API_KEY = "AIzaSyD0RA3MsTWLFJnk89xnfgidk_B5H2cKlQ4"; // Leave this blank

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

  // --- THIS IS THE FIX ---

  // 1. The query string
  const sql = `
    UPDATE users SET 
        full_name = ?, 
        education_level = ?, 
        experience_level = ?, 
        career_track = ?, 
        target_roles = ?, 
        skills = ?, 
        experience_notes = ?, 
        cv_text = ?
    WHERE id = ?
`;
  // 2. The parameters, in the correct order
  const params = [
    fullName,
    education, // Goes into education_level
    level, // Goes into experience_level
    track,
    roles,
    skills,
    experience, // Goes into experience_notes
    cv_text,
    userId, // Goes into WHERE id = ?
  ];

  // 3. The query
  db.query(sql, params, (err, result) => {
    if (err) {
      // This will now log the real error to your terminal
      console.error("Profile save error:", err);
      return res.status(500).json({ message: "Failed to update profile" });
    }
    // It will only show success if the query actually worked
    res.json({ message: "Profile updated successfully!" });
  });
  // --- END OF FIX ---
});

//// new injected by me
/*
 * Req 1.Part2: AI Skill Extraction (Heuristic Method)
 * This route uses our *own* internal dictionary to find skills. No API key needed.
 */
app.post("/profile/analyze-cv", authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { cv_text } = req.body;

  if (!cv_text || cv_text.trim() === "") {
    return res.status(400).json({ message: "CV text is empty." });
  }

  try {
    // Call our new *internal* helper function
    const aiResponse = findSkillsInCV(cv_text);

    // Update the user's profile in the database with the new skills
    // We only update skills, as this method can't guess roles.
    const sql = "UPDATE users SET skills = ? WHERE id = ?";
    db.query(sql, [aiResponse.skills, userId], (err, result) => {
      if (err) {
        console.error("DB update error after AI analysis:", err);
        return res.status(500).json({ message: "Failed to save new skills." });
      }

      // Send the new skills back to the frontend
      res.json({
        message: "CV Analyzed successfully!",
        skills: aiResponse.skills,
        roles: "", // This method doesn't find roles, so we send an empty string
      });
    });
  } catch (err) {
    console.error("Skill Analysis Error:", err.message);
    res
      .status(500)
      .json({ message: "Failed to analyze CV", error: err.message });
  }
});

/*
 * Req 3: Jobs Page (Protected)
 * This is for LOGGED-IN users
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
 * Req 3: Jobs Page (Public) - NEW
 * This is for LOGGED-OUT users
 */
app.get("/public-jobs", async (req, res) => {
  const { title, location, type } = req.query;

  try {
    // Build Job Query with Filters
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

    // Get Filtered Jobs
    const [jobRows] = await db.promise().query(sql, params);

    // We send the jobs back *without* match scores
    res.json(jobRows);
  } catch (err) {
    console.error("Public jobs page error:", err);
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
/*
 * Req 4: AI-Generated Career Roadmap (Mandatory)
 */
app.post("/roadmap", authenticateToken, async (req, res) => {
  const { targetRole, timeframe, currentSkills } = req.body;

  if (!targetRole || !timeframe) {
    return res
      .status(400)
      .json({ message: "Target role and timeframe are required." });
  }

  try {
    // Call the AI helper function
    const roadmapText = await generateRoadmap(
      targetRole,
      timeframe,
      currentSkills
    );

    // Send the raw text back to the frontend
    res.json({ roadmap: roadmapText, message: "Roadmap created." });
  } catch (err) {
    console.error("Roadmap Error:", err);
    res
      .status(500)
      .json({ message: "Failed to generate roadmap due to AI service error." });
  }
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
    // If job has no skills, it's a 0% match
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

////also injected by me
// --- 7. AI Helper Function ---
/**
 * (Req 4) Calls the Gemini AI to generate a structured career roadmap.
 * @returns {string} - The generated roadmap text.
 */
async function generateRoadmap(targetRole, timeframe, currentSkills) {
  const userPrompt = `
    Your goal is to create a detailed, personalized career roadmap.

    **User Details:**
    - **Current Skills:** ${currentSkills}
    - **Target Role:** ${targetRole}
    - **Timeframe:** ${timeframe}

    **Instructions:**
    1. **MUST** create a plan divided into phases (e.g., Month 1, Phase 2).
    2. **MUST** use clear, formatted markdown (use bold, lists, and headers).
    3. For each phase, include **Specific Topics/Technologies**, **Simple Project Ideas**, and a **Go/No-Go Checkpoint**.
    4. Include a suggested time point (e.g., "End of Month 3") for the user to **Start Applying for Internships/Jobs**.
    5. The tone should be encouraging and professional.
    `;

  const payload = {
    contents: [{ parts: [{ text: userPrompt }] }],
  };

  const response = await fetch(GEMINI_API_URL + GEMINI_API_KEY, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Gemini Roadmap API Error:", response.status, errorText);
    throw new Error(`AI service failed with status ${response.status}.`);
  }

  const result = await response.json();

  if (result.candidates && result.candidates[0].content.parts[0].text) {
    return result.candidates[0].content.parts[0].text;
  } else {
    console.error("Gemini Roadmap API returned unexpected structure:", result);
    throw new Error("AI returned an empty or malformed response.");
  }
}
/**
 * (Req 1.Part2) Finds skills in CV using a keyword dictionary.
 * This is the "heuristic" method. No API key needed.
 * @param {string} cvText - The raw CV text from the user
 * @returns {object} - { skills: "..." }
 */

function findSkillsInCV(cvText) {
  // Our "Dictionary" of skills.
  // We can add hundreds of words here!
  const SKILL_DICTIONARY = [
    // Languages
    "javascript",
    "python",
    "java",
    "c#",
    "c++",
    "php",
    "sql",
    "html",
    "css",
    "typescript",
    // Frameworks & Libraries
    "react",
    "node.js",
    "express.js",
    "angular",
    "vue.js",
    "django",
    "flask",
    "spring",
    ".net",
    "laravel",
    "jest",
    "tailwind css",
    "bootstrap",
    "jquery",
    "d3.js",
    "chart.js",
    // Databases
    "mysql",
    "mongodb",
    "firebase",
    "postgresql",
    "ms sql",
    // Tools & Platforms
    "git",
    "github",
    "docker",
    "figma",
    "vs code",
    "heroku",
    "aws",
    "azure",
    "google cloud",
    // Soft Skills & Methods
    "agile",
    "scrum",
    "teamwork",
    "communication",
    "problem-solving",
    "creative thinking",
    "time management",
    "leadership",
    "data analysis",
    "machine learning",
    // Add more skills as needed!
  ];

  // 1. Clean the CV text
  // Convert to lowercase and add spaces around symbols to separate words
  const cleanText = cvText.toLowerCase().replace(/[/(),]/g, " ");

  // 2. Find matches
  const foundSkills = [];
  // Inside findSkillsInCV, use a simpler search method:
  for (const skill of SKILL_DICTIONARY) {
    // This is safer: it checks if the CV text *includes* the skill string.
    if (cleanText.includes(skill)) {
      foundSkills.push(skill);
    }
  }

  // 3. Remove duplicates and join into a string
  const uniqueSkills = [...new Set(foundSkills)];

  return {
    skills: uniqueSkills.join(", "), // e.g., "javascript, react, node.js, teamwork"
    roles: "", // This simple method can't guess roles, so we leave it blank.
  };
}

console.log("New, smarter calculateMatch function is ready!");

// --- 7. Start the Server ---
const PORT = 3001; // We use 3001 because 3000 is common for React
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
