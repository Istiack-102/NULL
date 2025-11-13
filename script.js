// This script now handles the full login/logout flow and connects to the backend.

document.addEventListener("DOMContentLoaded", () => {
  // --- 1. Get All Elements ---

  // The base URL of our backend server
  const API_URL = "http://localhost:3001";

  // All page sections (views)
  const views = {
    login: document.getElementById("login-view"),
    signup: document.getElementById("signup-view"),
    dashboard: document.getElementById("dashboard-view"),
    profile: document.getElementById("profile-view"),
    jobs: document.getElementById("jobs-view"),
    resources: document.getElementById("resources-view"),
  };

  // Navbars
  const navLoggedOut = document.getElementById("nav-logged-out");
  const navLoggedIn = document.getElementById("nav-logged-in");

  // All navigation links
  const navLinks = {
    logo: document.getElementById("logo-link"),
    jobsPublic: document.getElementById("nav-jobs-public"),
    resourcesPublic: document.getElementById("nav-resources-public"),
    login: document.getElementById("nav-login"),
    dashboard: document.getElementById("nav-dashboard"),
    jobsPrivate: document.getElementById("nav-jobs-private"),
    resourcesPrivate: document.getElementById("nav-resources-private"),
    profile: document.getElementById("nav-profile"),
    logout: document.getElementById("nav-logout"),
    gotoSignup: document.getElementById("goto-signup-link"),
    gotoLogin: document.getElementById("goto-login-link"),
  };

  // Forms
  const loginForm = document.getElementById("login-form");
  const signupForm = document.getElementById("signup-form");
  const profileDetailsForm = document.getElementById("profile-details-form");
  const profileSkillsForm = document.getElementById("profile-skills-form");
  const profileCvForm = document.getElementById("profile-cv-form");

  // Error message displays
  const loginError = document.getElementById("login-error");
  const signupError = document.getElementById("signup-error");
  const profileSuccess = document.getElementById("profile-success");

  // --- 2. Helper Functions ---

  /**
   * A helper for making authenticated API calls
   * @param {string} url - The API endpoint (e.g., '/dashboard')
   * @param {string} method - 'GET', 'POST', etc.
   * @param {object} body - The JSON body for POST requests
   * @returns {Promise<object>} - The JSON response
   */
  async function apiCall(url, method = "GET", body = null) {
    const token = localStorage.getItem("token");
    if (!token) {
      showLoggedOutState();
      throw new Error("No token found, user logged out.");
    }

    const options = {
      method: method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_URL}${url}`, options);

    if (response.status === 401) {
      // Token expired or invalid
      showLoggedOutState();
      throw new Error("Token invalid, user logged out.");
    }

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || "API call failed");
    }

    return response.json();
  }

  /**
   * Hides all views and shows the one with the specified ID.
   */
  function showView(viewId) {
    for (let key in views) {
      if (views[key]) views[key].classList.remove("active-view");
    }
    if (views[viewId]) views[viewId].classList.add("active-view");
    updateActiveNav(viewId);
  }

  /**
   * Updates the navbar to show which link is currently active.
   */
  function updateActiveNav(viewId) {
    document
      .querySelectorAll(".nav-links a")
      .forEach((a) => a.classList.remove("active"));

    switch (viewId) {
      case "login":
      case "signup":
        if (navLinks.login) navLinks.login.classList.add("active");
        break;
      case "jobs":
        if (navLinks.jobsPublic) navLinks.jobsPublic.classList.add("active");
        if (navLinks.jobsPrivate) navLinks.jobsPrivate.classList.add("active");
        break;
      case "resources":
        if (navLinks.resourcesPublic)
          navLinks.resourcesPublic.classList.add("active");
        if (navLinks.resourcesPrivate)
          navLinks.resourcesPrivate.classList.add("active");
        break;
      case "dashboard":
        if (navLinks.dashboard) navLinks.dashboard.classList.add("active");
        break;
      case "profile":
        if (navLinks.profile) navLinks.profile.classList.add("active");
        break;
    }
  }

  /**
   * Hides logged-out UI and shows logged-in UI.
   */
  function showLoggedInState() {
    if (navLoggedOut) navLoggedOut.style.display = "none";
    if (navLoggedIn) navLoggedIn.style.display = "flex";
    loadDashboardData();
    showView("dashboard");
  }

  /**
   * Hides logged-in UI and shows logged-out UI.
   */
  function showLoggedOutState() {
    if (navLoggedIn) navLoggedIn.style.display = "none";
    if (navLoggedOut) navLoggedOut.style.display = "flex";
    localStorage.removeItem("token");
    showView("login");
  }

  /**
   * A helper to show error/success messages on forms
   */
  function showMessage(el, message, isError = true) {
    if (!el) return;
    el.textContent = message;
    el.style.display = "block";
    el.style.color = isError ? "var(--error-color)" : "var(--success-color)";
    el.style.backgroundColor = isError
      ? "var(--error-light)"
      : "var(--success-light)";
    el.style.borderColor = isError
      ? "var(--error-color)"
      : "var(--success-color)";

    // Hide message after 3 seconds
    setTimeout(() => {
      el.style.display = "none";
    }, 3000);
  }

  // --- 3. Page-Specific Data Loaders ---

  // Req 6: Load Dashboard Data
  async function loadDashboardData() {
    try {
      const data = await apiCall("/dashboard");

      // Populate profile quick view (Req 6a)
      document.getElementById("dash-name").textContent = data.user.full_name;
      document.getElementById("dash-track").textContent =
        data.user.career_track;
      document.getElementById("dash-email").textContent = data.user.email;

      // Populate skills list
      const skillsList = document.getElementById("dash-skills");
      skillsList.innerHTML = ""; // Clear "Loading..."
      const skills = (data.user.skills || "").split(",").filter(Boolean);
      if (skills.length > 0) {
        skills.forEach((skill) => {
          skillsList.innerHTML += `<li>${skill}</li>`;
        });
      } else {
        skillsList.innerHTML = "<li>No skills added yet.</li>";
      }

      // Populate recommended jobs (Req 6b)
      const jobsContainer = document.getElementById("dash-jobs-list");
      jobsContainer.innerHTML = "";
      if (data.recommendedJobs.length > 0) {
        data.recommendedJobs.forEach((job) => {
          jobsContainer.innerHTML += generateJobHTML(job, true); // true = show match
        });
      } else {
        jobsContainer.innerHTML =
          "<p>No job recommendations match your skills yet.</p>";
      }

      // Populate recommended resources (Req 6c)
      const resContainer = document.getElementById("dash-resources-list");
      resContainer.innerHTML = "";
      if (data.recommendedResources.length > 0) {
        data.recommendedResources.forEach((res) => {
          resContainer.innerHTML += generateResourceHTML(res, true); // true = show match
        });
      } else {
        resContainer.innerHTML =
          "<p>No resource recommendations match your skills yet.</p>";
      }
    } catch (error) {
      console.error("Error loading dashboard:", error.message);
      // User is logged out by apiCall if token is bad
    }
  }

  // Req 2: Load Profile Data
  async function loadProfileData() {
    try {
      const data = await apiCall("/profile");

      // Populate details form
      document.getElementById("profile-name").value = data.full_name || "";
      document.getElementById("profile-email").value = data.email || "";
      document.getElementById("profile-education").value =
        data.education_level || "";
      document.getElementById("profile-level").value =
        data.experience_level || "Fresher";
      document.getElementById("profile-track").value =
        data.career_track || "Web Development";
      document.getElementById("profile-roles").value = data.target_roles || "";

      // Populate skills/experience form
      document.getElementById("profile-skills").value = data.skills || "";
      document.getElementById("profile-experience").value =
        data.experience_notes || "";

      // Populate CV form
      document.getElementById("profile-cv").value = data.cv_text || "";
    } catch (error) {
      console.error("Error loading profile:", error.message);
    }
  }

  // Req 3: Load All Jobs
  async function loadJobsPage() {
    const container = document.getElementById("jobs-list-container");
    container.innerHTML = "<p>Loading jobs...</p>";

    // Get filter values
    const title = document.getElementById("job-search-title").value;
    const location = document.getElementById("job-search-location").value;
    const type = document.getElementById("job-search-type").value;

    // Build query string
    const params = new URLSearchParams();
    if (title) params.append("title", title);
    if (location) params.append("location", location);
    if (type) params.append("type", type);

    try {
      // No auth needed for this public route
      const response = await fetch(`${API_URL}/jobs?${params.toString()}`);
      const jobs = await response.json();

      container.innerHTML = ""; // Clear "Loading..."
      if (jobs.length > 0) {
        jobs.forEach((job) => {
          container.innerHTML += generateJobHTML(job, false); // false = don't show match
        });
      } else {
        container.innerHTML = "<p>No jobs found matching your criteria.</p>";
      }
    } catch (error) {
      console.error("Error loading jobs:", error.message);
      container.innerHTML = "<p>Error loading jobs.</p>";
    }
  }

  // Req 4: Load All Resources
  async function loadResourcesPage() {
    const container = document.getElementById("resources-list-container");
    container.innerHTML = "<p>Loading resources...</p>";
    try {
      // No auth needed
      const response = await fetch(`${API_URL}/resources`);
      const resources = await response.json();

      container.innerHTML = ""; // Clear "Loading..."
      if (resources.length > 0) {
        resources.forEach((res) => {
          container.innerHTML += generateResourceHTML(res, false); // false = don't show match
        });
      } else {
        container.innerHTML = "<p>No resources found.</p>";
      }
    } catch (error) {
      console.error("Error loading resources:", error.message);
      container.innerHTML = "<p>Error loading resources.</p>";
    }
  }

  // --- 4. HTML Generation Helpers ---

  function generateJobHTML(job, showMatch = false) {
    let matchHTML = "";
    if (showMatch && job.matches.length > 0) {
      matchHTML = `
                <div class="item-matches">
                    <p>Why recommended?</p>
                    <span class="skill-tag-match">Matches: ${job.matches.join(
                      ", "
                    )}</span>
                </div>
            `;
    }

    const skillsHTML = (job.required_skills || "")
      .split(",")
      .map((s) => `<span class="skill-tag">${s}</span>`)
      .join("");

    return `
            <article class="list-item">
                <div class="item-header">
                    <h3>${job.job_title}</h3>
                    <span>${job.job_type}, ${job.location}</span>
                </div>
                <p class="item-company">${job.company} (Level: ${job.experience_level})</p>
                <div class="item-tags">${skillsHTML}</div>
                ${matchHTML}
            </article>
        `;
  }

  function generateResourceHTML(resource, showMatch = false) {
    let matchHTML = "";
    if (showMatch && resource.matches.length > 0) {
      matchHTML = `
                <div class="item-matches">
                    <p>Why recommended?</p>
                    <span class="skill-tag-match">Matches: ${resource.matches.join(
                      ", "
                    )}</span>
                </div>
            `;
    }

    const skillsHTML = (resource.related_skills || "")
      .split(",")
      .map((s) => `<span class="skill-tag">${s}</span>`)
      .join("");

    return `
            <article class="list-item">
                <div class="item-header">
                    <h3><a href="${resource.url}" target="_blank">${resource.title}</a></h3>
                    <span>${resource.platform} (${resource.cost_indicator})</span>
                </div>
                <div class="item-tags">${skillsHTML}</div>
                 ${matchHTML}
            </article>
        `;
  }

  // --- 5. Event Listeners ---

  // Logo link
  navLinks.logo.addEventListener("click", (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    if (token) {
      showView("dashboard");
    } else {
      showView("login");
    }
  });

  // --- Auth page toggle links ---
  navLinks.gotoSignup.addEventListener("click", (e) => {
    e.preventDefault();
    showView("signup");
  });
  navLinks.gotoLogin.addEventListener("click", (e) => {
    e.preventDefault();
    showView("login");
  });

  // --- Logged-Out Nav Links ---
  navLinks.jobsPublic.addEventListener("click", (e) => {
    e.preventDefault();
    loadJobsPage();
    showView("jobs");
  });
  navLinks.resourcesPublic.addEventListener("click", (e) => {
    e.preventDefault();
    loadResourcesPage();
    showView("resources");
  });
  navLinks.login.addEventListener("click", (e) => {
    e.preventDefault();
    showView("login");
  });

  // --- Logged-In Nav Links ---
  navLinks.dashboard.addEventListener("click", (e) => {
    e.preventDefault();
    loadDashboardData();
    showView("dashboard");
  });
  navLinks.jobsPrivate.addEventListener("click", (e) => {
    e.preventDefault();
    loadJobsPage();
    showView("jobs");
  });
  navLinks.resourcesPrivate.addEventListener("click", (e) => {
    e.preventDefault();
    loadResourcesPage();
    showView("resources");
  });
  navLinks.profile.addEventListener("click", (e) => {
    e.preventDefault();
    loadProfileData();
    showView("profile");
  });
  navLinks.logout.addEventListener("click", (e) => {
    e.preventDefault();
    showLoggedOutState();
  });

  // --- Job Page Filter Button ---
  document.getElementById("job-filter-btn").addEventListener("click", (e) => {
    e.preventDefault();
    loadJobsPage(); // Reloads job page with filters
  });

  // --- 6. Handle Form Submissions (Login, Signup, Profile) ---

  // LOGIN FORM (Req 1)
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (loginError) loginError.style.display = "none";
      const email = document.getElementById("login-email").value;
      const password = document.getElementById("login-pass").value;

      try {
        const response = await fetch(`${API_URL}/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await response.json();
        if (!response.ok) {
          showMessage(loginError, data.message);
        } else {
          localStorage.setItem("token", data.token);
          showLoggedInState();
        }
      } catch (err) {
        console.error("Login fetch error:", err);
        showMessage(loginError, "Could not connect to server.");
      }
    });
  }

  // SIGNUP FORM (Req 1)
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (signupError) signupError.style.display = "none";
      const signupData = {
        fullName: document.getElementById("signup-name").value,
        email: document.getElementById("signup-email").value,
        password: document.getElementById("signup-pass").value,
        education: document.getElementById("signup-education").value,
        experience: document.getElementById("signup-level").value,
        track: document.getElementById("signup-track").value,
      };

      try {
        const response = await fetch(`${API_URL}/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(signupData),
        });
        const data = await response.json();
        if (!response.ok) {
          showMessage(signupError, data.message);
        } else {
          alert("Registration successful! Please log in.");
          showView("login");
        }
      } catch (err) {
        console.error("Signup fetch error:", err);
        showMessage(signupError, "Could not connect to server.");
      }
    });
  }

  // PROFILE FORMS (Req 2)
  if (profileDetailsForm) {
    profileDetailsForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = {
        details: {
          name: document.getElementById("profile-name").value,
          education: document.getElementById("profile-education").value,
          level: document.getElementById("profile-level").value,
          track: document.getElementById("profile-track").value,
          roles: document.getElementById("profile-roles").value,
        },
      };
      try {
        await apiCall("/profile", "POST", data);
        showMessage(profileSuccess, "Details updated!", false); // false = not an error
      } catch (err) {
        showMessage(profileSuccess, err.message, true);
      }
    });
  }

  if (profileSkillsForm) {
    profileSkillsForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = {
        skills: {
          skillsList: document.getElementById("profile-skills").value,
          experience: document.getElementById("profile-experience").value,
        },
      };
      try {
        await apiCall("/profile", "POST", data);
        showMessage(profileSuccess, "Skills & Experience updated!", false);
      } catch (err) {
        showMessage(profileSuccess, err.message, true);
      }
    });
  }

  if (profileCvForm) {
    profileCvForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = {
        cv: {
          text: document.getElementById("profile-cv").value,
        },
      };
      try {
        await apiCall("/profile", "POST", data);
        showMessage(profileSuccess, "CV/Notes updated!", false);
      } catch (err) {
        showMessage(profileSuccess, err.message, true);
      }
    });
  }

  // --- 7. Initial State ---
  const token = localStorage.getItem("token");
  if (token) {
    console.log("Token found, showing logged-in state.");
    showLoggedInState();
  } else {
    console.log("No token, showing logged-out state.");
    showLoggedOutState();
  }
});
