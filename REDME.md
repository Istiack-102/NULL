Career Platform Hackathon Project

This is a full-stack career platform built for a hackathon. It includes user authentication, job/resource listings, a user dashboard, and a non-AI recommendation engine.

Requirements

Node.js (v18 or higher)

XAMPP (or any other MySQL server)

1. Database Setup

Install and open XAMPP.

Start the Apache and MySQL services.

Go to the phpMyAdmin dashboard (http://localhost/phpmyadmin/).

Create a new database named hackathon_db.

Click on hackathon_db and go to the "SQL" tab.

Run the contents of setup.sql to create your tables.

(Optional) Run the contents of seed.sql to add 20+ example jobs and resources.

2. Backend Setup

Clone this project folder or download the files.

Open a terminal in the project's root directory (the one with package.json).

Install all the required packages (this reads your package.json file):

npm install

3. How to Run the Application

You must have two things running at all times:

Run the Backend:
In your terminal, run the server:

node server.Sjs

You should see Connected to MySQL database! and Server is running at http://localhost:3001.

Run the Frontend:
Find the index.html file in your project folder, right-click it, and choose "Open with" > "Google Chrome" (or your preferred browser).

The application is now running. You can register, log in, and use the site.
