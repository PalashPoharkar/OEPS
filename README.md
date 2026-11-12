# OEPS

Online Exam Proctoring System — a full-stack platform for conducting and monitoring online exams.

- **frontend/** – React (Vite) app with student, teacher, and admin dashboards, exam-taking UI, countdown/timer flow, and AI-assisted webcam proctoring (face detection via face-api.js / MediaPipe) to flag violations during exams.
- **backend/** – Node.js/Express API handling auth, exams, student/admin operations, and AI-related routes, backed by Supabase.
- **ai-service/** – Python service for AI-driven analysis.

## Running locally

```bash
# Backend
cd backend
npm install
npm start

# Frontend
cd frontend
npm install
npm run dev
```

Copy `.env.example` to `.env` in both `backend/` and `frontend/` and fill in the required credentials (Supabase, JWT secret, SMTP, AI API keys) before starting the backend.