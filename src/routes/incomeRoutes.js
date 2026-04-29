const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");
const {
  addIncome,
  getIncomes,
  updateIncome,
  deleteIncome
} = require("../controllers/incomeController");

const router = express.Router();

router.use(protect);

router.post("/", authorizeRoles("staff"), addIncome);
router.get("/", getIncomes);
router.put("/:id", authorizeRoles("admin"), updateIncome);
router.delete("/:id", authorizeRoles("admin"), deleteIncome);

module.exports = router;
