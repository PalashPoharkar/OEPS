import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import { allowRoles } from "../middlewares/roleMiddleware.js";
import { getAllUsers, updateUserRole, deleteUser } from "../controllers/adminController.js";

console.log("✅ adminRoutes.js loaded");

const router = express.Router();

// ✅ test route
router.get("/ping", (req, res) => {
  res.json({ ok: true, message: "✅ /api/admin/ping working" });
});

// ✅ main routes
router.get("/users", protect, allowRoles("admin"), getAllUsers);
router.patch("/users/:id/role", protect, allowRoles("admin"), updateUserRole);
router.delete("/users/:id", protect, allowRoles("admin"), deleteUser);

export default router;
