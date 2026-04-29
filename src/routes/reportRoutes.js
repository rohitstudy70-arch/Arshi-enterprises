const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const {
  generateIncomePdfReport,
  generateIncomeExcelReport,
  generateIncomeDailyPdf,
  generateIncomeDailyExcel,
  generateIncomeWeeklyPdf,
  generateIncomeWeeklyExcel,
  generateIncomeMonthlyPdf,
  generateIncomeMonthlyExcel,
  generateIncomeYearlyPdf,
  generateIncomeYearlyExcel,
  generateIncomeAllPdf,
  generateIncomeAllExcel,
  generateExpenseDailyPdf,
  generateExpenseDailyExcel,
  generateExpenseWeeklyPdf,
  generateExpenseWeeklyExcel,
  generateExpenseMonthlyPdf,
  generateExpenseMonthlyExcel,
  generateExpenseYearlyPdf,
  generateExpenseYearlyExcel,
  generateExpenseAllPdf,
  generateExpenseAllExcel
} = require("../controllers/reportController");

router.use(protect);
router.use(authorizeRoles("admin"));

// INCOME REPORTS
router.get("/income/pdf", generateIncomePdfReport);
router.get("/income/excel", generateIncomeExcelReport);
router.get("/income/daily/pdf", generateIncomeDailyPdf);
router.get("/income/daily/excel", generateIncomeDailyExcel);
router.get("/income/weekly/pdf", generateIncomeWeeklyPdf);
router.get("/income/weekly/excel", generateIncomeWeeklyExcel);
router.get("/income/monthly/pdf", generateIncomeMonthlyPdf);
router.get("/income/monthly/excel", generateIncomeMonthlyExcel);
router.get("/income/yearly/pdf", generateIncomeYearlyPdf);
router.get("/income/yearly/excel", generateIncomeYearlyExcel);
router.get("/income/all/pdf", generateIncomeAllPdf);
router.get("/income/all/excel", generateIncomeAllExcel);

// EXPENSE REPORTS
router.get("/expense/daily/pdf", generateExpenseDailyPdf);
router.get("/expense/daily/excel", generateExpenseDailyExcel);
router.get("/expense/weekly/pdf", generateExpenseWeeklyPdf);
router.get("/expense/weekly/excel", generateExpenseWeeklyExcel);
router.get("/expense/monthly/pdf", generateExpenseMonthlyPdf);
router.get("/expense/monthly/excel", generateExpenseMonthlyExcel);
router.get("/expense/yearly/pdf", generateExpenseYearlyPdf);
router.get("/expense/yearly/excel", generateExpenseYearlyExcel);
router.get("/expense/all/pdf", generateExpenseAllPdf);
router.get("/expense/all/excel", generateExpenseAllExcel);

module.exports = router;