import express from "express";
import {
  getMyDashboard,
  createProfile,
  getClassExams,
  updateDashboardStats,
  saveExamResult,
  getExamResults,
} from "../controllers/studentController.js";
import { getStudentAnalytics } from "../controllers/analyticsController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { allowRoles } from "../middlewares/roleMiddleware.js";

const router = express.Router();

router.get("/me", protect, allowRoles("student"), getMyDashboard);
router.post("/profile", protect, allowRoles("student"), createProfile);
router.get("/exams", protect, allowRoles("student"), getClassExams);
router.patch("/dashboard", protect, allowRoles("student"), updateDashboardStats);
router.post("/results", protect, allowRoles("student"), saveExamResult);
router.get("/results", protect, allowRoles("student"), getExamResults);
router.get("/my-analytics", protect, allowRoles("student"), getStudentAnalytics);

export default router;
