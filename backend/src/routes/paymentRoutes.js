const express = require("express");
const {
  getCustomerDetails,
  savePayment,
  getPaymentHistory
} = require("../controllers/paymentController");
const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const router = express.Router();

router.get("/customer-details", protect, authorizeRoles("admin"), getCustomerDetails);
router.post("/save", protect, authorizeRoles("admin"), savePayment);
router.get("/history", protect, authorizeRoles("admin"), getPaymentHistory);

module.exports = router;
