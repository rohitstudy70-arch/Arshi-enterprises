const ExcelJS = require('exceljs');
const Income = require('../models/Income');
const Expense = require('../models/Expense');

const REPORT_TIMEZONE_OFFSET_MINUTES = 330; // IST / Asia-Kolkata

// ===== FETCH FUNCTIONS BY TIME PERIOD =====
const getRecordsByPeriod = async (model, days = 30, userId = null) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const filter = { createdAt: { $gte: d } };
  if (userId) filter.userId = userId;
  return model.find(filter).populate('userId', 'username').sort({ createdAt: -1 });
};

const getTodayRecords = async (model) => {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);
  return model.find({ createdAt: { $gte: startOfDay, $lt: endOfDay } }).populate('userId', 'username').sort({ createdAt: -1 });
};

const getAllRecords = async (model) => {
  return model.find({}).populate('userId', 'username').sort({ createdAt: -1 });
};

// ===== LEGACY SUPPORT =====
const getLastMonthRecords = async () => {
  return getRecordsByPeriod(Income, 30);
};

// ===== HELPERS =====
const formatCurrency = (val) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR'
  }).format(val || 0);

const formatDate = (date) => {
  const d = new Date(new Date(date).getTime() + REPORT_TIMEZONE_OFFSET_MINUTES * 60 * 1000);
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(
    d.getUTCMonth() + 1
  ).padStart(2, '0')}/${d.getUTCFullYear()}`;
};

const escapeHtml = (text) =>
  String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const safeNum = (val) => Number(val) || 0;

const isRecordToday = (recordDate, startOfDay, endOfDay) => {
  const d = recordDate ? new Date(recordDate).getTime() : 0;
  return d >= startOfDay.getTime() && d < endOfDay.getTime();
};

const isRecordYesterday = (recordDate, startOfDay) => {
  const yesterdayStart = new Date(startOfDay);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const yesterdayEnd = new Date(startOfDay);
  const d = recordDate ? new Date(recordDate).getTime() : 0;
  return d >= yesterdayStart.getTime() && d < yesterdayEnd.getTime();
};

const isRecordInPeriod = (recordDate, periodStart, periodEnd) => {
  const d = recordDate ? new Date(recordDate).getTime() : 0;
  return d >= periodStart.getTime() && d < periodEnd.getTime();
};

const addDays = (date, days) => {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
};

const getReportDayStart = (date = new Date()) => {
  const offsetMs = REPORT_TIMEZONE_OFFSET_MINUTES * 60 * 1000;
  const reportDate = new Date(date.getTime() + offsetMs);
  return new Date(Date.UTC(
    reportDate.getUTCFullYear(),
    reportDate.getUTCMonth(),
    reportDate.getUTCDate()
  ) - offsetMs);
};

const getTodayStart = () => {
  return getReportDayStart();
};

const getPeriodBoundaries = (days) => {
  const now = new Date();
  const todayStart = getReportDayStart(now);
  let currentEnd, currentStart, previousEnd, previousStart;

  if (days === 1) {
    // Daily: exact IST calendar today (midnight to midnight)
    currentStart = todayStart;
    currentEnd = addDays(currentStart, 1);

    previousEnd = new Date(currentStart);
    previousStart = addDays(previousEnd, -1);
  } else {
    // Multi-day: aligned to IST midnight
    currentEnd = addDays(todayStart, 1);
    currentStart = addDays(currentEnd, -days);

    previousEnd = new Date(currentStart);
    previousStart = addDays(previousEnd, -days);
  }

  return { currentStart, currentEnd, previousStart, previousEnd };
};

// ===== MONTH-TO-DATE & TILL-YESTERDAY HELPERS =====
const getMonthToDateTotals = async (Model, userId = null) => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  monthStart.setHours(0, 0, 0, 0);

  const filter = { createdAt: { $gte: monthStart, $lte: now } };
  if (userId) filter.userId = userId;
  const records = await Model.find(filter);
  const hasBill = records.length > 0 && records[0].billAmount !== undefined;

  if (hasBill) {
    const totalBill = records.reduce((s, r) => s + safeNum(r.billAmount), 0);
    const totalReceived = records.reduce((s, r) => s + safeNum(r.receivedAmount), 0);
    return { count: records.length, totalBill, totalReceived, totalDues: totalBill - totalReceived };
  } else {
    const totalAmount = records.reduce((s, r) => s + safeNum(r.amount), 0);
    return { count: records.length, totalAmount };
  }
};

const getTillYesterdayTotals = async (Model, periodStart, userId = null) => {
  const filter = { createdAt: { $lt: periodStart } };
  if (userId) filter.userId = userId;
  const records = await Model.find(filter);
  const hasBill = records.length > 0 && records[0].billAmount !== undefined;

  if (hasBill) {
    const totalBill = records.reduce((s, r) => s + safeNum(r.billAmount), 0);
    const totalReceived = records.reduce((s, r) => s + safeNum(r.receivedAmount), 0);
    return { count: records.length, totalBill, totalReceived, totalDues: totalBill - totalReceived };
  } else {
    const totalAmount = records.reduce((s, r) => s + safeNum(r.amount), 0);
    return { count: records.length, totalAmount };
  }
};

const getIncomeTotalsInRange = async (startDate, endDate, userId = null) => {
  const filter = {};
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = startDate;
    if (endDate) filter.createdAt.$lt = endDate;
  }
  if (userId) filter.userId = userId;

  const records = await Income.find(filter);
  const totalBill = records.reduce((s, r) => s + safeNum(r.billAmount), 0);
  const totalReceived = records.reduce((s, r) => s + safeNum(r.receivedAmount), 0);

  return {
    count: records.length,
    totalBill,
    totalReceived,
    totalDues: totalBill - totalReceived
  };
};


// ================= EXCEL REPORT BY PERIOD =================
const generateIncomeExcelByPeriod = async (req, res, days, filename) => {
  try {
    const userId = req.query.userId || null;
    // Fetch 2x period so we can split into Current + Previous
    const allData = await getRecordsByPeriod(Income, days * 2, userId);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Income');

    // ---- PERIOD BOUNDARIES ----
    const { currentStart, currentEnd, previousStart, previousEnd } = getPeriodBoundaries(days);

    const currentData = allData.filter(r => isRecordInPeriod(r.createdAt, currentStart, currentEnd));
    const previousData = allData.filter(r => isRecordInPeriod(r.createdAt, previousStart, previousEnd));

    // Table shows only current period records
    const tableData = currentData;

    // Split current period data: till yesterday in period vs today only
    const todayStart = getTodayStart();
    const tillYesterdayData = currentData.filter(r => new Date(r.createdAt).getTime() < todayStart.getTime());
    const todayOnlyData = currentData.filter(r => new Date(r.createdAt).getTime() >= todayStart.getTime());

    const tillYesterdayTotals = days === 1
      ? await getIncomeTotalsInRange(null, todayStart, userId)
      : null;

    const tillYesterdayRevenue = tillYesterdayTotals
      ? tillYesterdayTotals.totalBill
      : tillYesterdayData.reduce((s, r) => s + safeNum(r.billAmount), 0);
    const tillYesterdayReceived = tillYesterdayTotals
      ? tillYesterdayTotals.totalReceived
      : tillYesterdayData.reduce((s, r) => s + safeNum(r.receivedAmount), 0);
    const tillYesterdayDues = tillYesterdayTotals
      ? tillYesterdayTotals.totalDues
      : tillYesterdayRevenue - tillYesterdayReceived;

    const todayRevenue = todayOnlyData.reduce((s, r) => s + safeNum(r.billAmount), 0);
    const todayReceived = todayOnlyData.reduce((s, r) => s + safeNum(r.receivedAmount), 0);
    const todayDues = todayRevenue - todayReceived;

    // Daily report needs cumulative totals up to yesterday, not only yesterday's records.
    const yesterdayRevenue = tillYesterdayRevenue;
    const yesterdayReceived = tillYesterdayReceived;
    const yesterdayDues = tillYesterdayDues;

    const totalRevenue = yesterdayRevenue + todayRevenue;
    const totalReceived = yesterdayReceived + todayReceived;
    const totalDues = totalRevenue - totalReceived;

    console.log("[INCOME EXCEL] Yesterday Revenue:", yesterdayRevenue);
    console.log("[INCOME EXCEL] Today Revenue:", todayRevenue);
    console.log("[INCOME EXCEL] Total Revenue:", totalRevenue);
    console.log("[INCOME EXCEL] Total Received:", totalReceived);
    console.log("[INCOME EXCEL] Total Dues:", totalDues);

    // set column widths
    sheet.getColumn('A').width = 6;
    sheet.getColumn('B').width = 12;
    sheet.getColumn('C').width = 12;
    sheet.getColumn('D').width = 25;
    sheet.getColumn('E').width = 16;
    sheet.getColumn('F').width = 16;
    sheet.getColumn('G').width = 30;
    sheet.getColumn('H').width = 16;
    sheet.getColumn('I').width = 20;
    sheet.getColumn('J').width = 14;
    sheet.getColumn('K').width = 20;
    sheet.getColumn('L').width = 16;
    sheet.getColumn('M').width = 18;
    sheet.getColumn('N').width = 14;
    sheet.getColumn('O').width = 12;
    sheet.getColumn('P').width = 8;
    sheet.getColumn('Q').width = 14;
    sheet.getColumn('R').width = 14;
    sheet.getColumn('S').width = 12;
    sheet.getColumn('T').width = 14;
    sheet.getColumn('U').width = 14;
    sheet.getColumn('V').width = 20;
    sheet.getColumn('W').width = 16;
    sheet.getColumn('X').width = 16;
    sheet.getColumn('Y').width = 3;   // blank spacer
    sheet.getColumn('Z').width = 22;
    sheet.getColumn('AA').width = 16;
    sheet.getColumn('AB').width = 3;  // blank spacer
    sheet.getColumn('AC').width = 24;
    sheet.getColumn('AD').width = 16;
    sheet.getColumn('AE').width = 3;  // blank spacer
    sheet.getColumn('AF').width = 24;
    sheet.getColumn('AG').width = 16;

    // headers in row 1
    const headers = [
      'S.No', 'Date', 'CDB No', 'Client Name', 'Mobile 1', 'Mobile 2',
      'Address', 'District', 'Vehicle / Chassis', 'User ID', 'Item',
      'Model', 'IMEI Last 6', 'VTS No', 'Qty',
      'Bill Amount', 'Received Amount', 'Dues', 'Payment Mode',
      'UPI / UTR Ref', 'Bank Person', 'Technician', 'Executive'
    ];
    headers.forEach((h, idx) => {
      const cell = sheet.getCell(1, 1 + idx);
      cell.value = h;
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F4F4' } };
    });

    // ===== 3-COLUMN SUMMARY BLOCK =====
    const setSummaryCell = (cellRef, label, value, isHeader = false) => {
      const cell = sheet.getCell(cellRef);
      cell.value = label || value;
      if (label) {
        cell.font = { bold: true };
        if (isHeader) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F4F4' } };
      }
    };

    // -- REVENUE COLUMN (Z-AA) --
    setSummaryCell('Z1', 'REVENUE', null, true);
    setSummaryCell('Z2', 'Revenue Till Yesterday', null, true);
    setSummaryCell('AA2', null, yesterdayRevenue);
    setSummaryCell('Z3', "Today's Revenue", null, true);
    setSummaryCell('AA3', null, todayRevenue);
    setSummaryCell('Z4', 'Total Revenue (Current Day/Period)', null, true);
    setSummaryCell('AA4', null, totalRevenue);

    // -- RECEIVED COLUMN (AC-AD) --
    setSummaryCell('AC1', 'RECEIVED', null, true);
    setSummaryCell('AC2', 'Received Till Yesterday', null, true);
    setSummaryCell('AD2', null, yesterdayReceived);
    setSummaryCell('AC3', "Today's Received", null, true);
    setSummaryCell('AD3', null, todayReceived);
    setSummaryCell('AC4', days === 1 ? 'Total Received (Current Date)' : 'Total Received (Current Day/Period)', null, true);
    setSummaryCell('AD4', null, totalReceived);

    // -- DUES COLUMN (AF-AG) --
    setSummaryCell('AF1', 'DUES', null, true);
    setSummaryCell('AF2', 'Dues Till Yesterday', null, true);
    setSummaryCell('AG2', null, yesterdayDues);
    setSummaryCell('AF3', "Today's Dues", null, true);
    setSummaryCell('AG3', null, todayDues);
    setSummaryCell('AF4', 'Total Dues (Current Day/Period)', null, true);
    setSummaryCell('AG4', null, totalDues);

    tableData.forEach((item, i) => {
      const rowNum = 2 + i;
      sheet.getCell(rowNum, 1).value = i + 1;
      sheet.getCell(rowNum, 2).value = formatDate(item.createdAt);
      sheet.getCell(rowNum, 3).value = item.cbNumber;
      sheet.getCell(rowNum, 4).value = item.clientName;
      sheet.getCell(rowNum, 5).value = item.mobile1 || '';
      sheet.getCell(rowNum, 6).value = item.mobile2 || '';
      sheet.getCell(rowNum, 7).value = item.address || '';
      sheet.getCell(rowNum, 8).value = item.district || '';
      sheet.getCell(rowNum, 9).value = item.vehicleChassisNo || '';
      sheet.getCell(rowNum, 10).value = item.clientUserId || '';
      sheet.getCell(rowNum, 11).value = item.item || '';
      sheet.getCell(rowNum, 12).value = item.model || '';
      sheet.getCell(rowNum, 13).value = item.imeiLastSix || '';
      sheet.getCell(rowNum, 14).value = item.vtsNo || '';
      sheet.getCell(rowNum, 15).value = item.quantity || 0;
      sheet.getCell(rowNum, 16).value = item.billAmount;
      sheet.getCell(rowNum, 17).value = item.receivedAmount;
      sheet.getCell(rowNum, 18).value = item.dues;
      sheet.getCell(rowNum, 19).value = item.paymentMode;
      sheet.getCell(rowNum, 20).value = item.upiReferenceId || '-';
      sheet.getCell(rowNum, 21).value = item.bankPersonName || '-';
      sheet.getCell(rowNum, 22).value = item.technician || '';
      sheet.getCell(rowNum, 23).value = item.userId?.username || '';
    });

    const buffer = await workbook.xlsx.writeBuffer();

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length
    });

    return res.end(buffer);
  } catch (err) {
    console.error("EXCEL ERROR 👉", err);
    return res.status(500).send(err.message);
  }
};

const generateExpenseExcelByPeriod = async (req, res, days, filename) => {
  try {
    const userId = req.query.userId || null;
    // Fetch 2x period so we can split into Current + Previous
    const allData = await getRecordsByPeriod(Expense, days * 2, userId);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Expenses');

    // ---- PERIOD BOUNDARIES ----
    const { currentStart, currentEnd, previousStart, previousEnd } = getPeriodBoundaries(days);

    const currentData = allData.filter(r => isRecordInPeriod(r.createdAt, currentStart, currentEnd));
    const previousData = allData.filter(r => isRecordInPeriod(r.createdAt, previousStart, previousEnd));

    // Table shows only current period records
    const tableData = currentData;

    const todayExpenses = currentData.reduce((s, r) => s + safeNum(r.amount), 0);
    const prevExpenses = previousData.reduce((s, r) => s + safeNum(r.amount), 0);
    const totalAmount = todayExpenses + prevExpenses;

    console.log("[EXPENSE EXCEL] Today's Expenses:", todayExpenses);
    console.log("[EXPENSE EXCEL] Previous Expenses:", prevExpenses);
    console.log("[EXPENSE EXCEL] Total Expenses:", totalAmount);

    const monthTotals = await getMonthToDateTotals(Expense, userId);
    const tillYesterdayTotals = await getTillYesterdayTotals(Expense, previousStart, userId);

    // set column widths (data columns + summary columns after Executive)
    sheet.getColumn('A').width = 6;
    sheet.getColumn('B').width = 12;
    sheet.getColumn('C').width = 15;
    sheet.getColumn('D').width = 12;
    sheet.getColumn('E').width = 30;
    sheet.getColumn('F').width = 15;
    sheet.getColumn('G').width = 3;   // blank spacer
    sheet.getColumn('H').width = 22;
    sheet.getColumn('I').width = 16;
    sheet.getColumn('J').width = 3;   // blank spacer
    sheet.getColumn('K').width = 22;
    sheet.getColumn('L').width = 16;
    sheet.getColumn('M').width = 3;   // blank spacer
    sheet.getColumn('N').width = 22;
    sheet.getColumn('O').width = 16;

    // headers in row 1
    const headers = ['S.No', 'Date', 'Category', 'Amount', 'Notes', 'Executive'];
    headers.forEach((h, idx) => {
      const cell = sheet.getCell(1, 1 + idx);
      cell.value = h;
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F4F4' } };
    });

    // ===== 3-COLUMN SUMMARY BLOCK =====
    const setSummaryCell = (cellRef, label, value, isHeader = false) => {
      const cell = sheet.getCell(cellRef);
      cell.value = label || value;
      if (label) {
        cell.font = { bold: true };
        if (isHeader) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F4F4' } };
      }
    };

    // -- TILL YESTERDAY (H-I) --
    setSummaryCell('H1', 'TILL YESTERDAY', null, true);
    setSummaryCell('H2', 'Total Records Till Yesterday', null, true);
    setSummaryCell('I2', null, tillYesterdayTotals.count);
    setSummaryCell('H3', 'Total Expenses Till Yesterday', null, true);
    setSummaryCell('I3', null, tillYesterdayTotals.totalAmount);

    // -- CURRENT PERIOD (K-L) --
    setSummaryCell('K1', 'CURRENT PERIOD', null, true);
    setSummaryCell('K2', "Today's Expenses", null, true);
    setSummaryCell('L2', null, todayExpenses);
    setSummaryCell('K3', 'Previous Expenses', null, true);
    setSummaryCell('L3', null, prevExpenses);
    setSummaryCell('K4', 'Total Expenses (Current Month)', null, true);
    setSummaryCell('L4', null, monthTotals.totalAmount);

    // -- TOTAL (N-O) --
    setSummaryCell('N1', 'TOTAL', null, true);
    setSummaryCell('N2', 'Grand Total Expenses', null, true);
    setSummaryCell('O2', null, totalAmount);

    tableData.forEach((item, i) => {
      const rowNum = 2 + i;
      sheet.getCell(rowNum, 1).value = i + 1;
      sheet.getCell(rowNum, 2).value = formatDate(item.createdAt);
      sheet.getCell(rowNum, 3).value = item.category;
      sheet.getCell(rowNum, 4).value = item.amount;
      sheet.getCell(rowNum, 5).value = item.notes || '';
      sheet.getCell(rowNum, 6).value = item.userId?.username || '';
    });

    const buffer = await workbook.xlsx.writeBuffer();

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length
    });

    return res.end(buffer);
  } catch (err) {
    console.error("EXCEL ERROR 👉", err);
    return res.status(500).send(err.message);
  }
};

// ================= PUBLIC ENDPOINTS (EXCEL ONLY) =================
// INCOME
const generateIncomeDailyExcel = (req, res) => generateIncomeExcelByPeriod(req, res, 1, 'income-daily.xlsx');
const generateIncomeWeeklyExcel = (req, res) => generateIncomeExcelByPeriod(req, res, 7, 'income-weekly.xlsx');
const generateIncomeMonthlyExcel = (req, res) => generateIncomeExcelByPeriod(req, res, 30, 'income-monthly.xlsx');
const generateIncomeYearlyExcel = (req, res) => generateIncomeExcelByPeriod(req, res, 365, 'income-yearly.xlsx');
const generateIncomeAllExcel = (req, res) => generateIncomeExcelByPeriod(req, res, 999999, 'income-all.xlsx');

// EXPENSE
const generateExpenseDailyExcel = (req, res) => generateExpenseExcelByPeriod(req, res, 1, 'expense-daily.xlsx');
const generateExpenseWeeklyExcel = (req, res) => generateExpenseExcelByPeriod(req, res, 7, 'expense-weekly.xlsx');
const generateExpenseMonthlyExcel = (req, res) => generateExpenseExcelByPeriod(req, res, 30, 'expense-monthly.xlsx');
const generateExpenseYearlyExcel = (req, res) => generateExpenseExcelByPeriod(req, res, 365, 'expense-yearly.xlsx');
const generateExpenseAllExcel = (req, res) => generateExpenseExcelByPeriod(req, res, 999999, 'expense-all.xlsx');

// ===== LEGACY =====
const generateIncomeExcelReport = (req, res) => generateIncomeExcelByPeriod(req, res, 30, 'income-report.xlsx');

// ===== EXPORT =====
module.exports = {
  // Income Reports
  generateIncomeExcelReport,
  generateIncomeDailyExcel,
  generateIncomeWeeklyExcel,
  generateIncomeMonthlyExcel,
  generateIncomeYearlyExcel,
  generateIncomeAllExcel,

  // Expense Reports
  generateExpenseDailyExcel,
  generateExpenseWeeklyExcel,
  generateExpenseMonthlyExcel,
  generateExpenseYearlyExcel,
  generateExpenseAllExcel
};
