const express = require("express");
const { createTag, listTags } = require("../controllers/expenseTagController");
const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const router = express.Router();

router.get("/", protect, listTags);
router.post("/", protect, authorizeRoles("admin"), createTag);

module.exports = router;
