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

const getPeriodBoundaries = (days) => {
  const now = new Date();
  let currentEnd, currentStart, previousEnd, previousStart;

  if (days === 1) {
    // Daily: exact calendar today (midnight to midnight)
    currentEnd = new Date(now);
    currentEnd.setHours(0, 0, 0, 0);
    currentEnd.setDate(currentEnd.getDate() + 1);
    currentStart = new Date(currentEnd);
    currentStart.setDate(currentStart.getDate() - 1);

    previousEnd = new Date(currentStart);
    previousStart = new Date(previousEnd);
    previousStart.setDate(previousStart.getDate() - 1);
  } else {
    // Multi-day: aligned to midnight
    currentEnd = new Date(now);
    currentEnd.setHours(0, 0, 0, 0);
    currentEnd.setDate(currentEnd.getDate() + 1);
    currentStart = new Date(currentEnd);
    currentStart.setDate(currentStart.getDate() - days);

    previousEnd = new Date(currentStart);
    previousStart = new Date(previousEnd);
    previousStart.setDate(previousStart.getDate() - days);
  }

  return { currentStart, currentEnd, previousStart, previousEnd };
};

// ===== MONTH-TO-DATE & TILL-YESTERDAY HELPERS =====
const getMonthToDateTotals = async (Model) => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  monthStart.setHours(0, 0, 0, 0);

  const records = await Model.find({ createdAt: { $gte: monthStart, $lte: now } });
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

const getTillYesterdayTotals = async (Model, periodStart) => {
  const records = await Model.find({ createdAt: { $lt: periodStart } });
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

// ================= INCOME PERIOD REPORTS (PDF) =================
const generateIncomePdfByPeriod = async (req, res, days, title) => {
  let browser;
  try {
    // Fetch 2x period so we can split into Current + Previous
    const allData = await getRecordsByPeriod(Income, days * 2);

    // ---- PERIOD BOUNDARIES ----
    const { currentStart, currentEnd, previousStart, previousEnd } = getPeriodBoundaries(days);

    const currentData = allData.filter(r => isRecordInPeriod(r.createdAt, currentStart, currentEnd));
    const previousData = allData.filter(r => isRecordInPeriod(r.createdAt, previousStart, previousEnd));

    // Table shows only current period records
    const tableData = currentData;

    const totalBill = currentData.reduce((s, r) => s + safeNum(r.billAmount), 0) + previousData.reduce((s, r) => s + safeNum(r.billAmount), 0);
    const totalReceived = currentData.reduce((s, r) => s + safeNum(r.receivedAmount), 0) + previousData.reduce((s, r) => s + safeNum(r.receivedAmount), 0);
    const totalDues = totalBill - totalReceived;

    const todayRevenue = currentData.reduce((s, r) => s + safeNum(r.billAmount), 0);
    const todayReceived = currentData.reduce((s, r) => s + safeNum(r.receivedAmount), 0);
    const todayDues = todayRevenue - todayReceived;

    const prevRevenue = previousData.reduce((s, r) => s + safeNum(r.billAmount), 0);
    const prevReceived = previousData.reduce((s, r) => s + safeNum(r.receivedAmount), 0);
    const prevDues = prevRevenue - prevReceived;

    // Fetch month-to-date and till-yesterday totals
    const monthTotals = await getMonthToDateTotals(Income);
    const tillYesterdayTotals = await getTillYesterdayTotals(Income, previousStart);

    console.log("[INCOME PDF] Today's Revenue:", todayRevenue);
    console.log("[INCOME PDF] Today's Received:", todayReceived);
    console.log("[INCOME PDF] Today's Dues:", todayDues);
    console.log("[INCOME PDF] Previous Revenue:", prevRevenue);
    console.log("[INCOME PDF] Previous Received:", prevReceived);
    console.log("[INCOME PDF] Previous Dues:", prevDues);
    console.log("[INCOME PDF] Total Revenue:", totalBill);
    console.log("[INCOME PDF] Total Received:", totalReceived);
    console.log("[INCOME PDF] Total Dues:", totalDues);
    console.log("[INCOME PDF] Month Revenue:", monthTotals.totalBill);
    console.log("[INCOME PDF] Month Received:", monthTotals.totalReceived);
    console.log("[INCOME PDF] Till Yesterday Revenue:", tillYesterdayTotals.totalBill);
    console.log("[INCOME PDF] Till Yesterday Received:", tillYesterdayTotals.totalReceived);

    const totalDuesTillDate = (tillYesterdayTotals.totalDues + todayDues) - prevReceived;
    console.log("[INCOME PDF] Total Dues Till Date:", totalDuesTillDate);

    const rows = tableData
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

      <div style="display: flex; justify-content: space-between; gap: 16px; margin: 20px 0;">
        <div style="flex: 1; padding: 12px; background: #f9f9f9; border: 1px solid #ddd; border-radius: 4px;">
          <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 6px; text-align: center;">REVENUE</h3>
          <p style="margin: 5px 0; font-size: 12px;"><b>Revenue Till Yesterday:</b> ${formatCurrency(tillYesterdayTotals.totalBill)}</p>
          <p style="margin: 5px 0; font-size: 12px;"><b>Today's Revenue:</b> ${formatCurrency(todayRevenue)}</p>
          <p style="margin: 5px 0; font-size: 12px;"><b>Total Revenue (Current Month):</b> ${formatCurrency(monthTotals.totalBill)}</p>
        </div>
        <div style="flex: 1; padding: 12px; background: #f9f9f9; border: 1px solid #ddd; border-radius: 4px;">
          <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 6px; text-align: center;">RECEIVED</h3>
          <p style="margin: 5px 0; font-size: 12px;"><b>Total Received Till Yesterday:</b> ${formatCurrency(tillYesterdayTotals.totalReceived)}</p>
          <p style="margin: 5px 0; font-size: 12px;"><b>Total Receive:</b> ${formatCurrency(todayReceived)}</p>
          <p style="margin: 5px 0; font-size: 12px;"><b>Previous Due Amount Received(+):</b> ${formatCurrency(prevReceived)}</p>
          <p style="margin: 5px 0; font-size: 12px;"><b>Total Received (Current Month):</b> ${formatCurrency(monthTotals.totalReceived)}</p>
        </div>
        <div style="flex: 1; padding: 12px; background: #f9f9f9; border: 1px solid #ddd; border-radius: 4px;">
          <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 6px; text-align: center;">DUES</h3>
          <p style="margin: 5px 0; font-size: 12px;"><b>Total Due Till Yesterday:</b> ${formatCurrency(tillYesterdayTotals.totalDues)}</p>
          <p style="margin: 5px 0; font-size: 12px;"><b>Today's Dues:</b> ${formatCurrency(todayDues)}</p>
          <p style="margin: 5px 0; font-size: 12px;"><b>Previous Dues Amount Received(-):</b> ${formatCurrency(-prevReceived)}</p>
          <p style="margin: 5px 0; font-size: 12px;"><b>Total Dues Till Date:</b> ${formatCurrency(totalDuesTillDate)}</p>
        </div>
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
    // Fetch 2x period so we can split into Current + Previous
    const allData = await getRecordsByPeriod(Expense, days * 2);

    // ---- PERIOD BOUNDARIES ----
    const { currentStart, currentEnd, previousStart, previousEnd } = getPeriodBoundaries(days);

    const currentData = allData.filter(r => isRecordInPeriod(r.createdAt, currentStart, currentEnd));
    const previousData = allData.filter(r => isRecordInPeriod(r.createdAt, previousStart, previousEnd));

    // Table shows only current period records
    const tableData = currentData;

    const todayExpenses = currentData.reduce((s, r) => s + safeNum(r.amount), 0);
    const prevExpenses = previousData.reduce((s, r) => s + safeNum(r.amount), 0);
    const totalAmount = todayExpenses + prevExpenses;

    const monthTotals = await getMonthToDateTotals(Expense);
    const tillYesterdayTotals = await getTillYesterdayTotals(Expense, previousStart);

    console.log("[EXPENSE PDF] Today's Expenses:", todayExpenses);
    console.log("[EXPENSE PDF] Previous Expenses:", prevExpenses);
    console.log("[EXPENSE PDF] Total Expenses:", totalAmount);
    console.log("[EXPENSE PDF] Month Expenses:", monthTotals.totalAmount);
    console.log("[EXPENSE PDF] Till Yesterday Expenses:", tillYesterdayTotals.totalAmount);

    const rows = tableData
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

      <div style="display: flex; justify-content: space-between; gap: 16px; margin: 20px 0;">
        <div style="flex: 1; padding: 12px; background: #f9f9f9; border: 1px solid #ddd; border-radius: 4px;">
          <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 6px; text-align: center;">TILL YESTERDAY</h3>
          <p style="margin: 5px 0; font-size: 12px;"><b>Total Records Till Yesterday:</b> ${tillYesterdayTotals.count}</p>
          <p style="margin: 5px 0; font-size: 12px;"><b>Total Expenses Till Yesterday:</b> ${formatCurrency(tillYesterdayTotals.totalAmount)}</p>
        </div>
        <div style="flex: 1; padding: 12px; background: #f9f9f9; border: 1px solid #ddd; border-radius: 4px;">
          <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 6px; text-align: center;">CURRENT PERIOD</h3>
          <p style="margin: 5px 0; font-size: 12px;"><b>Today's Expenses:</b> ${formatCurrency(todayExpenses)}</p>
          <p style="margin: 5px 0; font-size: 12px;"><b>Previous Expenses:</b> ${formatCurrency(prevExpenses)}</p>
          <p style="margin: 5px 0; font-size: 12px;"><b>Total Expenses (Current Month):</b> ${formatCurrency(monthTotals.totalAmount)}</p>
        </div>
        <div style="flex: 1; padding: 12px; background: #f9f9f9; border: 1px solid #ddd; border-radius: 4px;">
          <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 6px; text-align: center;">TOTAL</h3>
          <p style="margin: 5px 0; font-size: 12px;"><b>Grand Total Expenses:</b> ${formatCurrency(totalAmount)}</p>
        </div>
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
    // Fetch 2x period so we can split into Current + Previous
    const allData = await getRecordsByPeriod(Income, days * 2);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Income');

    // ---- PERIOD BOUNDARIES ----
    const { currentStart, currentEnd, previousStart, previousEnd } = getPeriodBoundaries(days);

    const currentData = allData.filter(r => isRecordInPeriod(r.createdAt, currentStart, currentEnd));
    const previousData = allData.filter(r => isRecordInPeriod(r.createdAt, previousStart, previousEnd));

    // Table shows only current period records
    const tableData = currentData;

    const totalBill = currentData.reduce((s, r) => s + safeNum(r.billAmount), 0) + previousData.reduce((s, r) => s + safeNum(r.billAmount), 0);
    const totalReceived = currentData.reduce((s, r) => s + safeNum(r.receivedAmount), 0) + previousData.reduce((s, r) => s + safeNum(r.receivedAmount), 0);
    const totalDues = totalBill - totalReceived;

    const todayRevenue = currentData.reduce((s, r) => s + safeNum(r.billAmount), 0);
    const todayReceived = currentData.reduce((s, r) => s + safeNum(r.receivedAmount), 0);
    const todayDues = todayRevenue - todayReceived;

    const prevRevenue = previousData.reduce((s, r) => s + safeNum(r.billAmount), 0);
    const prevReceived = previousData.reduce((s, r) => s + safeNum(r.receivedAmount), 0);
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

    const monthTotals = await getMonthToDateTotals(Income);
    const tillYesterdayTotals = await getTillYesterdayTotals(Income, previousStart);
    const totalDuesTillDate = (tillYesterdayTotals.totalDues + todayDues) - prevReceived;

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
    sheet.getColumn('O').width = 22;
    sheet.getColumn('P').width = 16;
    sheet.getColumn('Q').width = 3;   // blank spacer
    sheet.getColumn('R').width = 24;
    sheet.getColumn('S').width = 16;
    sheet.getColumn('T').width = 3;   // blank spacer
    sheet.getColumn('U').width = 24;
    sheet.getColumn('V').width = 16;

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

    // ===== 3-COLUMN SUMMARY BLOCK =====
    const setSummaryCell = (cellRef, label, value, isHeader = false) => {
      const cell = sheet.getCell(cellRef);
      cell.value = label || value;
      if (label) {
        cell.font = { bold: true };
        if (isHeader) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F4F4' } };
      }
    };

    // -- REVENUE COLUMN (O-P) --
    setSummaryCell('O1', 'REVENUE', null, true);
    setSummaryCell('O2', 'Revenue Till Yesterday', null, true);
    setSummaryCell('P2', null, tillYesterdayTotals.totalBill);
    setSummaryCell('O3', "Today's Revenue", null, true);
    setSummaryCell('P3', null, todayRevenue);
    setSummaryCell('O4', 'Total Revenue (Current Month)', null, true);
    setSummaryCell('P4', null, monthTotals.totalBill);

    // -- RECEIVED COLUMN (R-S) --
    setSummaryCell('R1', 'RECEIVED', null, true);
    setSummaryCell('R2', 'Total Received Till Yesterday', null, true);
    setSummaryCell('S2', null, tillYesterdayTotals.totalReceived);
    setSummaryCell('R3', 'Total Receive', null, true);
    setSummaryCell('S3', null, todayReceived);
    setSummaryCell('R4', 'Previous Due Amount Received(+)', null, true);
    setSummaryCell('S4', null, prevReceived);
    setSummaryCell('R5', 'Total Received (Current Month)', null, true);
    setSummaryCell('S5', null, monthTotals.totalReceived);

    // -- DUES COLUMN (U-V) --
    setSummaryCell('U1', 'DUES', null, true);
    setSummaryCell('U2', 'Total Due Till Yesterday', null, true);
    setSummaryCell('V2', null, tillYesterdayTotals.totalDues);
    setSummaryCell('U3', "Today's Dues", null, true);
    setSummaryCell('V3', null, todayDues);
    setSummaryCell('U4', 'Previous Dues Amount Received(-)', null, true);
    setSummaryCell('V4', null, -prevReceived);
    setSummaryCell('U5', 'Total Dues Till Date', null, true);
    setSummaryCell('V5', null, totalDuesTillDate);

    tableData.forEach((item, i) => {
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
    // Fetch 2x period so we can split into Current + Previous
    const allData = await getRecordsByPeriod(Expense, days * 2);

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

    const monthTotals = await getMonthToDateTotals(Expense);
    const tillYesterdayTotals = await getTillYesterdayTotals(Expense, previousStart);

    // set column widths (data columns + summary columns after Staff)
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
    const headers = ['S.No', 'Date', 'Category', 'Amount', 'Notes', 'Staff'];
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