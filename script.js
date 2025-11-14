/**
 * Career Platform - Full App Logic
 * This file handles all frontend interactivity, state, and API calls.
 */
/**
 * Converts the AI's raw markdown text into styled HTML.
 * This function is critical for making the Roadmap look professional.
 */
function renderRoadmap(markdownText) {
  let html = "";
  const lines = markdownText.split("\n");

  for (const line of lines) {
    const trimmedLine = line.trim();

    // 1. Markdown Headers (##, ###)
    if (trimmedLine.startsWith("## ")) {
      // Converts '## PHASE 1' to '<h2>PHASE 1</h2>'
      html += `<h2 class="roadmap-header">${trimmedLine
        .substring(3)
        .trim()}</h2>`;
    } else if (trimmedLine.startsWith("### ")) {
      // Converts '### Focus' to '<h4>Focus</h4>'
      html += `<h4 class="roadmap-subheader">${trimmedLine
        .substring(4)
        .trim()}</h4>`;
    }

    // 2. Lists (* or -)
    else if (trimmedLine.startsWith("* ") || trimmedLine.startsWith("- ")) {
      const content = trimmedLine.substring(2).trim();
      // Finds content inside **bold** tags for emphasis
      const styledContent = content.replace(
        /\*\*(.*?)\*\*/g,
        "<strong>$1</strong>"
      );

      // If the last thing added wasn't an <ul>, start one
      if (!html.endsWith("<ul>") && !html.endsWith("</ul>")) {
        html += '<ul class="roadmap-list">';
      }
      html += `<li>${styledContent}</li>`;
    }

    // 3. Horizontal Rule (---)
    else if (trimmedLine.startsWith("---")) {
      html += '<hr class="roadmap-divider">';
    }

    // 4. Tables (We simplify table rendering for now, focusing on headers)
    else if (trimmedLine.includes("| :--- |")) {
      // Starts a table section title
      html +=
        '<h4 class="roadmap-subheader" style="margin-top: 1.5rem;">Job Application Timeline</h4>';
    }

    // 5. Paragraphs (Any other text, or bold text)
    else if (trimmedLine.length > 0) {
      const styledContent = trimmedLine.replace(
        /\*\*(.*?)\*\*/g,
        "<strong>$1</strong>"
      );

      // If we were building a list, close it first
      if (html.endsWith("</ul>")) {
        html += "</ul>";
      }
      // Add the paragraph content
      html += `<p class="roadmap-paragraph">${styledContent}</p>`;
    }

    // Close any lingering UL tag
    if (trimmedLine === "" && html.endsWith("</ul>")) {
      html += "</ul>";
    }
  }

  // Final check to close the UL tag if the loop ended mid-list
  if (html.endsWith("</ul>")) {
    html += "</ul>";
  }

  return html;
}
// Wait for the DOM (HTML) to be fully loaded
document.addEventListener("DOMContentLoaded", () => {
  // --- 1. State & Constants ---

  // API server location
  const API_URL = "http://localhost:3001";

  // We have 7 main "pages" (views)
  const views = {
    login: document.getElementById("login-view"),
    signup: document.getElementById("signup-view"),
    dashboard: document.getElementById("dashboard-view"),
    profile: document.getElementById("profile-view"),
    jobs: document.getElementById("jobs-view"),
    resources: document.getElementById("resources-view"),
  };

  // We have 2 nav bars
  const navLoggedIn = document.getElementById("nav-logged-in");
  const navLoggedOut = document.getElementById("nav-logged-out");

  // All navigation links
  const navLinks = {
    // Public
    logo: document.getElementById("logo-link"),
    publicJobs: document.getElementById("nav-jobs-public"),
    publicResources: document.getElementById("nav-resources-public"),
    login: document.getElementById("nav-login"),
    gotoSignup: document.getElementById("goto-signup-link"),
    gotoLogin: document.getElementById("goto-login-link"),
    // Private
    dashboard: document.getElementById("nav-dashboard"),
    privateJobs: document.getElementById("nav-jobs-private"),
    privateResources: document.getElementById("nav-resources-private"),
    profile: document.getElementById("nav-profile"),
    logout: document.getElementById("nav-logout"),
  };

  // Forms
  const loginForm = document.getElementById("login-form");
  const signupForm = document.getElementById("signup-form");
  const profileDetailsForm = document.getElementById("profile-details-form");
  const profileSkillsForm = document.getElementById("profile-skills-form");
  const profileCvForm = document.getElementById("profile-cv-form");
  ////injected by me
  const analyzeCvBtn = document.getElementById("analyze-cv-btn");
  const analyzeCvStatus = document.getElementById("analyze-cv-status");
  const jobFilterBtn = document.getElementById("job-filter-btn");
  /// four
  const roadmapForm = document.getElementById("roadmap-form");
  const roadmapOutput = document.getElementById("roadmap-output");
  const roadmapStatus = document.getElementById("roadmap-status");
  // Error/Success Message containers
  const loginError = document.getElementById("login-error");
  const signupError = document.getElementById("signup-error");
  const profileSuccess = document.getElementById("profile-success");
  //chatbot
  const careerbotInput = document.getElementById("careerbot-input");
  const careerbotAskBtn = document.getElementById("careerbot-ask-btn");
  const careerbotChatWindow = document.getElementById("careerbot-chat-window");
  // requirement 6
  const generateSummaryBtn = document.getElementById("generate-summary-btn");
  const summaryStatus = document.getElementById("summary-status");
  // --- 2. Helper Functions ---

  /**
   * The "Router"
   * Hides all views, then shows the one we want.
   * Updates the active tab in the navbar.
   * @param {string} viewName - The key of the view to show (e.g., 'login', 'dashboard')
   */
  function showView(viewName) {
    // Hide all views
    for (let key in views) {
      if (views[key]) {
        views[key].classList.remove("active-view");
      }
    }
    // Show the one we want
    if (views[viewName]) {
      views[viewName].classList.add("active-view");
    }

    // Update active nav links
    const isLoggedIn = !!localStorage.getItem("token");
    const navId = isLoggedIn ? "nav-logged-in" : "nav-logged-out";
    const activeNav = document.getElementById(navId);

    if (activeNav) {
      // Remove 'active' from all links
      activeNav
        .querySelectorAll("a")
        .forEach((a) => a.classList.remove("active"));

      // Add 'active' to the correct link
      let activeLink;
      switch (viewName) {
        case "dashboard":
          activeLink = document.getElementById("nav-dashboard");
          break;
        case "jobs":
          activeLink = isLoggedIn
            ? document.getElementById("nav-jobs-private")
            : document.getElementById("nav-jobs-public");
          break;
        case "resources":
          activeLink = isLoggedIn
            ? document.getElementById("nav-resources-private")
            : document.getElementById("nav-resources-public");
          break;
        case "profile":
          activeLink = document.getElementById("nav-profile");
          break;
        case "login":
        case "signup":
          activeLink = document.getElementById("nav-login");
          break;
      }
      if (activeLink) {
        activeLink.classList.add("active");
      }
    }
  }

  /**
   * Helper to make secure API calls
   * Automatically adds the 'Authorization' token to the request header
   * @param {string} url - The API endpoint
   * @param {object} options - The fetch options (e.g., method, body)
   * @returns {Promise} - The fetch promise
   */
  async function fetchWithAuth(url, options = {}) {
    const token = localStorage.getItem("token");

    // Ensure headers object exists
    options.headers = options.headers || {};

    // Add auth token if we have one
    if (token) {
      options.headers["Authorization"] = `Bearer ${token}`;
    }

    // Add content-type if a body is present
    if (options.body) {
      options.headers["Content-Type"] = "application/json";
    }

    return fetch(API_URL + url, options);
  }

  /**
   * Shows the "Logged In" state (nav bar) and loads dashboard data
   */
  function showLoggedInState() {
    navLoggedIn.style.display = "flex";
    navLoggedOut.style.display = "none";
    // When we log in, always go to the dashboard
    showView("dashboard");
    loadDashboardData();
  }

  /**
   * Shows the "Logged Out" state (nav bar) and shows the login page
   */
  function showLoggedOutState() {
    navLoggedIn.style.display = "none";
    navLoggedOut.style.display = "flex";
    localStorage.removeItem("token"); // Clear the token
    showView("login");
  }

  /**
   * (NEW) Generates HTML for a single job item
   * @param {object} job - The job data from the API
   * @param {boolean} showMatchPercent - (Req 2) If true, shows the match score bar
   * @returns {string} - The HTML string for the job
   */
  function generateJobHTML(job, showMatchPercent = false) {
    let skillsHTML = "";
    if (job.required_skills) {
      skillsHTML = job.required_skills
        .split(",")
        .map((skill) => `<span class="skill-tag">${skill.trim()}</span>`)
        .join("");
    }

    // --- NEW (Req 2) Match Percentage UI ---
    let matchHTML = "";
    if (showMatchPercent) {
      const { matchPercent, matches, missing, recommendedResources } = job;

      // Determine progress bar color
      let barColorClass = "low";
      if (matchPercent > 70) barColorClass = "high";
      else if (matchPercent > 40) barColorClass = "medium";

      matchHTML = `
                <div class="match-score">
                    <div class="match-score-header">
                        <strong>Match Score: ${matchPercent}%</strong>
                        <span class="match-score-bar ${barColorClass}" style="width: ${matchPercent}%"></span>
                    </div>
                    <div class="match-details">
            `;

      if (matches && matches.length > 0) {
        matchHTML += `<p class="match-skills"><strong>Matches:</strong> ${matches.join(
          ", "
        )}</p>`;
      }
      if (missing && missing.length > 0) {
        matchHTML += `<p class="missing-skills"><strong>Missing:</strong> ${missing.join(
          ", "
        )}</p>`;

        // --- NEW (Req 3) Skill Gap UI ---
        if (recommendedResources && recommendedResources.length > 0) {
          matchHTML += `
                        <div class="skill-gap-recommendations">
                            <strong>Skill Gap:</strong> We recommend these resources:
                            <ul>
                                ${recommendedResources
                                  .map(
                                    (res) => `
                                    <li>
                                        <a href="${res.url}" target="_blank">${res.title}</a> (${res.platform})
                                    </li>
                                `
                                  )
                                  .join("")}
                            </ul>
                        </div>
                    `;
        }
        // --- End of New (Req 3) ---
      }

      matchHTML += `</div></div>`;
    }
    // --- End of new UI ---

    return `
            <div class="list-item">
                <div class="item-header">
                    <h3>${job.job_title}</h3>
                    <span>${job.location} | ${job.job_type}</span>
                </div>
                <p class="item-company">${job.company} (Exp: ${
      job.experience_level
    })</p>
                <div class="item-tags">
                    ${skillsHTML}
                </div>
                ${matchHTML} <!-- This will be empty if showMatchPercent is false -->
                <a href="https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(
                  job.job_title
                )} ${encodeURIComponent(
      job.company
    )}" target="_blank" class="apply-link">
                    Search on LinkedIn
                </a>
            </div>
        `;
  }

  /**
   * Generates HTML for a single resource item
   * @param {object} resource - The resource data from the API
   * @param {boolean} showMatchCount - If true, shows a "Recommended" tag
   * @returns {string} - The HTML string for the resource
   */
  function generateResourceHTML(resource, showMatchCount = false) {
    let skillsHTML = "";
    if (resource.related_skills) {
      skillsHTML = resource.related_skills
        .split(",")
        .map((skill) => `<span class="skill-tag">${skill.trim()}</span>`)
        .join("");
    }

    // Show a "Recommended" tag if it's on the dashboard
    let matchHTML = "";
    if (showMatchCount && resource.matchCount > 0) {
      matchHTML = `<div class="item-matches">
                            <span class="skill-tag-match">Recommended for You</span>
                         </div>`;
    }

    return `
            <div class="list-item">
                <div class="item-header">
                    <h3><a href="${resource.url}" target="_blank">${resource.title}</a></h3>
                    <span>${resource.platform} | ${resource.cost_indicator}</span>
                </div>
                <div class="item-tags">
                    ${skillsHTML}
                </div>
                ${matchHTML}
            </div>
        `;
  }

  /**
   * Shows a temporary success message on the profile page
   * @param {string} message - The message to show
   */
  function showProfileSuccess(message) {
    profileSuccess.textContent = message;
    profileSuccess.style.display = "block";
    // ... (rest of the function) ...
    setTimeout(() => {
      profileSuccess.style.display = "none";
    }, 3000);
  }

  /**
   * Shows a temporary error message on the profile page
   * @param {string} message - The message to show
   */
  function showProfileError(message) {
    profileSuccess.textContent = message;
    profileSuccess.style.display = "block";
    profileSuccess.style.backgroundColor = "var(--error-light)";
    profileSuccess.style.color = "var(--error-color)";
    profileSuccess.style.border = "1px solid var(--error-color)";

    setTimeout(() => {
      profileSuccess.style.display = "none";
    }, 3000); // Hide after 3 seconds
  }

  // --- 3. Data Loading Functions (API Calls) ---

  /**
   * (Req 6) Load all data for the dashboard
   */
  async function loadDashboardData() {
    const jobsList = document.getElementById("dash-jobs-list");
    const resourcesList = document.getElementById("dash-resources-list");
    const dashName = document.getElementById("dash-name");
    const dashTrack = document.getElementById("dash-track");
    const dashEmail = document.getElementById("dash-email");
    const dashSkills = document.getElementById("dash-skills");

    try {
      const response = await fetchWithAuth("/dashboard");
      if (!response.ok) {
        // If token is bad, log them out
        if (response.status === 401 || response.status === 403) {
          showLoggedOutState();
        }
        throw new Error("Failed to load dashboard data");
      }
      const data = await response.json();

      // 1. Load Profile Quick View
      dashName.textContent = data.user.name || "User";
      dashTrack.textContent = data.user.track || "No track selected";
      dashEmail.textContent = data.user.email || "No email";
      dashSkills.innerHTML =
        data.user.skills.length > 0
          ? data.user.skills.map((skill) => `<li>${skill}</li>`).join("")
          : "<li>No skills added yet.</li>";

      // 2. Load Recommended Jobs (Req 5, Req 2, Req 3)
      jobsList.innerHTML =
        data.jobs.length > 0
          ? data.jobs.map((job) => generateJobHTML(job, true)).join("") // Pass 'true' to show match score
          : "<p>No job recommendations found. Try adding more skills to your profile!</p>";

      // 3. Load Recommended Resources (Req 5)
      resourcesList.innerHTML =
        data.resources.length > 0
          ? data.resources
              .map((res) => generateResourceHTML(res, true))
              .join("")
          : "<p>No learning recommendations found. Add skills to get started!</p>";
    } catch (err) {
      console.error("Error loading dashboard:", err);
      jobsList.innerHTML =
        '<p class="error-message" style="display:block;">Error loading recommendations.</p>';
      resourcesList.innerHTML =
        '<p class="error-message" style="display:block;">Error loading recommendations.</p>';
    }
  }

  /**
   * (Req 2) Load user's data into the Profile forms
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

      // Populate Details Form
      document.getElementById("profile-name").value = data.full_name || "";
      document.getElementById("profile-email").value = data.email || "";
      document.getElementById("profile-education").value =
        data.education_level || "";
      document.getElementById("profile-level").value =
        data.experience_level || "Fresher";
      document.getElementById("profile-track").value =
        data.career_track || "Web Development";
      document.getElementById("profile-roles").value = data.target_roles || "";

      // Populate Skills & CV Forms
      document.getElementById("profile-skills").value = data.skills || "";
      document.getElementById("profile-experience").value =
        data.experience_notes || "";
      document.getElementById("profile-cv").value = data.cv_text || "";
    } catch (err) {
      console.error("Error loading profile data:", err);
    }
  }

  /**
   * (Req 3) Load all jobs for the Jobs page
   */
  async function loadJobsPage(filters = {}) {
    const jobsListContainer = document.getElementById("jobs-list-container");
    jobsListContainer.innerHTML = "<p>Loading jobs...</p>";

    // Build query string from filters
    const params = new URLSearchParams();
    if (filters.title) params.append("title", filters.title);
    if (filters.location) params.append("location", filters.location);
    if (filters.type) params.append("type", filters.type);
    const queryString = params.toString();

    try {
      // We use fetchWithAuth to get personalized match scores
      const response = await fetchWithAuth(`/jobs?${queryString}`);
      if (!response.ok) {
        if (response.status === 401 || response.status === 403)
          showLoggedOutState();
        throw new Error("Failed to load jobs");
      }
      const jobs = await response.json();

      // We pass 'true' to show the match score on this page too
      jobsListContainer.innerHTML =
        jobs.length > 0
          ? jobs.map((job) => generateJobHTML(job, true)).join("")
          : "<p>No jobs found matching your criteria.</p>";
    } catch (err) {
      console.error("Error loading jobs:", err);
      jobsListContainer.innerHTML =
        '<p class="error-message" style="display:block;">Error loading jobs. Are you logged in?</p>';
    }
  }

  /**
   * (Req 4) Load all resources for the Resources page
   */
  async function loadResourcesPage() {
    const resourcesListContainer = document.getElementById(
      "resources-list-container"
    );
    resourcesListContainer.innerHTML = "<p>Loading resources...</p>";

    try {
      // No auth needed, this is a public route
      const response = await fetch(API_URL + "/resources");
      if (!response.ok) throw new Error("Failed to load resources");

      const resources = await response.json();

      resourcesListContainer.innerHTML =
        resources.length > 0
          ? resources.map((res) => generateResourceHTML(res, false)).join("") // Pass 'false'
          : "<p>No resources found.</p>";
    } catch (err) {
      console.error("Error loading resources:", err);
      resourcesListContainer.innerHTML =
        '<p class="error-message" style="display:block;">Error loading resources.</p>';
    }
  }

  // --- 4. Event Listeners (Navigation) ---

  // Logged-Out Nav
  navLinks.logo.addEventListener("click", (e) => {
    e.preventDefault();
    // If logged in, go to dashboard, else go to login
    if (localStorage.getItem("token")) {
      showView("dashboard");
    } else {
      showView("login");
    }
  });
  navLinks.publicJobs.addEventListener("click", (e) => {
    e.preventDefault();
    showView("jobs");
    loadJobsPage(); // Need to call this, but it will fail if not logged in
  });
  navLinks.publicResources.addEventListener("click", (e) => {
    e.preventDefault();
    showView("resources");
    loadResourcesPage();
  });
  navLinks.login.addEventListener("click", (e) => {
    e.preventDefault();
    showView("login");
  });
  navLinks.gotoSignup.addEventListener("click", (e) => {
    e.preventDefault();
    showView("signup");
  });
  navLinks.gotoLogin.addEventListener("click", (e) => {
    e.preventDefault();
    showView("login");
  });

  // Logged-In Nav
  navLinks.dashboard.addEventListener("click", (e) => {
    e.preventDefault();
    showView("dashboard");
    loadDashboardData();
  });
  navLinks.privateJobs.addEventListener("click", (e) => {
    e.preventDefault();
    showView("jobs");
    loadJobsPage();
  });
  navLinks.privateResources.addEventListener("click", (e) => {
    e.preventDefault();
    showView("resources");
    loadResourcesPage();
  });
  navLinks.profile.addEventListener("click", (e) => {
    e.preventDefault();
    showView("profile");
    loadProfileData();
  });
  navLinks.logout.addEventListener("click", (e) => {
    e.preventDefault();
    showLoggedOutState();
  });

  // --- 5. Event Listeners (Forms) ---

  // (Req 1) Login Form
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      loginError.style.display = "none"; // Hide old errors

      const email = document.getElementById("login-email").value;
      const password = document.getElementById("login-pass").value;

      try {
        const response = await fetch(API_URL + "/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Login failed");
        }

        // SUCCESS! Save token and show dashboard
        localStorage.setItem("token", data.token);
        showLoggedInState();
      } catch (err) {
        loginError.textContent = err.message;
        loginError.style.display = "block";
      }
    });
  }

  // (Req 1) Signup Form
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      signupError.style.display = "none";

      // Get all values
      const formData = {
        fullName: document.getElementById("signup-name").value,
        email: document.getElementById("signup-email").value,
        password: document.getElementById("signup-pass").value,
        education: document.getElementById("signup-education").value,
        experience: document.getElementById("signup-level").value,
        track: document.getElementById("signup-track").value,
      };

      try {
        const response = await fetch(API_URL + "/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Signup failed");
        }

        // SUCCESS! Show login page
        alert("Sign up successful! Please log in."); // Simple alert
        showView("login");
      } catch (err) {
        signupError.textContent = err.message;
        signupError.style.display = "block";
      }
    });
  }

  // (Req 2) Profile Forms (combining all 3)
  // We will save all 3 forms with one API call for simplicity
  if (profileDetailsForm) {
    profileDetailsForm.addEventListener("submit", handleProfileSave);
  }
  if (profileSkillsForm) {
    profileSkillsForm.addEventListener("submit", handleProfileSave);
  }
  if (profileCvForm) {
    profileCvForm.addEventListener("submit", handleProfileSave);
  }

  async function handleProfileSave(e) {
    e.preventDefault(); // Stop form from submitting

    // Collect all data from all forms
    const profileData = {
      // Details
      fullName: document.getElementById("profile-name").value,
      email: document.getElementById("profile-email").value,
      education: document.getElementById("profile-education").value,
      level: document.getElementById("profile-level").value,
      track: document.getElementById("profile-track").value,
      roles: document.getElementById("profile-roles").value,
      // Skills/Exp
      skills: document.getElementById("profile-skills").value,
      experience: document.getElementById("profile-experience").value,
      // CV
      cv_text: document.getElementById("profile-cv").value,
    };

    try {
      const response = await fetchWithAuth("/profile", {
        method: "POST",
        body: JSON.stringify(profileData), // All data sent at once
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.message);

      // Success!
      showProfileSuccess("Profile updated successfully!");
      // Reload dashboard data in background to update header
      loadDashboardData();
    } catch (err) {
      console.error("Error saving profile:", err);
      showProfileError(err.message || "Failed to save profile");
    }
  }

  ////injected by me
  // (Req 1.Part2) AI CV Analysis Button
  if (analyzeCvBtn) {
    analyzeCvBtn.addEventListener("click", async () => {
      const cv_text = document.getElementById("profile-cv").value;
      if (!cv_text.trim()) {
        alert("Please paste your CV text into the box first.");
        return;
      }

      // Show loading message
      analyzeCvStatus.textContent = "Analyzing... this may take a moment.";
      analyzeCvStatus.style.display = "block";
      analyzeCvBtn.disabled = true;

      try {
        const response = await fetchWithAuth("/profile/analyze-cv", {
          method: "POST",
          body: JSON.stringify({ cv_text: cv_text }),
        });

        // Inside the 'try' block:
        if (response.status === 403 || response.status === 401) {
          // The security guard kicked us out, no need to read JSON
          throw new Error("Access denied. Please log out and log back in.");
        }

        const data = await response.json(); // Now this should only run if the status is OK (200)

        if (!response.ok) {
          // Handle a 500 error that returned JSON
          throw new Error(
            data.message || "Analysis failed (Internal Server Error)."
          );
        }
        // ...

        // SUCCESS! Update the profile form fields
        document.getElementById("profile-skills").value = data.skills;
        document.getElementById("profile-roles").value = data.roles;

        // Show success message
        analyzeCvStatus.textContent =
          "Analysis complete! Your skills and roles have been updated. Remember to save!";
      } catch (err) {
        console.error("CV Analysis error:", err);
        analyzeCvStatus.textContent = `Error: ${err.message}`;
      } finally {
        // Re-enable button
        analyzeCvBtn.disabled = false;
      }
    });
  }

  // (Req 3) Job Filter
  if (jobFilterBtn) {
    jobFilterBtn.addEventListener("click", () => {
      ///changed by me
      const filters = {
        title: document.getElementById("job-search-title").value,
        location: document.getElementById("job-search-location").value,
        type: document.getElementById("job-search-type").value,
      };
      loadJobsPage(filters);
    });
  }

  // (Req 4) AI Roadmap Generation Form
  if (roadmapForm) {
    roadmapForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const targetRole = document.getElementById("roadmap-target-role").value;
      const timeframe = document.getElementById("roadmap-timeframe").value;

      // Get current skills from the profile data (assuming loadDashboardData ran)
      const currentSkills = document.getElementById("dash-skills").textContent;

      try {
        // 1. Show status
        roadmapStatus.textContent = "Generating roadmap... please wait.";
        roadmapStatus.style.display = "block";
        roadmapOutput.innerHTML = "<p>Processing request with AI...</p>";

        // 2. Send request to the backend
        const response = await fetchWithAuth("/roadmap", {
          method: "POST",
          body: JSON.stringify({
            targetRole,
            timeframe,
            currentSkills,
          }),
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Roadmap generation failed.");
        }

        // 3. Display successful roadmap
        // Replace the raw <pre> tag with the new HTML renderer:
        roadmapOutput.innerHTML = renderRoadmap(data.roadmap);
        roadmapStatus.textContent = "Roadmap generated successfully!";
      } catch (err) {
        roadmapOutput.innerHTML = `<p class="error-message">Error: ${err.message}</p>`;
        roadmapStatus.textContent = "Failed to generate roadmap.";
      } finally {
        // Re-enable button after 5 seconds
        setTimeout(() => (roadmapStatus.style.display = "none"), 5000);
      }
    });
  }

  // (Req 5) CareerBot Assistant Logic
  if (careerbotAskBtn) {
    careerbotAskBtn.addEventListener("click", async () => {
      const userQuery = careerbotInput.value.trim();

      if (userQuery === "") return;

      // 1. Display user message immediately
      careerbotChatWindow.innerHTML += `<div class="chat-message user-message"><p><strong>You:</strong> ${userQuery}</p></div>`;
      careerbotChatWindow.innerHTML += `<div class="chat-message bot-message" id="bot-typing"><span>Bot: </span><span class="typing-indicator">...</span></div>`;
      careerbotInput.value = ""; // Clear the input field

      // 2. Scroll to the bottom of the chat window
      careerbotChatWindow.scrollTop = careerbotChatWindow.scrollHeight;

      try {
        // Send request to the backend
        const response = await fetchWithAuth("/chatbot", {
          method: "POST",
          body: JSON.stringify({ query: userQuery }),
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Bot service failed.");
        }

        // 3. Update the last message with the bot's response
        const typingIndicator = document.getElementById("bot-typing");
        typingIndicator.remove(); // Remove the "typing..." indicator

        careerbotChatWindow.innerHTML += `<div class="chat-message bot-message"><p><strong>Mentor:</strong> ${data.response}</p><p class="bot-disclaimer">${data.disclaimer}</p></div>`;
      } catch (err) {
        const typingIndicator = document.getElementById("bot-typing");
        if (typingIndicator) typingIndicator.remove();

        careerbotChatWindow.innerHTML += `<div class="chat-message error-message"><p><strong>Mentor:</strong> Error: ${err.message}</p></div>`;
      } finally {
        careerbotChatWindow.scrollTop = careerbotChatWindow.scrollHeight;
      }
    });
  }

  // (Req 6) CV Summary Assistant Logic
  if (generateSummaryBtn) {
    generateSummaryBtn.addEventListener("click", async () => {
      // We use the existing skills and experience text areas as input
      const currentSkills = document.getElementById("profile-skills").value;
      const currentExperience =
        document.getElementById("profile-experience").value;

      if (currentSkills.trim() === "" && currentExperience.trim() === "") {
        alert(
          "Please add some skills or experience notes first to generate a summary."
        );
        return;
      }

      try {
        // 1. Show status
        summaryStatus.textContent = "Generating summary...";
        summaryStatus.style.display = "block";
        generateSummaryBtn.disabled = true;

        // 2. Send request to the backend
        const response = await fetchWithAuth("/profile/summarize", {
          method: "POST",
          body: JSON.stringify({
            skills: currentSkills,
            experience: currentExperience,
          }),
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Summary generation failed.");
        }

        // 3. SUCCESS! Insert the generated text into the profile experience box
        // This allows the user to edit it before saving
        document.getElementById("profile-experience").value = data.summary;
        summaryStatus.textContent =
          "Summary generated successfully! Remember to save.";
      } catch (err) {
        summaryStatus.textContent = `Error: ${err.message}`;
        console.error("Summary Assistant Error:", err);
      } finally {
        generateSummaryBtn.disabled = false;
        setTimeout(() => (summaryStatus.style.display = "none"), 5000);
      }
    });
  }

  // --- 6. Initial App Load ---

  // Check if we are already logged in
  const initialToken = localStorage.getItem("token");
  if (initialToken) {
    // We are logged in. Show the dashboard.
    // We could (and should) verify the token with the server,
    // but for a hackathon, this is a fast and simple check.
    showLoggedInState();
  } else {
    // We are logged out. Show the login page.
    showLoggedOutState();

    // Since we are logged out, load the public resources
    // on the resources page by default.
    loadResourcesPage();
  }
});
