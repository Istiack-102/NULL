/**
 * ============================================================
 * CAREER PLATFORM - MAIN JAVASCRIPT
 * ============================================================
 * 1. Global Constants & Utilities
 * 2. UI & Formatting Helpers (HTML Generators, Theme, PDF)
 * 3. State Management (Router, Login/Logout)
 * 4. Data Loading Functions (API Calls)
 * 5. Initialization & Event Listeners (DOM Ready)
 * ============================================================
 */

// ==========================================
// 1. GLOBAL CONSTANTS & UTILITIES
// ==========================================

const API_URL = "http://localhost:3001";

/**
 * Helper to make secure API calls
 */
async function fetchWithAuth(url, options = {}) {
  const token =
    localStorage.getItem("token") || sessionStorage.getItem("token");

  options.headers = options.headers || {};
  if (token) {
    options.headers["Authorization"] = `Bearer ${token}`;
  }
  if (options.body) {
    options.headers["Content-Type"] = "application/json";
  }

  return fetch(API_URL + url, options);
}

/**
 * Toggles Dark/Light Mode
 */
function setTheme(themeName) {
  const themeBtn = document.getElementById("theme-toggle-btn");
  const themeBtnPublic = document.getElementById("theme-toggle-btn-public");

  if (themeName === "dark") {
    document.body.classList.add("dark-mode");
    if (themeBtn) themeBtn.textContent = "☀️";
    if (themeBtnPublic) themeBtnPublic.textContent = "☀️";
    localStorage.setItem("theme", "dark");
  } else {
    document.body.classList.remove("dark-mode");
    if (themeBtn) themeBtn.textContent = "🌙";
    if (themeBtnPublic) themeBtnPublic.textContent = "🌙";
    localStorage.setItem("theme", "light");
  }
}

/**
 * Toggles Password Visibility
 */
function togglePasswordVisibility(inputId, iconId) {
  const input = document.getElementById(inputId);
  const icon = document.getElementById(iconId);

  if (input.type === "password") {
    input.type = "text";
    icon.textContent = "🙈";
  } else {
    input.type = "password";
    icon.textContent = "👀";
  }
}

// ==========================================
// 2. UI & FORMATTING HELPERS
// ==========================================

/**
 * Converts Markdown to HTML for Roadmap
 */
function renderRoadmap(markdownText) {
  let html = "";
  const lines = markdownText.split("\n");

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith("## ")) {
      html += `<h2 class="roadmap-header">${trimmedLine
        .substring(3)
        .trim()}</h2>`;
    } else if (trimmedLine.startsWith("### ")) {
      html += `<h4 class="roadmap-subheader">${trimmedLine
        .substring(4)
        .trim()}</h4>`;
    } else if (trimmedLine.startsWith("* ") || trimmedLine.startsWith("- ")) {
      const content = trimmedLine.substring(2).trim();
      const styledContent = content.replace(
        /\*\*(.*?)\*\*/g,
        "<strong>$1</strong>"
      );
      if (!html.endsWith("<ul>") && !html.endsWith("</ul>")) {
        html += '<ul class="roadmap-list">';
      }
      html += `<li>${styledContent}</li>`;
    } else if (trimmedLine.startsWith("---")) {
      html += '<hr class="roadmap-divider">';
    } else if (trimmedLine.includes("| :--- |")) {
      html +=
        '<h4 class="roadmap-subheader" style="margin-top: 1.5rem;">Job Application Timeline</h4>';
    } else if (trimmedLine.length > 0) {
      const styledContent = trimmedLine.replace(
        /\*\*(.*?)\*\*/g,
        "<strong>$1</strong>"
      );
      if (html.endsWith("</ul>")) html += "</ul>";
      html += `<p class="roadmap-paragraph">${styledContent}</p>`;
    }
    if (trimmedLine === "" && html.endsWith("</ul>")) html += "</ul>";
  }
  if (html.endsWith("</ul>")) html += "</ul>";
  return html;
}

/**
 * Generates HTML for a single job item
 */
function generateJobHTML(job, showMatchPercent = false) {
  let skillsHTML = "";
  if (job.required_skills) {
    skillsHTML = job.required_skills
      .split(",")
      .map((skill) => `<span class="skill-tag">${skill.trim()}</span>`)
      .join("");
  }

  let matchHTML = "";
  if (showMatchPercent) {
    const { matchPercent, matches, missing, recommendedResources } = job;
    let barColorClass = "low";
    if (matchPercent > 70) barColorClass = "high";
    else if (matchPercent > 40) barColorClass = "medium";

    matchHTML = `
        <div class="match-score-wrapper">
            <div class="match-header">
                <span>Match Score</span>
                <span style="color: var(--primary-color)">${matchPercent}%</span>
            </div>
            <div class="progress-track">
                <div class="progress-fill ${barColorClass}" style="width: ${matchPercent}%"></div>
            </div>
            ${
              missing && missing.length > 0
                ? `<p class="missing-skills-text">⚠️ Missing: ${missing
                    .slice(0, 3)
                    .join(", ")}</p>`
                : ""
            }
        </div>`;
  }

  return `
    <div class="list-item">
        <div class="item-header">
            <h3>${job.job_title}</h3>
            <span>${job.location} | ${job.job_type}</span>
        </div>
        <p class="item-company">${job.company} (Exp: ${
    job.experience_level
  })</p>
        <div class="item-tags">${skillsHTML}</div>
        ${matchHTML}
        <a href="https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(
          job.job_title
        )} ${encodeURIComponent(job.company)}" 
           target="_blank" class="apply-link">Search on LinkedIn</a>
    </div>`;
}

/**
 * Generates HTML for a single resource item
 */
function generateResourceHTML(resource, showMatchCount = false) {
  let skillsHTML = "";
  if (resource.related_skills) {
    skillsHTML = resource.related_skills
      .split(",")
      .map((skill) => `<span class="skill-tag">${skill.trim()}</span>`)
      .join("");
  }

  let matchHTML = "";
  if (showMatchCount && resource.matchCount > 0) {
    matchHTML = `<div class="item-matches"><span class="skill-tag-match">Recommended for You</span></div>`;
  }

  return `
    <div class="list-item">
        <div class="item-header">
            <h3><a href="${resource.url}" target="_blank">${resource.title}</a></h3>
            <span>${resource.platform} | ${resource.cost_indicator}</span>
        </div>
        <div class="item-tags">${skillsHTML}</div>
        ${matchHTML}
    </div>`;
}

/**
 * Generates PDF using HTML Templates
 */
async function generatePDF() {
  try {
    const response = await fetchWithAuth("/profile");
    if (!response.ok) throw new Error("Could not fetch profile data");
    const data = await response.json();

    const element = document.createElement("div");
    element.innerHTML = `
        <div style="font-family: 'Helvetica', sans-serif; color: #333; padding: 40px; max-width: 800px; margin: 0 auto;">
            <div style="border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 20px;">
                <h1 style="color: #3b82f6; font-size: 32px; margin: 0;">${
                  data.full_name || "Your Name"
                }</h1>
                <h3 style="font-weight: normal; margin: 5px 0; color: #555;">${
                  data.career_track || "Career Track"
                }</h3>
                <p style="font-size: 12px; color: #777; margin-top: 10px;">
                    Email: ${data.email} • Experience: ${data.experience_level}
                </p>
            </div>
            <div style="margin-bottom: 25px;">
                <h4 style="background: #eee; padding: 5px 10px; border-left: 4px solid #3b82f6; margin-bottom: 10px;">PROFESSIONAL SUMMARY</h4>
                <p style="font-size: 12px; line-height: 1.6;">${
                  data.experience_notes || "No summary provided yet."
                }</p>
            </div>
            <div style="margin-bottom: 25px;">
                <h4 style="background: #eee; padding: 5px 10px; border-left: 4px solid #3b82f6; margin-bottom: 10px;">TECHNICAL SKILLS</h4>
                <p style="font-size: 12px;">${
                  data.skills || "No skills listed."
                }</p>
            </div>
            <div style="display: flex; gap: 20px;">
                <div style="flex: 1;">
                    <h4 style="background: #eee; padding: 5px 10px; border-left: 4px solid #3b82f6; margin-bottom: 10px;">EDUCATION</h4>
                    <p style="font-size: 12px;">${
                      data.education_level || "Not specified"
                    }</p>
                </div>
                <div style="flex: 1;">
                    <h4 style="background: #eee; padding: 5px 10px; border-left: 4px solid #3b82f6; margin-bottom: 10px;">TARGET ROLES</h4>
                    <p style="font-size: 12px;">${
                      data.target_roles || "Open to opportunities"
                    }</p>
                </div>
            </div>
            <div style="margin-top: 50px; text-align: center; font-size: 10px; color: #aaa; border-top: 1px solid #eee; padding-top: 10px;">Generated by CareerUp Platform</div>
        </div>`;

    const opt = {
      margin: 0.5,
      filename: `${data.full_name.replace(/\s+/g, "_")}_CV.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
    };

    html2pdf().set(opt).from(element).save();
  } catch (err) {
    console.error("Error generating PDF:", err);
    alert("Failed to generate CV.");
  }
}

/**
 * Toast Notification Helpers
 */
function showProfileSuccess(message) {
  const profileSuccess = document.getElementById("profile-success");
  if (profileSuccess) {
    profileSuccess.textContent = message;
    profileSuccess.style.display = "block";
    setTimeout(() => {
      profileSuccess.style.display = "none";
    }, 3000);
  }
}

function showProfileError(message) {
  const profileSuccess = document.getElementById("profile-success");
  if (profileSuccess) {
    profileSuccess.textContent = message;
    profileSuccess.style.display = "block";
    profileSuccess.style.backgroundColor = "var(--error-light)";
    profileSuccess.style.color = "var(--error-color)";
    profileSuccess.style.border = "1px solid var(--error-color)";
    setTimeout(() => {
      profileSuccess.style.display = "none";
    }, 3000);
  }
}

// ==========================================
// 3. STATE MANAGEMENT & ROUTING
// ==========================================

/**
 * Shows the "Logged In" state
 */
function showLoggedInState() {
  const navLoggedIn = document.getElementById("nav-logged-in");
  const navLoggedOut = document.getElementById("nav-logged-out");

  if (navLoggedIn) navLoggedIn.style.display = "flex";
  if (navLoggedOut) navLoggedOut.style.display = "none";

  showView("dashboard");
  loadDashboardData();
}

/**
 * Shows the "Logged Out" state
 */
function showLoggedOutState() {
  const navLoggedIn = document.getElementById("nav-logged-in");
  const navLoggedOut = document.getElementById("nav-logged-out");

  if (navLoggedIn) navLoggedIn.style.display = "none";
  if (navLoggedOut) navLoggedOut.style.display = "flex";

  localStorage.removeItem("token");
  sessionStorage.removeItem("token");

  showView("login");
}

/**
 * The "Router" - Switches views
 */
function showView(viewName) {
  const views = {
    login: document.getElementById("login-view"),
    signup: document.getElementById("signup-view"),
    dashboard: document.getElementById("dashboard-view"),
    roadmap: document.getElementById("roadmap-view"),
    chatbot: document.getElementById("chatbot-view"),
    profile: document.getElementById("profile-view"),
    jobs: document.getElementById("jobs-view"),
    resources: document.getElementById("resources-view"),
    admin: document.getElementById("admin-view"),
  };

  // Hide all
  for (let key in views) {
    if (views[key]) views[key].classList.remove("active-view");
  }
  // Show target
  if (views[viewName]) views[viewName].classList.add("active-view");

  // Update active nav links
  const isLoggedIn = !!(
    localStorage.getItem("token") || sessionStorage.getItem("token")
  );
  const navId = isLoggedIn ? "nav-logged-in" : "nav-logged-out";
  const activeNav = document.getElementById(navId);

  if (activeNav) {
    activeNav
      .querySelectorAll("a")
      .forEach((a) => a.classList.remove("active"));

    let linkId = "";
    if (viewName === "dashboard") linkId = "nav-dashboard";
    else if (viewName === "roadmap") linkId = "nav-roadmap";
    else if (viewName === "chatbot") linkId = "nav-chatbot";
    else if (viewName === "profile") linkId = "nav-profile";
    else if (viewName === "jobs")
      linkId = isLoggedIn ? "nav-jobs-private" : "nav-jobs-public";
    else if (viewName === "resources")
      linkId = isLoggedIn ? "nav-resources-private" : "nav-resources-public";
    else if (viewName === "login" || viewName === "signup")
      linkId = "nav-login";

    if (linkId) {
      const activeLink = document.getElementById(linkId);
      if (activeLink) activeLink.classList.add("active");
    }
  }
}

// ==========================================
// 4. DATA LOADING FUNCTIONS
// ==========================================

/**
 * Main Controller: Loads all Dashboard Data
 */
async function loadDashboardData() {
  try {
    const response = await fetchWithAuth("/dashboard");
    if (!response.ok) {
      if (response.status === 401 || response.status === 403)
        showLoggedOutState();
      throw new Error("Failed to load dashboard data");
    }
    const data = await response.json();

    // 1. Update UI Sections
    updateProfileUI(data.user);
    updateStats(data);
    renderLists(data);

    // 2. Render Advanced Charts
    renderSkillCharts(data.user.skills, data.jobs);
  } catch (err) {
    console.error("Error loading dashboard:", err);
  }
}

function updateProfileUI(user) {
  const dashName = document.getElementById("dash-name");
  const dashTrack = document.getElementById("dash-track");
  const dashEmail = document.getElementById("dash-email");
  const dashSkills = document.getElementById("dash-skills");

  if (dashName) dashName.textContent = user.name || "User";
  if (dashTrack) dashTrack.textContent = user.track || "No track selected";
  if (dashEmail) dashEmail.textContent = user.email || "No email";

  if (dashSkills) {
    dashSkills.innerHTML =
      user.skills.length > 0
        ? user.skills.map((skill) => `<li>${skill}</li>`).join("")
        : `<li style="background: none; border: 1px dashed #ccc; color: #777; width: 100%; text-align: center;">No skills added.</li>`;
  }
}

function updateStats(data) {
  let score = 20;
  if (data.user.skills.length > 0) score += 40;
  if (data.user.track) score += 20;
  if (data.user.email) score += 20;

  const scoreEl = document.getElementById("stat-score");
  if (scoreEl) scoreEl.textContent = score + "%";

  const jobCountEl = document.getElementById("stat-jobs");
  if (jobCountEl) jobCountEl.textContent = data.jobs.length;

  const appCountEl = document.getElementById("stat-apps");
  if (appCountEl)
    appCountEl.textContent = localStorage.getItem("myApplications") || "0";
}

function renderLists(data) {
  const jobsList = document.getElementById("dash-jobs-list");
  const resourcesList = document.getElementById("dash-resources-list");

  const highMatchJobs = data.jobs.filter((job) => job.matchPercent >= 50);

  if (jobsList) {
    jobsList.innerHTML =
      highMatchJobs.length > 0
        ? highMatchJobs
            .slice(0, 3)
            .map((job) => generateJobHTML(job, true))
            .join("")
        : `<div style="text-align:center; padding:1rem; color:#777;"><p>No high-match jobs found.</p></div>`;
  }

  if (resourcesList) {
    resourcesList.innerHTML =
      data.resources.length > 0
        ? data.resources
            .slice(0, 3)
            .map((res) => generateResourceHTML(res, true))
            .join("")
        : "<p>No resources found.</p>";
  }
}

function renderSkillCharts(userSkills, jobs) {
  let allMissing = [];
  jobs.slice(0, 5).forEach((job) => {
    if (job.missing) allMissing.push(...job.missing);
  });

  const counts = {};
  allMissing.forEach((x) => {
    counts[x] = (counts[x] || 0) + 1;
  });
  const sortedMissing = Object.keys(counts)
    .sort((a, b) => counts[b] - counts[a])
    .slice(0, 3);

  // RENDER RADAR CHART
  const taxonomy = {
    Frontend: [
      "javascript",
      "react",
      "html",
      "css",
      "vue",
      "angular",
      "tailwind",
      "typescript",
    ],
    Backend: [
      "node",
      "python",
      "java",
      "php",
      "sql",
      "mysql",
      "mongodb",
      "express",
      "django",
    ],
    Design: ["figma", "adobe", "ui", "ux", "photoshop", "canva", "design"],
    DevOps: ["git", "github", "docker", "aws", "linux", "jenkins", "cloud"],
    "Soft Skills": [
      "communication",
      "leadership",
      "teamwork",
      "problem-solving",
      "management",
    ],
  };

  const scores = {
    Frontend: 0,
    Backend: 0,
    Design: 0,
    DevOps: 0,
    "Soft Skills": 0,
  };
  const skillsLower = userSkills.map((s) => s.toLowerCase());

  skillsLower.forEach((skill) => {
    for (const [category, keywords] of Object.entries(taxonomy)) {
      if (keywords.some((k) => skill.includes(k))) {
        scores[category] += 3;
      }
    }
  });

  const totalPoints = Object.values(scores).reduce((a, b) => a + b, 0);
  const emptyMsg = document.getElementById("chart-empty-msg");

  if (totalPoints === 0) {
    if (emptyMsg) emptyMsg.style.display = "block";
    Object.keys(scores).forEach((k) => (scores[k] = 2));
  } else {
    if (emptyMsg) emptyMsg.style.display = "none";
  }

  const canvasRadar = document.getElementById("radarChart");
  if (canvasRadar) {
    if (window.myRadarChart) window.myRadarChart.destroy();

    const ctx = canvasRadar.getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, "rgba(79, 70, 229, 0.7)");
    gradient.addColorStop(1, "rgba(34, 211, 238, 0.1)");

    window.myRadarChart = new Chart(canvasRadar, {
      type: "radar",
      data: {
        labels: Object.keys(scores),
        datasets: [
          {
            label: "Skill DNA",
            data: Object.values(scores),
            backgroundColor: gradient,
            borderColor: "#4F46E5",
            borderWidth: 2,
            pointBackgroundColor: "#22D3EE",
            pointBorderColor: "#fff",
            pointHoverBackgroundColor: "#fff",
            pointHoverBorderColor: "#4F46E5",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            angleLines: { color: "rgba(150, 150, 150, 0.1)" },
            grid: { color: "rgba(150, 150, 150, 0.1)" },
            pointLabels: {
              color: "#64748B",
              font: { size: 11, weight: "bold", family: "Inter" },
            },
            ticks: { display: false, maxTicksLimit: 5, beginAtZero: true },
          },
        },
        plugins: { legend: { display: false } },
      },
    });
  }
}

// --- ADMIN FUNCTIONS ---
async function loadAdminJobs() {
  const list = document.getElementById("admin-job-list");
  if (!list) return;
  list.innerHTML = "<p>Loading...</p>";

  try {
    const res = await fetch(API_URL + "/public-jobs");
    const jobs = await res.json();

    if (jobs.length === 0) {
      list.innerHTML = "<p>No jobs found.</p>";
      return;
    }

    list.innerHTML = jobs
      .map(
        (job) => `
          <div class="list-item" style="display:flex; justify-content:space-between; align-items:center;">
              <div><strong>${job.job_title}</strong> <br> <small>${job.company}</small></div>
              <button onclick="deleteJob(${job.id})" style="background:#ef4444; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">Delete</button>
          </div>
      `
      )
      .join("");
  } catch (err) {
    console.error(err);
    list.innerHTML = "<p>Error loading admin data.</p>";
  }
}

async function deleteJob(id) {
  if (!confirm("Delete this job?")) return;
  try {
    await fetch(API_URL + "/admin/delete-job", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    loadAdminJobs();
  } catch (err) {
    alert("Error deleting job");
  }
}

/**
 * Load Profile Data
 */
async function loadProfileData() {
  try {
    const response = await fetchWithAuth("/profile");
    if (!response.ok) {
      if (response.status === 401 || response.status === 403)
        showLoggedOutState();
      throw new Error("Failed to get profile");
    }
    const data = await response.json();

    document.getElementById("profile-name").value = data.full_name || "";
    document.getElementById("profile-email").value = data.email || "";
    document.getElementById("profile-education").value =
      data.education_level || "";
    document.getElementById("profile-level").value =
      data.experience_level || "Fresher";
    document.getElementById("profile-track").value =
      data.career_track || "Web Development";
    document.getElementById("profile-roles").value = data.target_roles || "";
    document.getElementById("profile-skills").value = data.skills || "";
    document.getElementById("profile-experience").value =
      data.experience_notes || "";
    document.getElementById("profile-cv").value = data.cv_text || "";
  } catch (err) {
    console.error("Error loading profile:", err);
  }
}

/**
 * Load Jobs Page
 */
async function loadJobsPage(filters = {}) {
  const jobsListContainer = document.getElementById("jobs-list-container");
  jobsListContainer.innerHTML = "<p>Loading jobs...</p>";

  const params = new URLSearchParams();
  if (filters.title) params.append("title", filters.title);
  if (filters.location) params.append("location", filters.location);
  if (filters.type) params.append("type", filters.type);
  const queryString = params.toString();

  try {
    const response = await fetchWithAuth(`/jobs?${queryString}`);
    if (!response.ok) {
      if (response.status === 401 || response.status === 403)
        showLoggedOutState();
      throw new Error("Failed to load jobs");
    }
    const jobs = await response.json();
    jobsListContainer.innerHTML =
      jobs.length > 0
        ? jobs.map((job) => generateJobHTML(job, true)).join("")
        : "<p>No jobs found matching your criteria.</p>";
  } catch (err) {
    console.error("Error loading jobs:", err);
    jobsListContainer.innerHTML =
      '<p class="error-message">Error loading jobs.</p>';
  }
}

/**
 * Load Resources Page
 */
async function loadResourcesPage() {
  const resourcesListContainer = document.getElementById(
    "resources-list-container"
  );
  resourcesListContainer.innerHTML = "<p>Loading resources...</p>";

  try {
    const response = await fetch(API_URL + "/resources");
    if (!response.ok) throw new Error("Failed to load resources");
    const resources = await response.json();
    resourcesListContainer.innerHTML =
      resources.length > 0
        ? resources.map((res) => generateResourceHTML(res, false)).join("")
        : "<p>No resources found.</p>";
  } catch (err) {
    console.error("Error loading resources:", err);
    resourcesListContainer.innerHTML =
      '<p class="error-message">Error loading resources.</p>';
  }
}

// ==========================================
// 5. EVENT LISTENERS (INITIALIZATION)
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
  // 1. Load Saved Theme
  const savedTheme = localStorage.getItem("theme") || "light";
  setTheme(savedTheme);

  // 2. Check Auth Status (Auto Login)
  const initialToken =
    localStorage.getItem("token") || sessionStorage.getItem("token");
  if (initialToken) {
    showLoggedInState();
  } else {
    showLoggedOutState();
    loadResourcesPage();
  }

  // --- EVENT LISTENERS ---

  // Navigation Links
  const navMap = {
    "nav-dashboard": () => {
      showView("dashboard");
      loadDashboardData();
    },
    "nav-jobs-private": () => {
      showView("jobs");
      loadJobsPage();
    },
    "nav-jobs-public": () => {
      showView("jobs");
      loadJobsPage();
    },
    "nav-roadmap": () => showView("roadmap"),
    "nav-chatbot": () => {
      showView("chatbot");
      setTimeout(
        () => document.getElementById("careerbot-input")?.focus(),
        100
      );
    },
    "nav-resources-private": () => {
      showView("resources");
      loadResourcesPage();
    },
    "nav-resources-public": () => {
      showView("resources");
      loadResourcesPage();
    },
    "nav-profile": () => {
      showView("profile");
      loadProfileData();
    },
    "dash-profile-link": () => {
      showView("profile");
      loadProfileData();
    },
    "nav-login": () => showView("login"),
    "nav-logout": (e) => {
      e.preventDefault();
      showLoggedOutState();
    },
    "logo-link": (e) => {
      e.preventDefault();
      if (localStorage.getItem("token") || sessionStorage.getItem("token")) {
        showView("dashboard");
        loadDashboardData();
      } else {
        showView("login");
      }
    },
  };

  Object.keys(navMap).forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", navMap[id]);
  });

  // Auth Links (Small text links)
  const gotoSignup = document.getElementById("goto-signup-link");
  if (gotoSignup)
    gotoSignup.addEventListener("click", (e) => {
      e.preventDefault();
      showView("signup");
    });

  const gotoLogin = document.getElementById("goto-login-link");
  if (gotoLogin)
    gotoLogin.addEventListener("click", (e) => {
      e.preventDefault();
      showView("login");
    });

  // Floating Button
  const fabBtn = document.getElementById("fab-chatbot");
  if (fabBtn) {
    fabBtn.addEventListener("click", () => {
      showView("chatbot");
      const chatLink = document.getElementById("nav-chatbot");
      if (chatLink) chatLink.classList.add("active");
      setTimeout(
        () => document.getElementById("careerbot-input")?.focus(),
        100
      );
    });
  }

  // Theme & Password
  const themeBtn = document.getElementById("theme-toggle-btn");
  const themeBtnPublic = document.getElementById("theme-toggle-btn-public");
  const handleThemeToggle = () =>
    setTheme(localStorage.getItem("theme") === "dark" ? "light" : "dark");
  if (themeBtn) themeBtn.addEventListener("click", handleThemeToggle);
  if (themeBtnPublic)
    themeBtnPublic.addEventListener("click", handleThemeToggle);

  const toggleLogin = document.getElementById("toggle-login-pass");
  if (toggleLogin)
    toggleLogin.addEventListener("click", () =>
      togglePasswordVisibility("login-pass", "toggle-login-pass")
    );
  const toggleSignup = document.getElementById("toggle-signup-pass");
  if (toggleSignup)
    toggleSignup.addEventListener("click", () =>
      togglePasswordVisibility("signup-pass", "toggle-signup-pass")
    );

  // Features
  const downloadBtn = document.getElementById("download-cv-btn");
  if (downloadBtn)
    downloadBtn.addEventListener("click", (e) => {
      e.preventDefault();
      generatePDF();
    });

  const filterBtn = document.getElementById("job-filter-btn");
  if (filterBtn) {
    filterBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const filters = {
        title: document.getElementById("job-search-title").value,
        location: document.getElementById("job-search-location").value,
        type: document.getElementById("job-search-type").value,
      };
      loadJobsPage(filters);
    });
  }

  // AI CV Analysis
  const analyzeBtn = document.getElementById("analyze-cv-btn");
  if (analyzeBtn) {
    analyzeBtn.addEventListener("click", async () => {
      const cv_text = document.getElementById("profile-cv").value;
      const statusEl = document.getElementById("analyze-cv-status");
      if (!cv_text.trim()) return alert("Please paste your CV text.");
      statusEl.textContent = "Analyzing...";
      statusEl.style.display = "block";
      analyzeBtn.disabled = true;
      try {
        const res = await fetchWithAuth("/profile/analyze-cv", {
          method: "POST",
          body: JSON.stringify({ cv_text }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);
        document.getElementById("profile-skills").value = data.skills;
        document.getElementById("profile-roles").value = data.roles;
        statusEl.textContent = "Analysis Complete! Remember to save.";
      } catch (err) {
        statusEl.textContent = "Error: " + err.message;
      } finally {
        analyzeBtn.disabled = false;
      }
    });
  }

  // AI Summary
  const summaryBtn = document.getElementById("generate-summary-btn");
  if (summaryBtn) {
    summaryBtn.addEventListener("click", async () => {
      const skills = document.getElementById("profile-skills").value;
      const exp = document.getElementById("profile-experience").value;
      const statusEl = document.getElementById("summary-status");
      if (!skills && !exp) return alert("Add skills or experience first.");
      statusEl.textContent = "Generating summary...";
      statusEl.style.display = "block";
      summaryBtn.disabled = true;
      try {
        const res = await fetchWithAuth("/profile/summarize", {
          method: "POST",
          body: JSON.stringify({ skills, experience: exp }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);
        document.getElementById("profile-experience").value = data.summary;
        statusEl.textContent = "Done! Review and save.";
      } catch (err) {
        statusEl.textContent = "Error: " + err.message;
      } finally {
        summaryBtn.disabled = false;
        setTimeout(() => (statusEl.style.display = "none"), 5000);
      }
    });
  }

  // AI Roadmap
  const roadmapForm = document.getElementById("roadmap-form");
  if (roadmapForm) {
    roadmapForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const role = document.getElementById("roadmap-target-role").value;
      const time = document.getElementById("roadmap-timeframe").value;
      const skills = document.getElementById("dash-skills")?.innerText || "";
      const status = document.getElementById("roadmap-status");
      const output = document.getElementById("roadmap-output");
      status.textContent = "Generating Plan...";
      status.style.display = "block";
      try {
        const res = await fetchWithAuth("/roadmap", {
          method: "POST",
          body: JSON.stringify({
            targetRole: role,
            timeframe: time,
            currentSkills: skills,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);
        output.innerHTML = renderRoadmap(data.roadmap);
        status.textContent = "Success!";
      } catch (err) {
        status.textContent = "Error: " + err.message;
      }
    });
  }

  // Chatbot
  const chatBtn = document.getElementById("careerbot-ask-btn");
  if (chatBtn) {
    chatBtn.addEventListener("click", async () => {
      const input = document.getElementById("careerbot-input");
      const window = document.getElementById("careerbot-chat-window");
      const query = input.value.trim();
      if (!query) return;
      window.innerHTML += `<div class="chat-message user-message"><p><strong>You:</strong> ${query}</p></div>`;
      input.value = "";
      window.scrollTop = window.scrollHeight;
      try {
        const res = await fetchWithAuth("/chatbot", {
          method: "POST",
          body: JSON.stringify({ query }),
        });
        const data = await res.json();
        window.innerHTML += `<div class="chat-message bot-message"><p><strong>AI:</strong> ${data.response}</p></div>`;
      } catch (err) {
        window.innerHTML += `<div class="chat-message error-message"><p>Error connecting.</p></div>`;
      }
      window.scrollTop = window.scrollHeight;
    });
  }

  // Login Form
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("login-email").value;
      const password = document.getElementById("login-pass").value;
      const rememberMe = document.getElementById("remember-me")?.checked;
      const errorEl = document.getElementById("login-error");

      try {
        const res = await fetch(API_URL + "/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);

        if (rememberMe) {
          localStorage.setItem("token", data.token);
          localStorage.setItem("role", data.role);
        } else {
          sessionStorage.setItem("token", data.token);
          sessionStorage.setItem("role", data.role);
        }

        if (data.role === "admin") {
          showView("admin");
          loadAdminJobs();
        } else {
          showLoggedInState();
        }
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.style.display = "block";
      }
    });
  }

  // Signup Form
  const signupForm = document.getElementById("signup-form");
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = {
        fullName: document.getElementById("signup-name").value,
        email: document.getElementById("signup-email").value,
        password: document.getElementById("signup-pass").value,
        education: document.getElementById("signup-education").value,
        experience: document.getElementById("signup-level").value,
        track: document.getElementById("signup-track").value,
      };
      try {
        const res = await fetch(API_URL + "/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);
        alert("Signup successful! Please log in.");
        showView("login");
      } catch (err) {
        document.getElementById("signup-error").textContent = err.message;
        document.getElementById("signup-error").style.display = "block";
      }
    });
  }

  // Profile Save
  const profileForms = [
    "profile-details-form",
    "profile-skills-form",
    "profile-cv-form",
  ];
  profileForms.forEach((formId) => {
    const form = document.getElementById(formId);
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const getValue = (id) => document.getElementById(id)?.value || "";
        const profileData = {
          fullName: getValue("profile-name"),
          email: getValue("profile-email"),
          education: getValue("profile-education"),
          level: getValue("profile-level"),
          track: getValue("profile-track"),
          roles: getValue("profile-roles"),
          skills: getValue("profile-skills"),
          experience: getValue("profile-experience"),
          cv_text: getValue("profile-cv"),
        };

        if (!profileData.fullName.trim()) {
          return alert(
            "Name cannot be empty. Please wait for profile to load."
          );
        }

        try {
          const res = await fetchWithAuth("/profile", {
            method: "POST",
            body: JSON.stringify(profileData),
          });
          const result = await res.json();
          if (!res.ok) throw new Error(result.message);

          showProfileSuccess("Saved successfully!");
          await loadDashboardData();

          if (formId === "profile-cv-form") form.reset();
        } catch (err) {
          showProfileError(err.message);
        }
      });
    }
  });

  // Admin Form Listeners
  const adminForm = document.getElementById("admin-add-job");
  if (adminForm) {
    adminForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const jobData = {
        title: document.getElementById("adj-title").value,
        company: document.getElementById("adj-company").value,
        location: document.getElementById("adj-location").value,
        type: document.getElementById("adj-type").value,
        skills: document.getElementById("adj-skills").value,
        exp: document.getElementById("adj-exp").value,
      };
      await fetch(API_URL + "/admin/add-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(jobData),
      });
      alert("Job Posted!");
      adminForm.reset();
      loadAdminJobs();
    });
  }
});
