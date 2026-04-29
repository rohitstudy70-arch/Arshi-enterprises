const ExcelJS = require('exceljs');
const puppeteer = require('puppeteer');
const Income = require('../models/Income');
const Expense = require('../models/Expense');

// ===== FETCH FUNCTIONS BY TIME PERIOD =====
const getRecordsByPeriod = async (model, days = 30) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return model.find({ createdAt: { $gte: d } }).populate('userId', 'username').sort({ createdAt: -1 });
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
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2, '0')}/${String(
    d.getMonth() + 1
  ).padStart(2, '0')}/${d.getFullYear()}`;
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

// ================= INCOME PERIOD REPORTS (PDF) =================
const generateIncomePdfByPeriod = async (req, res, days, title) => {
  let browser;
  try {
    const data = days === 1 ? await getTodayRecords(Income) : await getRecordsByPeriod(Income, days);

    const totalBill = data.reduce((s, r) => s + safeNum(r.billAmount), 0);
    const totalReceived = data.reduce((s, r) => s + safeNum(r.receivedAmount), 0);
    const totalDues = totalBill - totalReceived;

    // ---- TODAY vs PREVIOUS BREAKDOWN ----
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const todayRevenue = data
      .filter(r => isRecordToday(r.createdAt, startOfDay, endOfDay))
      .reduce((s, r) => s + safeNum(r.billAmount), 0);
    const todayReceived = data
      .filter(r => isRecordToday(r.createdAt, startOfDay, endOfDay))
      .reduce((s, r) => s + safeNum(r.receivedAmount), 0);
    const todayDues = todayRevenue - todayReceived;

    const prevRevenue = totalBill - todayRevenue;
    const prevReceived = totalReceived - todayReceived;
    const prevDues = prevRevenue - prevReceived;

    console.log("[INCOME PDF] Today's Revenue:", todayRevenue);
    console.log("[INCOME PDF] Today's Received:", todayReceived);
    console.log("[INCOME PDF] Today's Dues:", todayDues);
    console.log("[INCOME PDF] Previous Revenue:", prevRevenue);
    console.log("[INCOME PDF] Previous Received:", prevReceived);
    console.log("[INCOME PDF] Previous Dues:", prevDues);
    console.log("[INCOME PDF] Total Revenue:", totalBill);
    console.log("[INCOME PDF] Total Received:", totalReceived);
    console.log("[INCOME PDF] Total Dues:", totalDues);

    const rows = data
      .map(
        (item, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${formatDate(item.createdAt)}</td>
          <td>${escapeHtml(item.cbNumber)}</td>
          <td>${escapeHtml(item.clientName)}</td>
          <td>${escapeHtml(item.description)}</td>
          <td>${escapeHtml(item.reference)}</td>
          <td>${item.quantity || 0}</td>
          <td>${formatCurrency(item.billAmount)}</td>
          <td>${formatCurrency(item.receivedAmount)}</td>
          <td>${formatCurrency(item.dues)}</td>
          <td>${item.paymentMode || ''}</td>
          <td>${item.upiReferenceId || '-'}</td>
          <td>${item.userId?.username || ''}</td>
        </tr>`
      )
      .join('');

    const html = `
    <html>
    <head>
      <style>
        body { font-family: Arial; padding: 20px; font-size: 12px; }
        h1 { text-align: center; }
        .summary { margin: 20px 0 10px 0; padding: 15px; background: #f9f9f9; border: 1px solid #ddd; border-radius: 4px; }
        .summary p { margin: 6px 0; font-size: 13px; }
        table { width: 100%; border-collapse: collapse; margin-top:20px; }
        th, td { border: 1px solid #ddd; padding: 6px; text-align: center; font-size: 11px; }
        th { background: #f4f4f4; }
        .text-left { text-align: left; }
      </style>
    </head>
    <body>

      <h1>${title}</h1>

      <table>
        <tr>
          <th>S.No</th>
          <th>Date</th>
          <th>CB Number</th>
          <th>Client Name / ID</th>
          <th>Description</th>
          <th>Reference</th>
          <th>Qty</th>
          <th>Bill Amount</th>
          <th>Received Amount</th>
          <th>Dues</th>
          <th>Payment Mode</th>
          <th>UPI / UTR Ref</th>
          <th>Staff</th>
        </tr>
        ${rows || '<tr><td colspan="13">No Data</td></tr>'}
      </table>

      <div class="summary">
        <p><b>Today's Revenue:</b> ${formatCurrency(todayRevenue)}</p>
        <p><b>Today's Received:</b> ${formatCurrency(todayReceived)}</p>
        <p><b>Today's Dues:</b> ${formatCurrency(todayDues)}</p>
        <hr style="border:none; border-top:1px solid #ccc; margin:10px 0;" />
        <p><b>Previous Revenue:</b> ${formatCurrency(prevRevenue)}</p>
        <p><b>Previous Received:</b> ${formatCurrency(prevReceived)}</p>
        <p><b>Previous Dues:</b> ${formatCurrency(prevDues)}</p>
        <hr style="border:none; border-top:1px solid #ccc; margin:10px 0;" />
        <p><b>Total Revenue:</b> ${formatCurrency(totalBill)}</p>
        <p><b>Total Received:</b> ${formatCurrency(totalReceived)}</p>
        <p><b>Total Dues:</b> ${formatCurrency(totalDues)}</p>
      </div>

    </body>
    </html>
    `;

    browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: 10, bottom: 10, left: 10, right: 10 }
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="income-report.pdf"',
      'Content-Length': pdfBuffer.length
    });

    return res.end(pdfBuffer);
  } catch (err) {
    console.error("PDF ERROR 👉", err);
    return res.status(500).send(err.message);
  } finally {
    if (browser) await browser.close();
  }
};

// ================= EXPENSE PDF REPORT =================
const generateExpensePdfByPeriod = async (req, res, days, title) => {
  let browser;
  try {
    const data = days === 1 ? await getTodayRecords(Expense) : await getRecordsByPeriod(Expense, days);

    const totalAmount = data.reduce((s, r) => s + safeNum(r.amount), 0);

    // ---- TODAY vs PREVIOUS BREAKDOWN ----
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const todayExpenses = data
      .filter(r => isRecordToday(r.createdAt, startOfDay, endOfDay))
      .reduce((s, r) => s + safeNum(r.amount), 0);
    const prevExpenses = totalAmount - todayExpenses;

    console.log("[EXPENSE PDF] Today's Expenses:", todayExpenses);
    console.log("[EXPENSE PDF] Previous Expenses:", prevExpenses);
    console.log("[EXPENSE PDF] Total Expenses:", totalAmount);

    const rows = data
      .map(
        (item, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${formatDate(item.createdAt)}</td>
          <td>${escapeHtml(item.category)}</td>
          <td>${formatCurrency(item.amount)}</td>
          <td>${escapeHtml(item.notes)}</td>
          <td>${item.userId?.username || ''}</td>
        </tr>`
      )
      .join('');

    const html = `
    <html>
    <head>
      <style>
        body { font-family: Arial; padding: 20px; font-size: 12px; }
        h1 { text-align: center; }
        .summary { margin: 20px 0 10px 0; padding: 15px; background: #f9f9f9; border: 1px solid #ddd; border-radius: 4px; }
        .summary p { margin: 6px 0; font-size: 13px; }
        table { width: 100%; border-collapse: collapse; margin-top:20px; }
        th, td { border: 1px solid #ddd; padding: 6px; text-align: center; font-size: 11px; }
        th { background: #f4f4f4; }
        .text-left { text-align: left; }
      </style>
    </head>
    <body>

      <h1>${title}</h1>

      <table>
        <tr>
          <th>S.No</th>
          <th>Date</th>
          <th>Category</th>
          <th>Amount</th>
          <th>Notes</th>
          <th>Staff</th>
        </tr>
        ${rows || '<tr><td colspan="6">No Data</td></tr>'}
      </table>

      <div class="summary">
        <p><b>Today's Expenses:</b> ${formatCurrency(todayExpenses)}</p>
        <hr style="border:none; border-top:1px solid #ccc; margin:10px 0;" />
        <p><b>Previous Expenses:</b> ${formatCurrency(prevExpenses)}</p>
        <hr style="border:none; border-top:1px solid #ccc; margin:10px 0;" />
        <p><b>Total Expenses:</b> ${formatCurrency(totalAmount)}</p>
      </div>

    </body>
    </html>
    `;

    browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: 10, bottom: 10, left: 10, right: 10 }
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="expense-report.pdf"',
      'Content-Length': pdfBuffer.length
    });

    return res.end(pdfBuffer);
  } catch (err) {
    console.error("PDF ERROR 👉", err);
    return res.status(500).send(err.message);
  } finally {
    if (browser) await browser.close();
  }
};

// ================= EXCEL REPORT BY PERIOD =================
const generateIncomeExcelByPeriod = async (req, res, days, filename) => {
  try {
    const data = days === 1 ? await getTodayRecords(Income) : await getRecordsByPeriod(Income, days);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Income');

    const totalBill = data.reduce((s, r) => s + safeNum(r.billAmount), 0);
    const totalReceived = data.reduce((s, r) => s + safeNum(r.receivedAmount), 0);
    const totalDues = totalBill - totalReceived;

    // ---- TODAY vs PREVIOUS BREAKDOWN ----
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const todayRevenue = data
      .filter(r => isRecordToday(r.createdAt, startOfDay, endOfDay))
      .reduce((s, r) => s + safeNum(r.billAmount), 0);
    const todayReceived = data
      .filter(r => isRecordToday(r.createdAt, startOfDay, endOfDay))
      .reduce((s, r) => s + safeNum(r.receivedAmount), 0);
    const todayDues = todayRevenue - todayReceived;

    const prevRevenue = totalBill - todayRevenue;
    const prevReceived = totalReceived - todayReceived;
    const prevDues = prevRevenue - prevReceived;

    console.log("[INCOME EXCEL] Today's Revenue:", todayRevenue);
    console.log("[INCOME EXCEL] Today's Received:", todayReceived);
    console.log("[INCOME EXCEL] Today's Dues:", todayDues);
    console.log("[INCOME EXCEL] Previous Revenue:", prevRevenue);
    console.log("[INCOME EXCEL] Previous Received:", prevReceived);
    console.log("[INCOME EXCEL] Previous Dues:", prevDues);
    console.log("[INCOME EXCEL] Total Revenue:", totalBill);
    console.log("[INCOME EXCEL] Total Received:", totalReceived);
    console.log("[INCOME EXCEL] Total Dues:", totalDues);

    // set column widths (data columns + summary columns after Staff)
    sheet.getColumn('A').width = 6;
    sheet.getColumn('B').width = 12;
    sheet.getColumn('C').width = 12;
    sheet.getColumn('D').width = 25;
    sheet.getColumn('E').width = 30;
    sheet.getColumn('F').width = 20;
    sheet.getColumn('G').width = 8;
    sheet.getColumn('H').width = 14;
    sheet.getColumn('I').width = 14;
    sheet.getColumn('J').width = 12;
    sheet.getColumn('K').width = 12;
    sheet.getColumn('L').width = 20;
    sheet.getColumn('M').width = 15;
    sheet.getColumn('N').width = 3;   // blank spacer
    sheet.getColumn('O').width = 18;
    sheet.getColumn('P').width = 16;

    // headers in row 1
    const headers = [
      'S.No', 'Date', 'CB Number', 'Client Name / ID', 'Description',
      'Reference', 'Qty', 'Bill Amount', 'Received Amount', 'Dues',
      'Payment Mode', 'UPI / UTR Ref', 'Staff'
    ];
    headers.forEach((h, idx) => {
      const cell = sheet.getCell(1, 1 + idx);
      cell.value = h;
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F4F4' } };
    });

    // ===== SUMMARY BLOCK (columns O-P, after Staff) =====
    const setSummaryCell = (cellRef, label, value, isHeader = false) => {
      const cell = sheet.getCell(cellRef);
      cell.value = label || value;
      if (label) {
        cell.font = { bold: true };
        if (isHeader) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F4F4' } };
      }
    };

    setSummaryCell('O1', 'TOTAL REVENUE', null, true);
    setSummaryCell('P1', null, totalBill);
    setSummaryCell('O2', 'TOTAL RECEIVED', null, true);
    setSummaryCell('P2', null, totalReceived);
    setSummaryCell('O3', 'TOTAL DUES', null, true);
    setSummaryCell('P3', null, totalDues);

    setSummaryCell('O5', "TODAY'S REVENUE", null, true);
    setSummaryCell('P5', null, todayRevenue);
    setSummaryCell('O6', "TODAY'S RECEIVED", null, true);
    setSummaryCell('P6', null, todayReceived);
    setSummaryCell('O7', "TODAY'S DUES", null, true);
    setSummaryCell('P7', null, todayDues);

    setSummaryCell('O9', 'PREVIOUS REVENUE', null, true);
    setSummaryCell('P9', null, prevRevenue);
    setSummaryCell('O10', 'PREVIOUS RECEIVED', null, true);
    setSummaryCell('P10', null, prevReceived);
    setSummaryCell('O11', 'PREVIOUS DUES', null, true);
    setSummaryCell('P11', null, prevDues);

    data.forEach((item, i) => {
      const rowNum = 2 + i;
      sheet.getCell(rowNum, 1).value = i + 1;
      sheet.getCell(rowNum, 2).value = formatDate(item.createdAt);
      sheet.getCell(rowNum, 3).value = item.cbNumber;
      sheet.getCell(rowNum, 4).value = item.clientName;
      sheet.getCell(rowNum, 5).value = item.description || '';
      sheet.getCell(rowNum, 6).value = item.reference || '';
      sheet.getCell(rowNum, 7).value = item.quantity || 0;
      sheet.getCell(rowNum, 8).value = item.billAmount;
      sheet.getCell(rowNum, 9).value = item.receivedAmount;
      sheet.getCell(rowNum, 10).value = item.dues;
      sheet.getCell(rowNum, 11).value = item.paymentMode;
      sheet.getCell(rowNum, 12).value = item.upiReferenceId || '-';
      sheet.getCell(rowNum, 13).value = item.userId?.username || '';
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
    const data = days === 1 ? await getTodayRecords(Expense) : await getRecordsByPeriod(Expense, days);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Expenses');

    const totalAmount = data.reduce((s, r) => s + safeNum(r.amount), 0);

    // ---- TODAY vs PREVIOUS BREAKDOWN ----
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const todayExpenses = data
      .filter(r => isRecordToday(r.createdAt, startOfDay, endOfDay))
      .reduce((s, r) => s + safeNum(r.amount), 0);
    const prevExpenses = totalAmount - todayExpenses;

    console.log("[EXPENSE EXCEL] Today's Expenses:", todayExpenses);
    console.log("[EXPENSE EXCEL] Previous Expenses:", prevExpenses);
    console.log("[EXPENSE EXCEL] Total Expenses:", totalAmount);

    // set column widths (data columns + summary columns after Staff)
    sheet.getColumn('A').width = 6;
    sheet.getColumn('B').width = 12;
    sheet.getColumn('C').width = 15;
    sheet.getColumn('D').width = 12;
    sheet.getColumn('E').width = 30;
    sheet.getColumn('F').width = 15;
    sheet.getColumn('G').width = 3;   // blank spacer
    sheet.getColumn('H').width = 18;
    sheet.getColumn('I').width = 16;

    // headers in row 1
    const headers = ['S.No', 'Date', 'Category', 'Amount', 'Notes', 'Staff'];
    headers.forEach((h, idx) => {
      const cell = sheet.getCell(1, 1 + idx);
      cell.value = h;
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F4F4' } };
    });

    // ===== SUMMARY BLOCK (columns H-I, after Staff) =====
    const setSummaryCell = (cellRef, label, value, isHeader = false) => {
      const cell = sheet.getCell(cellRef);
      cell.value = label || value;
      if (label) {
        cell.font = { bold: true };
        if (isHeader) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F4F4' } };
      }
    };

    setSummaryCell('H1', 'TOTAL EXPENSES', null, true);
    setSummaryCell('I1', null, totalAmount);

    setSummaryCell('H3', "TODAY'S EXPENSES", null, true);
    setSummaryCell('I3', null, todayExpenses);

    setSummaryCell('H5', 'PREVIOUS EXPENSES', null, true);
    setSummaryCell('I5', null, prevExpenses);

    data.forEach((item, i) => {
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

// ================= PUBLIC ENDPOINTS =================
// INCOME - Daily
const generateIncomeDailyPdf = (req, res) => generateIncomePdfByPeriod(req, res, 1, 'Daily Income Report');
const generateIncomeDailyExcel = (req, res) => generateIncomeExcelByPeriod(req, res, 1, 'income-daily.xlsx');

// INCOME - Weekly
const generateIncomeWeeklyPdf = (req, res) => generateIncomePdfByPeriod(req, res, 7, 'Weekly Income Report');
const generateIncomeWeeklyExcel = (req, res) => generateIncomeExcelByPeriod(req, res, 7, 'income-weekly.xlsx');

// INCOME - Monthly
const generateIncomeMonthlyPdf = (req, res) => generateIncomePdfByPeriod(req, res, 30, 'Monthly Income Report');
const generateIncomeMonthlyExcel = (req, res) => generateIncomeExcelByPeriod(req, res, 30, 'income-monthly.xlsx');

// INCOME - Yearly
const generateIncomeYearlyPdf = (req, res) => generateIncomePdfByPeriod(req, res, 365, 'Yearly Income Report');
const generateIncomeYearlyExcel = (req, res) => generateIncomeExcelByPeriod(req, res, 365, 'income-yearly.xlsx');

// INCOME - All
const generateIncomeAllPdf = (req, res) => generateIncomePdfByPeriod(req, res, 999999, 'All Income Report');
const generateIncomeAllExcel = (req, res) => generateIncomeExcelByPeriod(req, res, 999999, 'income-all.xlsx');

// EXPENSE - Daily
const generateExpenseDailyPdf = (req, res) => generateExpensePdfByPeriod(req, res, 1, 'Daily Expense Report');
const generateExpenseDailyExcel = (req, res) => generateExpenseExcelByPeriod(req, res, 1, 'expense-daily.xlsx');

// EXPENSE - Weekly
const generateExpenseWeeklyPdf = (req, res) => generateExpensePdfByPeriod(req, res, 7, 'Weekly Expense Report');
const generateExpenseWeeklyExcel = (req, res) => generateExpenseExcelByPeriod(req, res, 7, 'expense-weekly.xlsx');

// EXPENSE - Monthly
const generateExpenseMonthlyPdf = (req, res) => generateExpensePdfByPeriod(req, res, 30, 'Monthly Expense Report');
const generateExpenseMonthlyExcel = (req, res) => generateExpenseExcelByPeriod(req, res, 30, 'expense-monthly.xlsx');

// EXPENSE - Yearly
const generateExpenseYearlyPdf = (req, res) => generateExpensePdfByPeriod(req, res, 365, 'Yearly Expense Report');
const generateExpenseYearlyExcel = (req, res) => generateExpenseExcelByPeriod(req, res, 365, 'expense-yearly.xlsx');

// EXPENSE - All
const generateExpenseAllPdf = (req, res) => generateExpensePdfByPeriod(req, res, 999999, 'All Expense Report');
const generateExpenseAllExcel = (req, res) => generateExpenseExcelByPeriod(req, res, 999999, 'expense-all.xlsx');

// ===== LEGACY =====
const generateIncomePdfReport = (req, res) => generateIncomePdfByPeriod(req, res, 30, 'Income Report');
const generateIncomeExcelReport = (req, res) => generateIncomeExcelByPeriod(req, res, 30, 'income-report.xlsx');

// ===== EXPORT =====
module.exports = {
  // Income Reports
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

  // Expense Reports
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
};