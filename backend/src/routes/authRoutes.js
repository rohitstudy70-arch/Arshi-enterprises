const express = require("express");
const {
  login,
  register,
  getProfile,
  getAllUsers,
  getUserById,
  deleteUser,
  updateUserPassword
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles, allowSelfOrAdmin } = require("../middleware/roleMiddleware");

const router = express.Router();

router.post("/login", login);
router.post("/register", protect, authorizeRoles("admin"), register);
router.get("/me", protect, getProfile);
router.get("/users", protect, authorizeRoles("admin"), getAllUsers);
router.get("/users/:id", protect, allowSelfOrAdmin, getUserById);
router.put("/users/:id/password", protect, authorizeRoles("admin"), updateUserPassword);
router.delete("/users/:id", protect, authorizeRoles("admin"), deleteUser);

module.exports = router;
