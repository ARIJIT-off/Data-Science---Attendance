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
Because this application stores roster records and logs locally on the filesystem, standard ephemeral hosting options (like serverless Vercel or Heroku) will wipe database logs when the server restarts.

When deploying, choose an option that supports file persistence:
- **Replit**: Supports permanent workspaces and simple setup. Import the repository directly and click Run.
- **Railway/Render**: Deploy from Git and configure a Persistent Volume mapped to the root workspace.
- **VPS (Virtual Private Server)**: Set up Node.js with PM2 and Nginx reverse proxy.
