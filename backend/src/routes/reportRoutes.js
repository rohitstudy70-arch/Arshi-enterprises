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
  generateExpenseAllExcel,
  generateLedgerDailyExcel,
  generateLedgerWeeklyExcel,
  generateLedgerMonthlyExcel,
  generateLedgerYearlyExcel,
  generateLedgerAllExcel,
  generateCustomerLedgerExcel,
  generateDueSummaryExcel,
  generateImeiTrackingExcel
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

// LEDGER REPORTS (Transactions + Summary sheets)
router.get("/ledger/daily/excel", generateLedgerDailyExcel);
router.get("/ledger/weekly/excel", generateLedgerWeeklyExcel);
router.get("/ledger/monthly/excel", generateLedgerMonthlyExcel);
router.get("/ledger/yearly/excel", generateLedgerYearlyExcel);
router.get("/ledger/all/excel", generateLedgerAllExcel);

// DUE & ITEM TRACKING REPORTS
router.get("/due/customer-ledger/excel", generateCustomerLedgerExcel);
router.get("/due/summary/excel", generateDueSummaryExcel);
router.get("/due/imei-tracking/excel", generateImeiTrackingExcel);

module.exports = router;