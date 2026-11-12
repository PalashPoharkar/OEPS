import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./routes/ProtectedRoute";
import RoleRoute from "./routes/RoleRoute";
import ThemeToggle from "./Components/ThemeToggle";

// Lazy load all pages — only downloads code when navigated to
const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Profile = lazy(() => import("./pages/Profile"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const TeacherDashboard = lazy(() => import("./pages/TeacherDashboard"));
const TeacherAnalytics = lazy(() => import("./pages/TeacherAnalytics"));
const AddQuestions = lazy(() => import("./pages/AddQuestions"));
const StudentDashboard = lazy(() => import("./pages/StudentDashboard"));
const ExamCountdown = lazy(() => import("./pages/ExamCountdown"));
const ExamPage = lazy(() => import("./pages/ExamPage"));
const ExamResult = lazy(() => import("./pages/ExamResult"));

function PageLoader() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 36, height: 36, border: "4px solid var(--border-default)", borderTop: "4px solid var(--primary)", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 12px" }} />
        <div style={{ color: "var(--text-secondary)", fontSize: 14 }}>Loading...</div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeToggle />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><RoleRoute allowedRoles={["admin"]}><AdminDashboard /></RoleRoute></ProtectedRoute>} />
          <Route path="/teacher" element={<ProtectedRoute><RoleRoute allowedRoles={["teacher", "admin"]}><TeacherDashboard /></RoleRoute></ProtectedRoute>} />
          <Route path="/teacher/add-questions/:examId" element={<AddQuestions />} />
          <Route path="/teacher/exam/:id/questions" element={<ProtectedRoute><RoleRoute allowedRoles={["teacher", "admin"]}><AddQuestions /></RoleRoute></ProtectedRoute>} />
          <Route path="/teacher/analytics" element={<ProtectedRoute><RoleRoute allowedRoles={["teacher", "admin"]}><TeacherAnalytics /></RoleRoute></ProtectedRoute>} />
          <Route path="/student" element={<ProtectedRoute><RoleRoute allowedRoles={["student", "admin", "teacher"]}><StudentDashboard /></RoleRoute></ProtectedRoute>} />
          <Route path="/student/exam/:examId/countdown" element={<ProtectedRoute><RoleRoute allowedRoles={["student", "admin", "teacher"]}><ExamCountdown /></RoleRoute></ProtectedRoute>} />
          <Route path="/student/exam/:examId" element={<ProtectedRoute><RoleRoute allowedRoles={["student", "admin", "teacher"]}><ExamPage /></RoleRoute></ProtectedRoute>} />
          <Route path="/student/exam/:examId/result" element={<ProtectedRoute><RoleRoute allowedRoles={["student", "admin", "teacher"]}><ExamResult /></RoleRoute></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
