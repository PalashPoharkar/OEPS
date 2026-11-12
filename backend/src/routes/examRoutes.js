import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import { allowRoles } from "../middlewares/roleMiddleware.js";
import { createExam, getMyExams, togglePublishExam, deleteExam, getPublishedExams } from "../controllers/examController.js";
import { getTeacherOverallStats, getExamAnalytics, getExamResults } from "../controllers/analyticsController.js";
import { uploadViolationClip, saveViolationLog, getViolationRecords } from "../controllers/proctoringController.js";

const router = express.Router();

// Proctoring (students — protected)
router.post("/proctoring/upload-clip", protect, uploadViolationClip);
router.post("/proctoring/save-log", protect, saveViolationLog);

// Violation records (teacher/admin)
router.get("/proctoring/records", protect, allowRoles("teacher", "admin"), getViolationRecords);

// Published exams (for students)
router.get("/published", protect, getPublishedExams);

// Teacher stats (must be before /:id routes)
router.get("/teacher-stats", protect, allowRoles("teacher", "admin"), getTeacherOverallStats);

// CRUD
router.post("/", protect, allowRoles("teacher", "admin"), createExam);
router.get("/mine", protect, allowRoles("teacher", "admin"), getMyExams);
router.patch("/:id/publish", protect, allowRoles("teacher", "admin"), togglePublishExam);
router.delete("/:id", protect, allowRoles("teacher", "admin"), deleteExam);

// Analytics & Export
router.get("/:id/analytics", protect, allowRoles("teacher", "admin"), getExamAnalytics);
router.get("/:id/export-results", protect, allowRoles("teacher", "admin"), getExamResults);

export default router;
