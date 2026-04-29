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

router.post("/", authorizeRoles("staff"), addExpense);
router.get("/", getExpenses);
router.put("/:id", authorizeRoles("admin"), updateExpense);
router.delete("/:id", authorizeRoles("admin"), deleteExpense);

module.exports = router;
