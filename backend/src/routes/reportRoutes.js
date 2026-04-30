const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const {
  generateIncomeExcelReport,
  generateIncomeDailyExcel,
  generateIncomeWeeklyExcel,
  generateIncomeMonthlyExcel,
  generateIncomeYearlyExcel,
  generateIncomeAllExcel,
  generateExpenseDailyExcel,
  generateExpenseWeeklyExcel,
  generateExpenseMonthlyExcel,
  generateExpenseYearlyExcel,
  generateExpenseAllExcel
} = require("../controllers/reportController");

router.use(protect);
router.use(authorizeRoles("admin"));

// INCOME REPORTS (Excel only)
router.get("/income/excel", generateIncomeExcelReport);
router.get("/income/daily/excel", generateIncomeDailyExcel);
router.get("/income/weekly/excel", generateIncomeWeeklyExcel);
router.get("/income/monthly/excel", generateIncomeMonthlyExcel);
router.get("/income/yearly/excel", generateIncomeYearlyExcel);
router.get("/income/all/excel", generateIncomeAllExcel);

// EXPENSE REPORTS (Excel only)
router.get("/expense/daily/excel", generateExpenseDailyExcel);
router.get("/expense/weekly/excel", generateExpenseWeeklyExcel);
router.get("/expense/monthly/excel", generateExpenseMonthlyExcel);
router.get("/expense/yearly/excel", generateExpenseYearlyExcel);
router.get("/expense/all/excel", generateExpenseAllExcel);

module.exports = router;