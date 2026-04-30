const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");
const {
  addExpense,
  getExpenses,
  updateExpense,
  deleteExpense
} = require("../controllers/expenseController");

const router = express.Router();

router.use(protect);

router.post("/", authorizeRoles("executive"), addExpense);
router.get("/", getExpenses);
router.put("/:id", authorizeRoles("admin", "executive"), updateExpense);
router.delete("/:id", authorizeRoles("admin", "executive"), deleteExpense);

module.exports = router;
