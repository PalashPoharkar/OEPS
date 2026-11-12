import express from "express";
import { register, login } from "../controllers/authController.js";
import { getProfile, updateProfile, changePassword } from "../controllers/profileController.js";
import { forgotPassword, resetPassword } from "../controllers/passwordResetController.js";
import { uploadFace, uploadAudio, uploadProfilePhoto } from "../controllers/uploadController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { loginLimiter, registerLimiter } from "../middlewares/rateLimitMiddleware.js";

const router = express.Router();

// Auth
router.post("/register", registerLimiter, register);
router.post("/login", loginLimiter, login);

// Profile (protected)
router.get("/profile", protect, getProfile);
router.patch("/profile", protect, updateProfile);
router.post("/change-password", protect, changePassword);

// Biometric uploads (protected)
router.post("/upload-face", protect, uploadFace);
router.post("/upload-audio", protect, uploadAudio);
router.post("/upload-profile-photo", protect, uploadProfilePhoto);

// Password Reset
router.post("/forgot-password", registerLimiter, forgotPassword);
router.post("/reset-password", registerLimiter, resetPassword);

export default router;
