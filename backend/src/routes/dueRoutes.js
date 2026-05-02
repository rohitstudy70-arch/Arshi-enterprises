const express = require("express");
const {
  getCustomerLedger,
  getDueSummary,
  getImeiTracking,
  syncItems,
  updateCustomerDue
} = require("../controllers/dueController");
const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const router = express.Router();

router.get("/ledger", protect, authorizeRoles("admin"), getCustomerLedger);
router.get("/summary", protect, authorizeRoles("admin"), getDueSummary);
router.get("/items", protect, authorizeRoles("admin"), getImeiTracking);
router.post("/sync", protect, authorizeRoles("admin"), syncItems);
router.put("/update", protect, authorizeRoles("admin"), updateCustomerDue);

module.exports = router;
