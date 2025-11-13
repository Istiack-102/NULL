-- Req 1 & 2: Users Table
-- This stores all user info, including their profile data
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL, -- We store a "hash" (scrambled password) for security
    education_level VARCHAR(255),
    experience_level VARCHAR(50),
    career_track VARCHAR(100),
    
    -- Req 2 fields
    skills TEXT, -- We'll store this as comma-separated text: "JavaScript,HTML,React"
    experience_notes TEXT, -- For project descriptions
    target_roles TEXT, -- "Frontend Developer, UI/UX Designer"
    cv_text LONGTEXT -- For pasting the whole CV
);

-- Req 3: Jobs Table
-- This stores all the job opportunities
CREATE TABLE jobs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    job_title VARCHAR(255) NOT NULL,
    company VARCHAR(255),
    location VARCHAR(100),
    required_skills TEXT, -- "JavaScript,React,Node.js"
    experience_level VARCHAR(50), -- "Fresher", "Junior"
    job_type VARCHAR(50) -- "Internship", "Full-time"
);

-- Req 4: Resources Table
-- This stores all the learning resources
CREATE TABLE resources (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    platform VARCHAR(100), -- "YouTube", "Coursera"
    url VARCHAR(512),
    related_skills TEXT, -- "HTML,CSS"
    cost_indicator VARCHAR(50) -- "Free", "Paid"
);