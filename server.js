/**
 * ============================================================
 * CAREER PLATFORM - BACKEND SERVER (server.js)
 * ============================================================
 * 1. Configuration & Setup (Imports, DB, Constants)
 * 2. Middleware (Auth, CORS, JSON)
 * 3. API Routes (Auth, Profile, Dashboard, Features)
 * 4. Helper Functions (AI Logic, Matching Logic)
 * 5. Server Start
 * ============================================================
 */

// ==========================================
// 1. CONFIGURATION & SETUP
// ==========================================

const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fetch = require("node-fetch");

// Constants
const PORT = 3001;
const JWT_SECRET = "your-super-secret-key-for-the-hackathon-part-2";
const GEMINI_API_KEY = "AIzaSyD0RA3MsTWLFJnk89xnfgidk_B5H2cKlQ4";
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=";

// App Initialization
const app = express();

// Database Connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "hackathon_db",
});

db.connect((err) => {
  if (err) {
    console.error("Error connecting to database:", err);
    return;
  }
  console.log("Connected to MySQL database!");
});

// ==========================================
// 2. MIDDLEWARE
// ==========================================

app.use(cors());
app.use(express.json()); // Replaces body-parser

/**
 * Authentication Middleware
 * Verifies JWT token for protected routes
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (token == null) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// ==========================================
// 3. API ROUTES
// ==========================================

// --- AUTHENTICATION ---

/*
 * Req 1: User Registration (DEBUG VERSION)
 */
app.post("/register", async (req, res) => {
  console.log("📥 Register Request Received!"); // 1. Did the request hit the server?
  console.log("📦 Data Received:", req.body); // 2. Is the data empty?

  try {
    const { fullName, email, password, education, experience, track } =
      req.body;

    // Check 1: Is data missing?
    if (!fullName || !email || !password) {
      console.log("❌ Missing Fields:", { fullName, email, password });
      return res
        .status(400)
        .json({ message: "Missing required fields (Check server console)" });
    }

    // Check 2: Password length
    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const sql =
      "INSERT INTO users (full_name, email, password_hash, education_level, experience_level, career_track, skills) VALUES (?, ?, ?, ?, ?, ?, ?)";

    db.query(
      sql,
      [fullName, email, password_hash, education, experience, track, ""],
      (err, result) => {
        if (err) {
          console.error("❌ Database Error:", err.message); // 3. Did SQL fail?
          return res
            .status(500)
            .json({ message: "Database error: " + err.message });
        }
        console.log("✅ User Registered ID:", result.insertId);
        res.status(201).json({ message: "User registered successfully!" });
      }
    );
  } catch (err) {
    console.error("❌ Server Crash:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;
  const sql = "SELECT * FROM users WHERE email = ?";

  db.query(sql, [email], async (err, results) => {
    if (err) return res.status(500).json({ message: "Server error" });
    if (results.length === 0)
      return res.status(400).json({ message: "Invalid email or password" });

    const user = results[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch)
      return res.status(400).json({ message: "Invalid email or password" });

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "1h",
    });
    res.json({ message: "Login successful!", token: token, role: user.role });
  });
});

// --- DASHBOARD & DATA ---

app.get("/dashboard", authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  try {
    const [userRows] = await db
      .promise()
      .query(
        "SELECT full_name, email, career_track, skills FROM users WHERE id = ?",
        [userId]
      );
    const [jobRows] = await db.promise().query("SELECT * FROM jobs");
    const [resourceRows] = await db.promise().query("SELECT * FROM resources");

    if (userRows.length === 0)
      return res.status(404).json({ message: "User not found" });

    const user = {
      name: userRows[0].full_name,
      email: userRows[0].email,
      track: userRows[0].career_track,
      skills: (userRows[0].skills || "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s),
    };

    const recommendedJobs = jobRows
      .map((job) => calculateMatch(job, user, resourceRows))
      .filter((job) => job.matchPercent > 0)
      .sort((a, b) => b.matchPercent - a.matchPercent);

    const recommendedResources = resourceRows
      .map((resource) => ({
        ...resource,
        matchCount: getMatches(user.skills, resource.related_skills).matches
          .length,
      }))
      .filter((res) => res.matchCount > 0)
      .sort((a, b) => b.matchCount - a.matchCount);

    res.json({
      user: user,
      jobs: recommendedJobs.slice(0, 5),
      resources: recommendedResources.slice(0, 5),
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// --- PROFILE MANAGEMENT ---

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

app.post("/profile", authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const {
    fullName,
    education,
    level,
    track,
    roles,
    skills,
    experience,
    cv_text,
  } = req.body;

  const sql = `UPDATE users SET full_name=?, education_level=?, experience_level=?, career_track=?, target_roles=?, skills=?, experience_notes=?, cv_text=? WHERE id=?`;
  const params = [
    fullName,
    education,
    level,
    track,
    roles,
    skills,
    experience,
    cv_text,
    userId,
  ];

  db.query(sql, params, (err, result) => {
    if (err) {
      console.error("Profile save error:", err);
      return res.status(500).json({ message: "Failed to update profile" });
    }
    res.json({ message: "Profile updated successfully!" });
  });
});

// --- JOBS & RESOURCES ---

app.get("/jobs", authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { title, location, type } = req.query;

  try {
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

    const [jobRows] = await db.promise().query(sql, params);
    const jobsWithMatch = jobRows
      .map((job) => calculateMatch(job, user, resourceRows))
      .sort((a, b) => b.matchPercent - a.matchPercent);

    res.json(jobsWithMatch);
  } catch (err) {
    console.error("Jobs page error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/public-jobs", async (req, res) => {
  const { title, location, type } = req.query;
  try {
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

    const [jobRows] = await db.promise().query(sql, params);
    res.json(jobRows);
  } catch (err) {
    console.error("Public jobs page error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/resources", (req, res) => {
  db.query("SELECT * FROM resources", (err, results) => {
    if (err) return res.status(500).json({ message: "Server error" });
    res.json(results);
  });
});

// --- AI FEATURES ---

// 1. CV Skill Extraction
app.post("/profile/analyze-cv", authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { cv_text } = req.body;

  if (!cv_text || cv_text.trim() === "")
    return res.status(400).json({ message: "CV text is empty." });

  try {
    const aiResponse = findSkillsInCV(cv_text);
    const sql = "UPDATE users SET skills = ? WHERE id = ?";
    db.query(sql, [aiResponse.skills, userId], (err, result) => {
      if (err) {
        console.error("DB update error:", err);
        return res.status(500).json({ message: "Failed to save new skills." });
      }
      res.json({
        message: "CV Analyzed successfully!",
        skills: aiResponse.skills,
        roles: "",
      });
    });
  } catch (err) {
    console.error("Skill Analysis Error:", err.message);
    res
      .status(500)
      .json({ message: "Failed to analyze CV", error: err.message });
  }
});

// 2. Career Roadmap
app.post("/roadmap", authenticateToken, async (req, res) => {
  const { targetRole, timeframe, currentSkills } = req.body;
  if (!targetRole || !timeframe)
    return res
      .status(400)
      .json({ message: "Target role and timeframe are required." });

  try {
    const roadmapText = await generateRoadmap(
      targetRole,
      timeframe,
      currentSkills
    );
    res.json({ roadmap: roadmapText, message: "Roadmap created." });
  } catch (err) {
    console.error("Roadmap Error:", err);
    res.status(500).json({ message: "Failed to generate roadmap." });
  }
});

// 3. Chatbot
app.post("/chatbot", authenticateToken, async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ message: "Query is required." });
  if (!GEMINI_API_KEY)
    return res.status(503).json({ message: "AI Service Unavailable." });

  try {
    const botResponse = await generateChatbotResponse(query);
    res.json({
      response: botResponse,
      disclaimer: "Note: AI-generated guidance.",
    });
  } catch (err) {
    console.error("Chatbot Error:", err);
    res.status(500).json({ message: "Failed to connect to mentor." });
  }
});

// 4. Summary Generator
app.post("/profile/summarize", authenticateToken, async (req, res) => {
  const { skills, experience } = req.body;
  if (!skills && !experience)
    return res.status(400).json({ message: "Skills or experience required." });
  if (!GEMINI_API_KEY)
    return res.status(503).json({ message: "AI Service Unavailable." });

  try {
    const summaryText = await generateSummary(skills, experience);
    res.json({ summary: summaryText, message: "Summary created." });
  } catch (err) {
    console.error("Summary Error:", err);
    res.status(500).json({ message: "Failed to connect to summary service." });
  }
});

// ==========================================
// 4. HELPER FUNCTIONS (LOGIC)
// ==========================================

function getMatches(userSkills, requiredSkillsCsv) {
  if (!requiredSkillsCsv) return { matches: [], matchCount: 0 };
  const required = requiredSkillsCsv
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s);
  const matches = required.filter((skill) => userSkills.includes(skill));
  return { matches: matches, matchCount: matches.length };
}

function calculateMatch(job, user, allResources) {
  const userSkills = user.skills;
  const jobSkills = (job.required_skills || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s);

  if (jobSkills.length === 0)
    return {
      ...job,
      matchPercent: 0,
      matches: [],
      missing: [],
      recommendedResources: [],
    };

  const matches = jobSkills.filter((skill) => userSkills.includes(skill));
  const missing = jobSkills.filter((skill) => !userSkills.includes(skill));
  const matchPercent = Math.round((matches.length / jobSkills.length) * 100);

  let recommendedResources = [];
  if (missing.length > 0) {
    recommendedResources = allResources.filter((res) => {
      const resourceSkills = (res.related_skills || "")
        .split(",")
        .map((s) => s.trim().toLowerCase());
      return missing.some((missingSkill) =>
        resourceSkills.includes(missingSkill)
      );
    });
  }

  return {
    ...job,
    matchPercent: matchPercent,
    matches: matches,
    missing: missing,
    recommendedResources: recommendedResources.slice(0, 2),
  };
}

function findSkillsInCV(cvText) {
  const SKILL_DICTIONARY = [
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
    "mysql",
    "mongodb",
    "firebase",
    "postgresql",
    "ms sql",
    "git",
    "github",
    "docker",
    "figma",
    "vs code",
    "heroku",
    "aws",
    "azure",
    "google cloud",
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
  ];

  const cleanText = cvText.toLowerCase().replace(/[/(),]/g, " ");
  const foundSkills = SKILL_DICTIONARY.filter((skill) =>
    cleanText.includes(skill)
  );
  const uniqueSkills = [...new Set(foundSkills)];

  return { skills: uniqueSkills.join(", "), roles: "" };
}

// --- AI CALLS ---

async function generateRoadmap(targetRole, timeframe, currentSkills) {
  const userPrompt = `
    Act as a senior career architect. Create a strict, step-by-step learning roadmap for a user wanting to become a **${targetRole}** in **${timeframe}**.
    
    **User Context:**
    - Current Skills: ${currentSkills} (Skip basics they already know)
    
    **Format Requirements (Strict Markdown):**
    1. Break the timeline into distinct **Phases** (e.g., "Phase 1: Foundations (Weeks 1-4)").
    2. For each Phase, list **3-4 Specific Topics** to learn (be technical and precise).
    3. **CRITICAL:** At the end of EVERY Phase, define a **"Build This Project"** task. 
       - Give the project a name.
       - Explain briefly what it should do (e.g., "Build a To-Do App that saves to LocalStorage").
    4. End with a **Final Capstone Project** idea that is resume-worthy.
    
    Keep instructions clear, actionable, and focused on "doing" rather than just "reading".
  `;
  return callGemini(userPrompt);
}

async function generateChatbotResponse(query) {
  const systemPrompt = `
    You are "CareerUp Buddy," a warm, supportive, and wise career mentor. 
    
    **Your Persona:**
    - You are a "Well-Wisher": You genuinely care about the user's success.
    - You are Compact: Keep answers short (2-3 sentences max) unless asked for a list.
    - You are Simple: Explain things like I am 12 years old. No complex jargon without explanation.
    - Tone: Encouraging, positive, and friendly (use 1 emoji per response).
    
    **The User asks:** "${query}"
    
    Answer the user directly. Do not start with "As a career mentor..." just give the advice.
  `;
  return callGemini(systemPrompt);
}

async function generateSummary(skills, experience) {
  const userPrompt = `
    Write a professional, punchy resume summary (max 3 lines) for a candidate.
    - Highlight these top skills: ${skills}
    - incorporate this experience context: ${experience}
    - Tone: Professional, confident, result-oriented.
    - Do NOT use "I" or "My". Start with strong verbs or titles (e.g., "Dedicated Web Developer with...").
  `;
  return callGemini(userPrompt);
}

async function callGemini(promptText) {
  const payload = { contents: [{ parts: [{ text: promptText }] }] };
  const response = await fetch(GEMINI_API_URL + GEMINI_API_KEY, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw new Error(`AI API Error: ${response.status}`);
  const result = await response.json();
  return result.candidates[0].content.parts[0].text;
}

// --- ADMIN: ADD JOB ---
app.post("/admin/add-job", async (req, res) => {
  const { title, company, location, type, skills, exp } = req.body;
  const sql =
    "INSERT INTO jobs (job_title, company, location, job_type, required_skills, experience_level) VALUES (?, ?, ?, ?, ?, ?)";
  db.query(sql, [title, company, location, type, skills, exp], (err) => {
    if (err) return res.status(500).json({ message: "Error" });
    res.json({ message: "Job added!" });
  });
});

// --- ADMIN: DELETE JOB ---
app.post("/admin/delete-job", async (req, res) => {
  const { id } = req.body;
  db.query("DELETE FROM jobs WHERE id = ?", [id], (err) => {
    if (err) return res.status(500).json({ message: "Error" });
    res.json({ message: "Job deleted!" });
  });
});

// ==========================================
// 5. START SERVER
// ==========================================

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
  console.log("SERVER IS RUNNING..!");
});
