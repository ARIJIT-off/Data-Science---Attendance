# UEMK Datascience Attendance Management System

A secure web-based attendance tracking application designed for the Computer Science and Engineering (Data Science) department of UEM Kolkata. It features role-specific dashboards for Administrators, Teachers, and Students.

## Key Features

### Admin Portal
- Dashboard stats (Total Students, Total Teachers, Total Classes, Overall Attendance Percentage).
- Student-wise attendance log with sorting, search filters, and visual alert levels (under 75% indicator).
- Teacher activity summaries.
- Detailed visual log of all past attendance sessions.
- Downloadable Excel reports.

### Teacher Portal
- Roster-based manual attendance logging.
- Interactive session generation (QR codes and Web Links) scoped specifically to Year, Section, and Semester.
- Session activity records showing student attendance details.
- Secure email OTP login.

### Student Portal
- Direct secure login via Enrollment Number and Class Roll Number.
- Circular SVG progress indicators displaying overall attendance stats.
- Subject-wise attendance summary.
- Date-wise logs showing detailed history.
- Verification checks preventing students from signing attendance sessions outside their registered Year and Section.

## Tech Stack
- Backend: Node.js, Express
- Storage: Local File System (JSON for active session storage, Excel for student and teacher roster indexing)
- Frontend: HTML5, Vanilla CSS3, Javascript
- Authentication: Nodemailer SMTP email OTP (for Admin and Teacher roles)

## Local Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/ARIJIT-off/UEMK-Datascience-Attendance.git
   cd UEMK-Datascience-Attendance
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Update SMTP credentials in the `mailmain.xlsx` file located in the root directory. Ensure the document includes:
   - A field labeled "Email Address" containing the sender email.
   - A field labeled "App Password" containing your Google App Password.

4. Start the server:
   ```bash
   npm start
   ```
   The local application will run on http://localhost:3000

## File and Roster Configurations
- `student_list passout 2028.xlsx`: Expected layout containing student information (Name, Class Roll, Enrollment Number, Year, Section, Email).
- `mailmain.xlsx`: Contains the active email sender credentials.
- `sessions_data.json`: Persists current attendance records and active QR/Link session data.

## Deployment Guidelines

### MongoDB Atlas (recommended for Railway)

The app supports MongoDB Atlas for persistent storage. Without it, attendance records are written to local JSON files that are wiped on every Railway redeploy (ephemeral filesystem). To connect Atlas:

1. Create a free cluster at [cloud.mongodb.com](https://cloud.mongodb.com).
2. Under **Database Access**, create a DB user with a strong password.
3. Under **Network Access**, allow connections from anywhere (`0.0.0.0/0`) so Railway's dynamic IPs are accepted.
4. Click your cluster → **Connect** → **Drivers**, copy the connection string, and replace `<password>` with your DB user's password.
5. In Railway, open your service → **Settings → Variables** and add:
   ```
   MONGODB_URI = mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/uemk_attendance?retryWrites=true&w=majority&appName=Cluster0
   ```
6. Redeploy — the server will log `Connected to MongoDB Atlas successfully.` on startup.

If `MONGODB_URI` is not set, the app automatically falls back to local JSON files (suitable for local development only).

### Hosting options

Because this application can store roster records and logs locally on the filesystem, standard ephemeral hosting options (like serverless Vercel or Heroku) will wipe database logs when the server restarts unless MongoDB Atlas is configured.

- **Railway**: Deploy from Git, set `MONGODB_URI` as a service variable (see above). No persistent volume needed when Atlas is configured.
- **Render**: Deploy from Git and set `MONGODB_URI` in the environment variables dashboard, or configure a Persistent Disk mapped to the root workspace.
- **Replit**: Supports permanent workspaces and simple setup. Import the repository directly and click Run.
- **VPS (Virtual Private Server)**: Set up Node.js with PM2 and Nginx reverse proxy.
