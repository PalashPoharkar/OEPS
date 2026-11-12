import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import { allowRoles } from "../middlewares/roleMiddleware.js";
import { extractFromImage, extractFromPdf, aiChat, generateDiagram, analyzeSnapshot } from "../controllers/aiController.js";

const router = express.Router();

router.post("/extract-image", protect, allowRoles("teacher", "admin"), extractFromImage);
router.post("/extract-pdf", protect, allowRoles("teacher", "admin"), extractFromPdf);
router.post("/chat", protect, allowRoles("teacher", "admin"), aiChat);
router.post("/diagram", protect, allowRoles("teacher", "admin"), generateDiagram);
router.post("/analyze-snapshot", protect, analyzeSnapshot);

export default router;
