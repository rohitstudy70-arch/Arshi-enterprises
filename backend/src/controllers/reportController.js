const ExcelJS = require('exceljs');
const Income = require('../models/Income');
const Expense = require('../models/Expense');
const Item = require('../models/Item');

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
    {
      const userId = req.query.userId || null;
      const filter = {};
      if (userId) filter.userId = userId;

      const { currentStart, currentEnd } = getPeriodBoundaries(days);
      if (days < 999999) {
        filter.$or = [
          { transaction_date: { $gte: currentStart, $lt: currentEnd } },
          { transaction_date: { $exists: false }, createdAt: { $gte: currentStart, $lt: currentEnd } }
        ];
      }
      if (req.query.month && /^\d{4}-\d{2}$/.test(String(req.query.month))) {
        const [year, month] = String(req.query.month).split("-").map(Number);
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 1);
        filter.$or = [
          { transaction_date: { $gte: start, $lt: end } },
          { transaction_date: { $exists: false }, createdAt: { $gte: start, $lt: end } }
        ];
      }
      if (req.query.serviceType) {
        filter.$and = filter.$and || [];
        filter.$and.push({
          $or: [
            { serviceType: req.query.serviceType },
            { serviceType: { $in: [null, ""] }, description: req.query.serviceType }
          ]
        });
      }

      const tableData = await Income.find(filter)
        .populate('userId', 'username')
        .sort({ transaction_date: 1, createdAt: 1 })
        .lean();

      const workbook = new ExcelJS.Workbook();
      workbook.calcProperties.fullCalcOnLoad = true;
      const sheet = workbook.addWorksheet('Income');
      const headers = [
        'Date',
        'Payment Date',
        'CDB No',
        'Client Name',
        'Mobile 1',
        'Vehicle / Chassis',
        'Challan No',
        'Service Type',
        'Description',
        'CCTV Details / Model',
        'Serial No',
        'Model',
        'IMEI Last 6',
        'VTS No',
        'Technician',
        'Reference (Given By)',
        'Qty',
        'Bill Amount',
        'Received Amount',
        'Previous Dues Received',
        'Dues',
        'Payment Mode',
        'Cash Amount',
        'UPI Amount',
        'UPI / UTR Ref',
        'Bank Person',
        'Cash Received By',
        'Executive',
        'Remarks'
      ];
      headers.forEach((h, idx) => {
        const cell = sheet.getCell(1, idx + 1);
        cell.value = h;
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F4F4' } };
      });
      [14, 14, 12, 28, 16, 20, 20, 22, 30, 22, 18, 18, 16, 14, 18, 20, 8, 14, 16, 20, 14, 16, 14, 14, 20, 18, 20, 16, 30].forEach((width, idx) => {
        sheet.getColumn(idx + 1).width = width;
      });
      sheet.getColumn(1).numFmt = 'dd/mm/yyyy';
      sheet.getColumn(2).numFmt = 'dd/mm/yyyy';
      [17, 18, 19, 20, 22, 23].forEach((col) => {
        sheet.getColumn(col).numFmt = '#,##0.00';
      });

      const getRecordDate = (record) => new Date(record.transaction_date || record.createdAt);
      const todayStart = getReportDayStart();
      const todayEnd = addDays(todayStart, 1);
      const isBeforeToday = (record) => getRecordDate(record) < todayStart;
      const isToday = (record) => {
        const recordDate = getRecordDate(record);
        return recordDate >= todayStart && recordDate < todayEnd;
      };
      const getBillAmount = (record) => safeNum(record.billAmount);
      const getReceivedAmount = (record) => safeNum(record.receivedAmount) + safeNum(record.previousDuesReceived);
      const getDueAmount = (record) => getBillAmount(record) - getReceivedAmount(record);
      const sumBy = (records, picker) => records.reduce((total, record) => total + picker(record), 0);
      const beforeTodayData = tableData.filter(isBeforeToday);
      const todayData = tableData.filter(isToday);
      const revenueTillYesterday = sumBy(beforeTodayData, getBillAmount);
      const todayRevenue = sumBy(todayData, getBillAmount);
      const totalRevenue = sumBy(tableData, getBillAmount);
      const receivedTillYesterday = sumBy(beforeTodayData, getReceivedAmount);
      const todayReceived = sumBy(todayData, getReceivedAmount);
      const previousDuesReceivedTotal = sumBy(tableData, (record) => safeNum(record.previousDuesReceived));
      const totalReceived = sumBy(tableData, getReceivedAmount);
      const duesTillYesterday = sumBy(beforeTodayData, getDueAmount);
      const todayDues = sumBy(todayData, getDueAmount);
      const totalDues = sumBy(tableData, getDueAmount);

      tableData.forEach((r, i) => {
        const serviceType = String(r.serviceType || r.description || '').trim();
        const isCctv = serviceType === 'CCTV Installation';
        const row = i + 2;
        sheet.getCell(row, 1).value = new Date(r.transaction_date || r.createdAt);
        sheet.getCell(row, 2).value = r.paymentDate ? new Date(r.paymentDate) : null;
        sheet.getCell(row, 3).value = r.cbNumber || '';
        sheet.getCell(row, 4).value = r.clientName || '';
        sheet.getCell(row, 5).value = r.mobile1 || '';
        sheet.getCell(row, 6).value = r.vehicleChassisNo || '';
        sheet.getCell(row, 7).value = r.challanNo || '';
        sheet.getCell(row, 8).value = serviceType;
        sheet.getCell(row, 9).value = r.description || '';
        sheet.getCell(row, 10).value = isCctv ? (r.cctvDetails || '') : (r.model || '');
        sheet.getCell(row, 11).value = isCctv ? (r.cctvSerialNo || '') : '';
        sheet.getCell(row, 12).value = isCctv ? '' : (r.model || '');
        sheet.getCell(row, 13).value = r.imeiLastSix || '';
        sheet.getCell(row, 14).value = r.vtsNo || '';
        sheet.getCell(row, 15).value = r.technician || '';
        sheet.getCell(row, 16).value = r.reference || '';
        sheet.getCell(row, 17).value = r.quantity || 1;
        sheet.getCell(row, 18).value = safeNum(r.billAmount);
        sheet.getCell(row, 19).value = safeNum(r.receivedAmount);
        sheet.getCell(row, 20).value = safeNum(r.previousDuesReceived);
        sheet.getCell(row, 21).value = {
          formula: `R${row}-S${row}-T${row}`,
          result: safeNum(r.billAmount) - safeNum(r.receivedAmount) - safeNum(r.previousDuesReceived)
        };
        sheet.getCell(row, 22).value = r.paymentMode || '';
        sheet.getCell(row, 23).value = safeNum(r.cashAmount);
        sheet.getCell(row, 24).value = safeNum(r.upiAmount);
        sheet.getCell(row, 25).value = r.upiReferenceId || '';
        sheet.getCell(row, 26).value = r.bankPersonName || '';
        sheet.getCell(row, 27).value = r.cashReceivedBy || '';
        sheet.getCell(row, 28).value = r.userId?.username || '';
        sheet.getCell(row, 29).value = r.remarks || '';
      });

      const addSummaryBlock = (targetSheet, startCol, title, color, rows) => {
        targetSheet.mergeCells(1, startCol, 1, startCol + 1);
        const titleCell = targetSheet.getCell(1, startCol);
        titleCell.value = title;
        titleCell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 13 };
        titleCell.alignment = { horizontal: 'center' };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
        rows.forEach(([label, formula, result], index) => {
          const row = index + 2;
          targetSheet.getCell(row, startCol).value = label;
          targetSheet.getCell(row, startCol).font = { bold: true };
          targetSheet.getCell(row, startCol + 1).value = { formula, result };
          targetSheet.getCell(row, startCol + 1).numFmt = '#,##0.00';
          if (index === rows.length - 1) {
            targetSheet.getCell(row, startCol).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };
            targetSheet.getCell(row, startCol + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };
            targetSheet.getCell(row, startCol + 1).font = { bold: true };
          }
        });
        targetSheet.getColumn(startCol).width = 32;
        targetSheet.getColumn(startCol + 1).width = 16;
      };

      const summaryRows = {
        revenue: [
          ['Revenue till Yesterday', 'SUMIF(Income!A:A,"<"&TODAY(),Income!R:R)', revenueTillYesterday],
          ["Today's Revenue", 'SUMIFS(Income!R:R,Income!A:A,">="&TODAY(),Income!A:A,"<"&TODAY()+1)', todayRevenue],
          ['Total Revenue (Current Period)', 'SUM(Income!R:R)', totalRevenue]
        ],
        received: [
          ['Total Received till Yesterday', 'SUMIF(Income!A:A,"<"&TODAY(),Income!S:S)+SUMIF(Income!A:A,"<"&TODAY(),Income!T:T)', receivedTillYesterday],
          ["Today's Received", 'SUMIFS(Income!S:S,Income!A:A,">="&TODAY(),Income!A:A,"<"&TODAY()+1)+SUMIFS(Income!T:T,Income!A:A,">="&TODAY(),Income!A:A,"<"&TODAY()+1)', todayReceived],
          ['Previous Dues Amount Received (+)', 'SUM(Income!T:T)', previousDuesReceivedTotal],
          ['Total Received (Current Period)', 'SUM(Income!S:S)+SUM(Income!T:T)', totalReceived]
        ],
        dues: [
          ['Total Dues till Yesterday', 'SUMIF(Income!A:A,"<"&TODAY(),Income!U:U)', duesTillYesterday],
          ["Today's Dues", 'SUMIFS(Income!U:U,Income!A:A,">="&TODAY(),Income!A:A,"<"&TODAY()+1)', todayDues],
          ['Previous Dues Amount Received (-)', 'SUM(Income!T:T)', previousDuesReceivedTotal],
          ['Total Dues Till Date', 'SUM(Income!U:U)', totalDues]
        ]
      };

      // Set width for spacer columns
      sheet.getColumn(30).width = 4;
      sheet.getColumn(33).width = 4;
      sheet.getColumn(36).width = 4;

      // Add summary blocks outside data bounds to avoid overwriting Executive and Remarks
      addSummaryBlock(sheet, 31, 'REVENUE', 'FF15803D', summaryRows.revenue);
      addSummaryBlock(sheet, 34, 'RECEIVED', 'FFCA8A04', summaryRows.received);
      addSummaryBlock(sheet, 37, 'DUES', 'FFDC2626', summaryRows.dues);

      const dashboardSheet = workbook.addWorksheet('Dashboard');
      addSummaryBlock(dashboardSheet, 1, 'REVENUE', 'FF15803D', summaryRows.revenue);
      addSummaryBlock(dashboardSheet, 4, 'RECEIVED', 'FFCA8A04', summaryRows.received);
      addSummaryBlock(dashboardSheet, 7, 'DUES', 'FFDC2626', summaryRows.dues);
      dashboardSheet.views = [{ state: 'frozen', ySplit: 1 }];

      sheet.views = [{ state: 'frozen', ySplit: 1 }];
      sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: Math.max(tableData.length + 1, 1), column: headers.length }
      };

      const buffer = await workbook.xlsx.writeBuffer();
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length
      });
      return res.end(buffer);
    }

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

    // For daily report: till-yesterday is CUMULATIVE (all-time before today)
    // For multi-day report: till-yesterday is within selected period, before today
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
    sheet.getColumn('P').width = 14;  // Bill Amount
    sheet.getColumn('Q').width = 16;  // Received Amount
    sheet.getColumn('R').width = 18;  // Previous Dues Received
    sheet.getColumn('S').width = 14;  // Dues
    sheet.getColumn('T').width = 14;  // Payment Mode
    sheet.getColumn('U').width = 14;  // Cash Amount
    sheet.getColumn('V').width = 14;  // UPI Amount
    sheet.getColumn('W').width = 20;  // UPI Ref
    sheet.getColumn('X').width = 16;  // Bank Person
    sheet.getColumn('Y').width = 18;  // Cash Received By
    sheet.getColumn('Z').width = 16;  // Technician
    sheet.getColumn('AA').width = 16;  // Executive
    sheet.getColumn('AB').width = 28; // CCTV Details / Model
    sheet.getColumn('AC').width = 20; // Serial No
    sheet.getColumn('AD').width = 22; // Reference (Given By)

    // Apply Indian-style currency number format to numeric money columns
    const moneyFormat = '#,##0.00';
    ['P', 'Q', 'R', 'S', 'U', 'V'].forEach((c) => {
      sheet.getColumn(c).numFmt = moneyFormat;
    });
    // Summary value columns
    ['AG', 'AJ', 'AM'].forEach((c) => {
      sheet.getColumn(c).numFmt = moneyFormat;
    });
    sheet.getColumn('AE').width = 3;  // blank spacer
    sheet.getColumn('AF').width = 24; // Revenue label
    sheet.getColumn('AG').width = 16; // Revenue value
    sheet.getColumn('AH').width = 3;  // blank spacer
    sheet.getColumn('AI').width = 24; // Received label
    sheet.getColumn('AJ').width = 16; // Received value
    sheet.getColumn('AK').width = 3;  // blank spacer
    sheet.getColumn('AL').width = 24; // Dues label
    sheet.getColumn('AM').width = 16; // Dues value

    // headers in row 1
    const headers = [
      'S.No', 'Date', 'CDB No', 'Client Name', 'Mobile 1', 'Mobile 2',
      'Address', 'District', 'Vehicle / Chassis', 'User ID', 'Item',
      'Model', 'IMEI Last 6', 'VTS No', 'Qty',
      'Bill Amount', 'Received Amount', 'Previous Dues Received', 'Dues', 'Payment Mode',
      'Cash Amount', 'UPI Amount',
      'UPI / UTR Ref', 'Bank Person', 'Cash Received By', 'Technician', 'Executive', 'CCTV Details / Model', 'Serial No', 'Reference (Given By)', 'Remarks'
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

    // -- REVENUE COLUMN (AF-AG) --
    setSummaryCell('AF1', 'REVENUE', null, true);
    setSummaryCell('AF2', 'Revenue Till Yesterday', null, true);
    setSummaryCell('AG2', null, yesterdayRevenue);
    setSummaryCell('AF3', "Today's Revenue", null, true);
    setSummaryCell('AG3', null, todayRevenue);
    setSummaryCell('AF4', 'Total Revenue (Current Day/Period)', null, true);
    setSummaryCell('AG4', null, totalRevenue);

    // -- RECEIVED COLUMN (AI-AJ) --
    setSummaryCell('AI1', 'RECEIVED', null, true);
    setSummaryCell('AI2', 'Received Till Yesterday', null, true);
    setSummaryCell('AJ2', null, yesterdayReceived);
    setSummaryCell('AI3', "Today's Received", null, true);
    setSummaryCell('AJ3', null, todayReceived);
    setSummaryCell('AI4', days === 1 ? 'Total Received (Current Date)' : 'Total Received (Current Day/Period)', null, true);
    setSummaryCell('AJ4', null, totalReceived);

    // -- DUES COLUMN (AL-AM) --
    setSummaryCell('AL1', 'DUES', null, true);
    setSummaryCell('AL2', 'Dues Till Yesterday', null, true);
    setSummaryCell('AM2', null, yesterdayDues);
    setSummaryCell('AL3', "Today's Dues", null, true);
    setSummaryCell('AM3', null, todayDues);
    setSummaryCell('AL4', 'Total Dues (Current Day/Period)', null, true);
    setSummaryCell('AM4', null, totalDues);

    // Safe output helpers — never write undefined/null to Excel
    const safeStr = (val) => {
      if (val === undefined || val === null) return '';
      const s = String(val).trim();
      return s.length === 0 ? '' : s;
    };
    const safeStrOrDash = (val) => {
      const s = safeStr(val);
      return s === '' ? '-' : s;
    };
    const safeNumber = (val) => {
      const n = Number(val);
      return Number.isFinite(n) ? n : 0;
    };

    tableData.forEach((item, i) => {
      const rowNum = 2 + i;

      // Convert Mongoose doc -> plain object so all paths resolve consistently
      const r = typeof item.toObject === 'function' ? item.toObject() : item;

      // Read UPI ref from current OR legacy field names for backward compatibility
      const upiRef = safeStr(r.upiReferenceId || r.upiRefId || r.utrNumber || r.upiUtr);

      const pm = safeStr(r.paymentMode);
      const billAmt = safeNumber(r.billAmount);
      const recvAmt = safeNumber(r.receivedAmount);
      let cashAmt = safeNumber(r.cashAmount);
      let upiAmt = safeNumber(r.upiAmount);

      let pmLabel = pm;
      if (pm === 'split') {
        pmLabel = 'Split';
      } else if (pm === 'cash') {
        // Legacy records: cashAmount may be 0 even though full receipt was cash
        if (cashAmt === 0 && recvAmt > 0) cashAmt = recvAmt;
        upiAmt = 0;
      } else if (pm === 'upi') {
        if (upiAmt === 0 && recvAmt > 0) upiAmt = recvAmt;
        cashAmt = 0;
      }

      const staffName = safeStr(r.userId?.username || r.userId?.name || r.staff);

      sheet.getCell(rowNum, 1).value = i + 1;
      sheet.getCell(rowNum, 2).value = formatDate(r.createdAt);
      sheet.getCell(rowNum, 3).value = safeStr(r.cbNumber);
      sheet.getCell(rowNum, 4).value = safeStr(r.clientName);
      sheet.getCell(rowNum, 5).value = safeStr(r.mobile1);
      sheet.getCell(rowNum, 6).value = safeStr(r.mobile2);
      sheet.getCell(rowNum, 7).value = safeStr(r.address);
      sheet.getCell(rowNum, 8).value = safeStr(r.district);
      sheet.getCell(rowNum, 9).value = safeStr(r.vehicleChassisNo);
      sheet.getCell(rowNum, 10).value = safeStr(r.clientUserId);
      sheet.getCell(rowNum, 11).value = safeStr(r.item || r.description);
      sheet.getCell(rowNum, 12).value = safeStr(r.model);
      sheet.getCell(rowNum, 13).value = safeStr(r.imeiLastSix);
      sheet.getCell(rowNum, 14).value = safeStr(r.vtsNo);
      sheet.getCell(rowNum, 15).value = safeNumber(r.quantity);
      sheet.getCell(rowNum, 16).value = billAmt;
      sheet.getCell(rowNum, 17).value = recvAmt;
      sheet.getCell(rowNum, 18).value = safeNumber(r.previousDuesReceived);
      sheet.getCell(rowNum, 19).value = { formula: `P${rowNum}-Q${rowNum}` };
      sheet.getCell(rowNum, 20).value = pmLabel || '-';
      sheet.getCell(rowNum, 21).value = cashAmt;
      sheet.getCell(rowNum, 22).value = upiAmt;
      sheet.getCell(rowNum, 23).value = upiRef === '' ? '-' : upiRef;
      sheet.getCell(rowNum, 24).value = safeStrOrDash(r.bankPersonName);
      sheet.getCell(rowNum, 25).value = safeStrOrDash(r.cashReceivedBy);
      sheet.getCell(rowNum, 26).value = safeStr(r.technician);
      sheet.getCell(rowNum, 27).value = staffName;
      sheet.getCell(rowNum, 28).value = safeStr(r.cctvDetails);
      sheet.getCell(rowNum, 29).value = safeStr(r.cctvSerialNo);
      sheet.getCell(rowNum, 30).value = safeStrOrDash(r.reference);
      sheet.getCell(rowNum, 31).value = safeStr(r.remarks);
    });

    // Debug: log first record's UPI fields to verify mapping
    if (tableData.length > 0) {
      const sample = typeof tableData[0].toObject === 'function' ? tableData[0].toObject() : tableData[0];
      console.log('[INCOME EXCEL] Sample record UPI fields:', {
        paymentMode: sample.paymentMode,
        upiReferenceId: sample.upiReferenceId,
        cashAmount: sample.cashAmount,
        upiAmount: sample.upiAmount,
        staff: sample.userId?.username
      });
    }

    // Freeze header row for easier scrolling
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    // Add auto-filter for better usability
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: Math.max(tableData.length + 1, 1), column: 30 }
    };

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

    // Currency format
    const moneyFmt = '#,##0.00';
    ['D', 'I', 'L', 'O'].forEach((c) => { sheet.getColumn(c).numFmt = moneyFmt; });

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

    const categoryLabels = {
      petrol: 'Petrol & Other Conveyance',
      food: 'Food',
      material: 'Material Purchase',
      misc: 'Miscellaneous (Hotel & Other)'
    };
    const safeStrExp = (val) => {
      if (val === undefined || val === null) return '';
      const s = String(val).trim();
      return s;
    };

    tableData.forEach((item, i) => {
      const rowNum = 2 + i;
      const r = typeof item.toObject === 'function' ? item.toObject() : item;
      const cat = safeStrExp(r.category);
      sheet.getCell(rowNum, 1).value = i + 1;
      sheet.getCell(rowNum, 2).value = formatDate(r.createdAt);
      sheet.getCell(rowNum, 3).value = categoryLabels[cat] || cat;
      sheet.getCell(rowNum, 4).value = Number(r.amount) || 0;
      sheet.getCell(rowNum, 5).value = safeStrExp(r.notes);
      sheet.getCell(rowNum, 6).value = safeStrExp(r.userId?.username || r.userId?.name);
    });

    // Freeze header row for easier scrolling
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

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

// ================= LEDGER (TRANSACTIONS + SUMMARY) =================
// Each Income record produces:
//   - 1 BILL row (amount = billAmount)
//   - 1 PAYMENT row IF receivedAmount > 0 (amount = receivedAmount)
// Summary sheet uses SUMIFS formulas referencing Transactions sheet,
// so totals always stay consistent and self-recalculate in Excel.
const generateLedgerExcelByPeriod = async (req, res, days, filename) => {
  try {
    const userId = req.query.userId || null;
    const records = await getRecordsByPeriod(Income, days, userId);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Arshi Enterprises';
    workbook.created = new Date();

    // ============ SHEET 1: TRANSACTIONS ============
    const txSheet = workbook.addWorksheet('Transactions');

    const txHeaders = ['Date', 'CDB_ID', 'Customer Name', 'Type', 'Amount', 'Payment Mode', 'Description'];
    txHeaders.forEach((h, i) => {
      const cell = txSheet.getCell(1, i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' }, bottom: { style: 'thin' },
        left: { style: 'thin' }, right: { style: 'thin' }
      };
    });

    txSheet.getColumn(1).width = 14;  // Date
    txSheet.getColumn(2).width = 16;  // CDB_ID
    txSheet.getColumn(3).width = 28;  // Customer Name
    txSheet.getColumn(4).width = 12;  // Type
    txSheet.getColumn(5).width = 14;  // Amount
    txSheet.getColumn(6).width = 16;  // Payment Mode
    txSheet.getColumn(7).width = 36;  // Description
    txSheet.getColumn(5).numFmt = '#,##0.00';

    // Build customer map for summary; also write rows
    const customerMap = new Map(); // cbNumber -> { name }
    let rowIdx = 2;

    const writeTxRow = (date, cdbId, customer, type, amount, paymentMode, description) => {
      txSheet.getCell(rowIdx, 1).value = formatDate(date);
      txSheet.getCell(rowIdx, 2).value = cdbId;
      txSheet.getCell(rowIdx, 3).value = customer;
      txSheet.getCell(rowIdx, 4).value = type;
      txSheet.getCell(rowIdx, 5).value = Number(amount) || 0;
      txSheet.getCell(rowIdx, 6).value = paymentMode || '-';
      txSheet.getCell(rowIdx, 7).value = description || '';

      // Color BILL/PAYMENT type cells differently
      const typeCell = txSheet.getCell(rowIdx, 4);
      typeCell.alignment = { horizontal: 'center' };
      typeCell.font = { bold: true };
      if (type === 'BILL') {
        typeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE699' } };
      } else if (type === 'PAYMENT') {
        typeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6E0B4' } };
      }
      rowIdx += 1;
    };

    // Records are already sorted desc; iterate in chronological order for ledger feel
    const ordered = [...records].sort((a, b) => new Date(a.transaction_date || a.createdAt) - new Date(b.transaction_date || b.createdAt));

    ordered.forEach((rec) => {
      const r = typeof rec.toObject === 'function' ? rec.toObject() : rec;
      const cdbId = String(r.cbNumber || '').trim();
      const customer = String(r.clientName || '').trim();
      if (!customerMap.has(cdbId)) {
        customerMap.set(cdbId, { name: customer });
      }
      const billAmt = Number(r.billAmount) || 0;
      const recvAmt = Number(r.receivedAmount) || 0;
      const desc = String(r.serviceType || r.description || r.item || '').trim();

      // BILL row
      writeTxRow(r.transaction_date || r.createdAt, cdbId, customer, 'BILL', billAmt, '-', desc);

      // PAYMENT row(s) — current schema has one payment per record
      if (recvAmt > 0) {
        let pmLabel = '-';
        const pm = String(r.paymentMode || '').toLowerCase();
        if (pm === 'cash') pmLabel = 'Cash';
        else if (pm === 'upi') pmLabel = `UPI${r.upiReferenceId ? ` (${r.upiReferenceId})` : ''}`;
        else if (pm === 'split') {
          const c = Number(r.cashAmount) || 0;
          const u = Number(r.upiAmount) || 0;
          pmLabel = `Split (Cash ${c} + UPI ${u}${r.upiReferenceId ? ` / ${r.upiReferenceId}` : ''})`;
        }
        writeTxRow(r.transaction_date || r.createdAt, cdbId, customer, 'PAYMENT', recvAmt, pmLabel, desc);
      }
    });

    const lastTxRow = rowIdx - 1;
    // Auto-filter on header row covering all data
    txSheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: lastTxRow > 1 ? lastTxRow : 1, column: 7 }
    };
    txSheet.views = [{ state: 'frozen', ySplit: 1 }];

    // Light borders on all data cells
    for (let r = 2; r <= lastTxRow; r += 1) {
      for (let c = 1; c <= 7; c += 1) {
        const cell = txSheet.getCell(r, c);
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
        };
      }
    }

    // ============ SHEET 2: SUMMARY (per customer with SUMIFS) ============
    const sumSheet = workbook.addWorksheet('Summary');

    const sumHeaders = ['CDB_ID', 'Customer Name', 'Total Bill', 'Total Payment', 'Due'];
    sumHeaders.forEach((h, i) => {
      const cell = sumSheet.getCell(1, i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' }, bottom: { style: 'thin' },
        left: { style: 'thin' }, right: { style: 'thin' }
      };
    });

    sumSheet.getColumn(1).width = 16;
    sumSheet.getColumn(2).width = 32;
    sumSheet.getColumn(3).width = 16;
    sumSheet.getColumn(4).width = 16;
    sumSheet.getColumn(5).width = 16;
    [3, 4, 5].forEach((c) => { sumSheet.getColumn(c).numFmt = '#,##0.00'; });

    let sumRow = 2;
    Array.from(customerMap.entries()).forEach(([cdbId, info]) => {
      sumSheet.getCell(sumRow, 1).value = cdbId;
      sumSheet.getCell(sumRow, 2).value = info.name;

      // SUMIFS formulas reference Transactions sheet by absolute column refs
      sumSheet.getCell(sumRow, 3).value = {
        formula: `SUMIFS(Transactions!E:E, Transactions!B:B, A${sumRow}, Transactions!D:D, "BILL")`
      };
      sumSheet.getCell(sumRow, 4).value = {
        formula: `SUMIFS(Transactions!E:E, Transactions!B:B, A${sumRow}, Transactions!D:D, "PAYMENT")`
      };
      sumSheet.getCell(sumRow, 5).value = { formula: `C${sumRow}-D${sumRow}` };

      // Borders + alignment
      for (let c = 1; c <= 5; c += 1) {
        const cell = sumSheet.getCell(sumRow, c);
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
        };
      }
      sumRow += 1;
    });

    const lastSumRow = sumRow - 1;
    if (lastSumRow >= 2) {
      // Conditional formatting: highlight Due column red where Due > 0
      sumSheet.addConditionalFormatting({
        ref: `E2:E${lastSumRow}`,
        rules: [
          {
            type: 'cellIs',
            operator: 'greaterThan',
            formulae: ['0'],
            priority: 1,
            style: {
              fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFF8CBAD' } },
              font: { bold: true, color: { argb: 'FF9C0006' } }
            }
          },
          {
            type: 'cellIs',
            operator: 'lessThanOrEqual',
            formulae: ['0'],
            priority: 2,
            style: {
              fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFC6EFCE' } },
              font: { color: { argb: 'FF006100' } }
            }
          }
        ]
      });

      // Grand totals row
      const totalRow = lastSumRow + 1;
      sumSheet.getCell(totalRow, 2).value = 'GRAND TOTAL';
      sumSheet.getCell(totalRow, 2).font = { bold: true };
      sumSheet.getCell(totalRow, 3).value = { formula: `SUM(C2:C${lastSumRow})` };
      sumSheet.getCell(totalRow, 4).value = { formula: `SUM(D2:D${lastSumRow})` };
      sumSheet.getCell(totalRow, 5).value = { formula: `SUM(E2:E${lastSumRow})` };
      for (let c = 2; c <= 5; c += 1) {
        const cell = sumSheet.getCell(totalRow, c);
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
        cell.border = {
          top: { style: 'medium' }, bottom: { style: 'medium' },
          left: { style: 'thin' }, right: { style: 'thin' }
        };
      }
    }

    // Auto-filter for summary sheet (filter by CDB_ID, customer)
    sumSheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: Math.max(lastSumRow, 1), column: 5 }
    };
    sumSheet.views = [{ state: 'frozen', ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length
    });
    return res.end(buffer);
  } catch (err) {
    console.error('LEDGER EXCEL ERROR 👉', err);
    return res.status(500).send(err.message);
  }
};

const generateLedgerDailyExcel = (req, res) => generateLedgerExcelByPeriod(req, res, 1, 'ledger-daily.xlsx');
const generateLedgerWeeklyExcel = (req, res) => generateLedgerExcelByPeriod(req, res, 7, 'ledger-weekly.xlsx');
const generateLedgerMonthlyExcel = (req, res) => generateLedgerExcelByPeriod(req, res, 30, 'ledger-monthly.xlsx');
const generateLedgerYearlyExcel = (req, res) => generateLedgerExcelByPeriod(req, res, 365, 'ledger-yearly.xlsx');
const generateLedgerAllExcel = (req, res) => generateLedgerExcelByPeriod(req, res, 999999, 'ledger-all.xlsx');

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

// ===== CUSTOMER LEDGER EXCEL (by CDB_ID) =====
const generateCustomerLedgerExcel = async (req, res) => {
  try {
    const { cdbId } = req.query;
    if (!cdbId || !String(cdbId).trim()) {
      return res.status(400).json({ message: "cdbId query parameter is required" });
    }

    const normalizedCdbId = String(cdbId).trim();
    const incomes = await Income.find({ cbNumber: normalizedCdbId })
      .populate("userId", "username")
      .sort({ transaction_date: 1, createdAt: 1 })
      .lean();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Arshi Enterprises';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Customer Ledger');
    const headers = ['Date', 'Type', 'Amount', 'Payment Mode', 'Description', 'Staff'];
    headers.forEach((h, i) => {
      const cell = sheet.getCell(1, i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    sheet.getColumn(1).width = 14;
    sheet.getColumn(2).width = 12;
    sheet.getColumn(3).width = 14;
    sheet.getColumn(4).width = 24;
    sheet.getColumn(5).width = 36;
    sheet.getColumn(6).width = 18;
    sheet.getColumn(3).numFmt = '#,##0.00';

    let rowIdx = 2;
    let totalBill = 0;
    let totalPayment = 0;

    incomes.forEach((inc) => {
      const billAmt = Number(inc.billAmount) || 0;
      const recvAmt = Number(inc.receivedAmount) || 0;

      if (billAmt > 0) {
        sheet.getCell(rowIdx, 1).value = formatDate(inc.transaction_date || inc.createdAt);
        sheet.getCell(rowIdx, 2).value = 'BILL';
        sheet.getCell(rowIdx, 3).value = billAmt;
        sheet.getCell(rowIdx, 4).value = '-';
        sheet.getCell(rowIdx, 5).value = String(inc.serviceType || inc.description || '').trim();
        sheet.getCell(rowIdx, 6).value = inc.userId?.username || 'N/A';
        totalBill += billAmt;
        rowIdx++;
      }
      if (recvAmt > 0) {
        let pmLabel = String(inc.paymentMode || '').toUpperCase();
        if (inc.paymentMode === 'split') {
          pmLabel = `Split (Cash ${Number(inc.cashAmount) || 0} + UPI ${Number(inc.upiAmount) || 0})`;
        }
        sheet.getCell(rowIdx, 1).value = formatDate(inc.transaction_date || inc.createdAt);
        sheet.getCell(rowIdx, 2).value = 'PAYMENT';
        sheet.getCell(rowIdx, 3).value = recvAmt;
        sheet.getCell(rowIdx, 4).value = pmLabel;
        sheet.getCell(rowIdx, 5).value = String(inc.serviceType || inc.description || '').trim();
        sheet.getCell(rowIdx, 6).value = inc.userId?.username || 'N/A';
        totalPayment += recvAmt;
        rowIdx++;
      }
    });

    const dataEndRow = rowIdx - 1;

    // Summary block
    const sumRow = dataEndRow + 2;
    sheet.getCell(sumRow, 2).value = 'Total Bill:';
    sheet.getCell(sumRow, 2).font = { bold: true };
    sheet.getCell(sumRow, 3).value = totalBill;
    sheet.getCell(sumRow, 3).numFmt = '#,##0.00';

    sheet.getCell(sumRow + 1, 2).value = 'Total Payment:';
    sheet.getCell(sumRow + 1, 2).font = { bold: true };
    sheet.getCell(sumRow + 1, 3).value = totalPayment;
    sheet.getCell(sumRow + 1, 3).numFmt = '#,##0.00';

    sheet.getCell(sumRow + 2, 2).value = 'Due:';
    sheet.getCell(sumRow + 2, 2).font = { bold: true };
    sheet.getCell(sumRow + 2, 3).value = Math.max(0, totalBill - totalPayment);
    sheet.getCell(sumRow + 2, 3).numFmt = '#,##0.00';

    if (dataEndRow >= 2) {
      sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: dataEndRow, column: 6 }
      };
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
    }

    const buffer = await workbook.xlsx.writeBuffer();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="ledger-${normalizedCdbId}.xlsx"`,
      'Content-Length': buffer.length
    });
    return res.end(buffer);
  } catch (err) {
    console.error('CUSTOMER LEDGER EXCEL ERROR 👉', err);
    return res.status(500).send(err.message);
  }
};

// ===== DUE SUMMARY EXCEL (all customers) =====
const generateDueSummaryExcel = async (req, res) => {
  try {
    const summary = await Item.aggregate([
      {
        $group: {
          _id: "$cdbId",
          clientName: { $first: "$clientName" },
          totalBill: { $sum: "$price" },
          totalPaid: { $sum: "$paidAmount" },
          totalDue: { $sum: "$dueAmount" }
        }
      },
      { $sort: { totalDue: -1 } }
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Arshi Enterprises';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Due Summary');
    const headers = ['CDB_ID', 'Customer Name', 'Total Bill', 'Total Paid', 'Due', 'Status'];
    headers.forEach((h, i) => {
      const cell = sheet.getCell(1, i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    sheet.getColumn(1).width = 14;
    sheet.getColumn(2).width = 28;
    sheet.getColumn(3).width = 16;
    sheet.getColumn(4).width = 16;
    sheet.getColumn(5).width = 16;
    sheet.getColumn(6).width = 14;
    [3, 4, 5].forEach((c) => { sheet.getColumn(c).numFmt = '#,##0.00'; });

    let rowIdx = 2;
    summary.forEach((s) => {
      sheet.getCell(rowIdx, 1).value = s._id;
      sheet.getCell(rowIdx, 2).value = s.clientName || 'Unknown';
      sheet.getCell(rowIdx, 3).value = s.totalBill || 0;
      sheet.getCell(rowIdx, 4).value = s.totalPaid || 0;
      sheet.getCell(rowIdx, 5).value = s.totalDue || 0;
      sheet.getCell(rowIdx, 6).value = (s.totalDue || 0) <= 0 ? 'PAID' : 'DUE';

      // Conditional color for Due / Status
      if ((s.totalDue || 0) > 0) {
        sheet.getCell(rowIdx, 5).font = { bold: true, color: { argb: 'FF9C0006' } };
        sheet.getCell(rowIdx, 6).font = { bold: true, color: { argb: 'FF9C0006' } };
      } else {
        sheet.getCell(rowIdx, 6).font = { bold: true, color: { argb: 'FF006100' } };
      }
      rowIdx++;
    });

    // Grand totals
    const totalRow = rowIdx;
    sheet.getCell(totalRow, 2).value = 'GRAND TOTAL';
    sheet.getCell(totalRow, 2).font = { bold: true };
    sheet.getCell(totalRow, 3).value = { formula: `SUM(C2:C${rowIdx - 1})` };
    sheet.getCell(totalRow, 4).value = { formula: `SUM(D2:D${rowIdx - 1})` };
    sheet.getCell(totalRow, 5).value = { formula: `SUM(E2:E${rowIdx - 1})` };
    sheet.getCell(totalRow, 6).value = '-';
    for (let c = 2; c <= 6; c++) {
      sheet.getCell(totalRow, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
      sheet.getCell(totalRow, c).font = { bold: true };
    }

    if (rowIdx > 2) {
      sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: rowIdx - 1, column: 6 }
      };
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
    }

    const buffer = await workbook.xlsx.writeBuffer();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="due-summary.xlsx"',
      'Content-Length': buffer.length
    });
    return res.end(buffer);
  } catch (err) {
    console.error('DUE SUMMARY EXCEL ERROR 👉', err);
    return res.status(500).send(err.message);
  }
};

// ===== IMEI TRACKING EXCEL =====
const generateImeiTrackingExcel = async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};
    if (search && String(search).trim()) {
      const term = String(search).trim();
      query = {
        $or: [
          { imeiSerial: { $regex: term, $options: "i" } },
          { cdbId: { $regex: term, $options: "i" } },
          { itemName: { $regex: term, $options: "i" } },
          { clientName: { $regex: term, $options: "i" } }
        ]
      };
    }

    const items = await Item.find(query).sort({ date: -1 }).lean();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Arshi Enterprises';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('IMEI Tracking');
    const headers = ['Date', 'CDB_ID', 'Customer', 'Item Name', 'IMEI / Serial', 'Price', 'Paid', 'Due', 'Status'];
    headers.forEach((h, i) => {
      const cell = sheet.getCell(1, i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    sheet.getColumn(1).width = 14;
    sheet.getColumn(2).width = 14;
    sheet.getColumn(3).width = 24;
    sheet.getColumn(4).width = 28;
    sheet.getColumn(5).width = 22;
    sheet.getColumn(6).width = 14;
    sheet.getColumn(7).width = 14;
    sheet.getColumn(8).width = 14;
    sheet.getColumn(9).width = 12;
    [6, 7, 8].forEach((c) => { sheet.getColumn(c).numFmt = '#,##0.00'; });

    let rowIdx = 2;
    items.forEach((item) => {
      sheet.getCell(rowIdx, 1).value = formatDate(item.date);
      sheet.getCell(rowIdx, 2).value = item.cdbId;
      sheet.getCell(rowIdx, 3).value = item.clientName || '';
      sheet.getCell(rowIdx, 4).value = item.itemName || '';
      sheet.getCell(rowIdx, 5).value = item.imeiSerial || '';
      sheet.getCell(rowIdx, 6).value = item.price || 0;
      sheet.getCell(rowIdx, 7).value = item.paidAmount || 0;
      sheet.getCell(rowIdx, 8).value = item.dueAmount || 0;
      sheet.getCell(rowIdx, 9).value = item.status || 'UNPAID';

      // Status color coding
      const statusCell = sheet.getCell(rowIdx, 9);
      statusCell.alignment = { horizontal: 'center' };
      if (item.status === 'PAID') {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } };
        statusCell.font = { color: { argb: 'FF006100' }, bold: true };
      } else if (item.status === 'PARTIAL') {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE699' } };
        statusCell.font = { color: { argb: 'FF9C5700' }, bold: true };
      } else {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8CBAD' } };
        statusCell.font = { color: { argb: 'FF9C0006' }, bold: true };
      }
      rowIdx++;
    });

    if (rowIdx > 2) {
      sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: rowIdx - 1, column: 9 }
      };
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
    }

    const buffer = await workbook.xlsx.writeBuffer();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="imei-tracking${search ? '-' + String(search).trim() : ''}.xlsx"`,
      'Content-Length': buffer.length
    });
    return res.end(buffer);
  } catch (err) {
    console.error('IMEI TRACKING EXCEL ERROR 👉', err);
    return res.status(500).send(err.message);
  }
};

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
  generateExpenseAllExcel,

  // Ledger (Transaction-based) Reports
  generateLedgerDailyExcel,
  generateLedgerWeeklyExcel,
  generateLedgerMonthlyExcel,
  generateLedgerYearlyExcel,
  generateLedgerAllExcel,

  // Due & Item Tracking Reports
  generateCustomerLedgerExcel,
  generateDueSummaryExcel,
  generateImeiTrackingExcel
};
