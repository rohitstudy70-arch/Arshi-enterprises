const mongoose = require("mongoose");
const Income = require("../models/Income");
const Expense = require("../models/Expense");
const User = require("../models/User");

const getUserMatch = (user) => {
  if (user.role === "admin") {
    return {};
  }

  return { userId: new mongoose.Types.ObjectId(user.id) };
};

const getSingleTotal = async (model, match, field) => {
  const result = await model.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        total: { $sum: `$${field}` }
      }
    }
  ]);

  return result[0]?.total || 0;
};

const getIncomeDateExpr = () => ({ $ifNull: ["$transaction_date", "$createdAt"] });

const buildIncomeDateMatch = (baseMatch, start, end) => ({
  ...baseMatch,
  $expr: {
    $and: [
      { $gte: [getIncomeDateExpr(), start] },
      { $lt: [getIncomeDateExpr(), end] }
    ]
  }
});

const getMonthRangeFromQuery = (query) => {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  if (query.period === "day") {
    const end = new Date(todayStart);
    end.setDate(end.getDate() + 1);
    return {
      monthKey: "",
      start: todayStart,
      end
    };
  }

  if (query.period === "year") {
    return {
      monthKey: String(now.getFullYear()),
      start: new Date(now.getFullYear(), 0, 1),
      end: new Date(now.getFullYear() + 1, 0, 1)
    };
  }

  if (query.startDate || query.endDate) {
    const start = query.startDate ? new Date(query.startDate) : new Date(0);
    start.setHours(0, 0, 0, 0);
    const end = query.endDate ? new Date(query.endDate) : new Date();
    end.setHours(23, 59, 59, 999);
    return {
      monthKey: "",
      start,
      end
    };
  }

  if (query.month && /^\d{4}-\d{2}$/.test(String(query.month))) {
    const [year, month] = String(query.month).split("-").map(Number);
    return {
      monthKey: query.month,
      start: new Date(year, month - 1, 1),
      end: new Date(year, month, 1)
    };
  }

  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return {
    monthKey,
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 1)
  };
};

const getSummaryWindowMonths = (query) => {
  const parsedValue = Number.parseInt(query.months, 10);

  if (Number.isNaN(parsedValue)) {
    return 12;
  }

  return Math.min(Math.max(parsedValue, 1), 24);
};

const buildMonthBuckets = (monthCount) => {
  const currentMonthStart = new Date();
  currentMonthStart.setDate(1);
  currentMonthStart.setHours(0, 0, 0, 0);

  const months = [];

  for (let offset = monthCount - 1; offset >= 0; offset -= 1) {
    const monthDate = new Date(currentMonthStart);
    monthDate.setMonth(currentMonthStart.getMonth() - offset);

    const year = monthDate.getFullYear();
    const month = String(monthDate.getMonth() + 1).padStart(2, "0");

    months.push({
      key: `${year}-${month}`,
      start: monthDate
    });
  }

  const rangeStart = new Date(months[0].start);
  const rangeEnd = new Date(currentMonthStart);
  rangeEnd.setMonth(rangeEnd.getMonth() + 1);

  return { months, rangeStart, rangeEnd };
};

const getMonthlyTotals = async (model, match, amountField, timezone, monthCount) => {
  const { rangeStart, rangeEnd } = buildMonthBuckets(monthCount);

  return model.aggregate([
    {
      $match: {
        ...match,
        $expr: {
          $and: [
            { $gte: [model.modelName === "Income" ? getIncomeDateExpr() : "$createdAt", rangeStart] },
            { $lt: [model.modelName === "Income" ? getIncomeDateExpr() : "$createdAt", rangeEnd] }
          ]
        }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: "%Y-%m",
            date: model.modelName === "Income" ? getIncomeDateExpr() : "$createdAt",
            timezone
          }
        },
        total: {
          $sum: `$${amountField}`
        }
      }
    }
  ]);
};

const getFinancialSummary = async (match, periodStart, periodEnd, todayStart, todayEnd) => {
  const result = await Income.aggregate([
    { $match: buildIncomeDateMatch(match, periodStart, periodEnd) },
    {
      $group: {
        _id: null,
        revenueTillYesterday: {
          $sum: {
            $cond: [{ $lt: [getIncomeDateExpr(), todayStart] }, "$billAmount", 0]
          }
        },
        todayRevenue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: [getIncomeDateExpr(), todayStart] },
                  { $lt: [getIncomeDateExpr(), todayEnd] }
                ]
              },
              "$billAmount",
              0
            ]
          }
        },
        receivedTillYesterday: {
          $sum: {
            $cond: [{ $lt: [getIncomeDateExpr(), todayStart] }, "$receivedAmount", 0]
          }
        },
        todayReceived: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: [getIncomeDateExpr(), todayStart] },
                  { $lt: [getIncomeDateExpr(), todayEnd] }
                ]
              },
              "$receivedAmount",
              0
            ]
          }
        },
        previousDuesReceived: { $sum: "$previousDuesReceived" },
        previousDuesReceivedToday: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: [getIncomeDateExpr(), todayStart] },
                  { $lt: [getIncomeDateExpr(), todayEnd] }
                ]
              },
              "$previousDuesReceived",
              0
            ]
          }
        },
        duesTillYesterday: {
          $sum: {
            $cond: [{ $lt: [getIncomeDateExpr(), todayStart] }, "$dues", 0]
          }
        },
        todayDues: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: [getIncomeDateExpr(), todayStart] },
                  { $lt: [getIncomeDateExpr(), todayEnd] }
                ]
              },
              "$dues",
              0
            ]
          }
        },
        totalRevenueRaw: { $sum: "$billAmount" },
        totalReceivedRaw: { $sum: "$receivedAmount" },
        totalDuesRaw: { $sum: "$dues" }
      }
    }
  ]);

  const summary = result[0] || {};
  const totalRevenue = Number(summary.revenueTillYesterday || 0) + Number(summary.todayRevenue || 0);
  const totalReceived =
    Number(summary.receivedTillYesterday || 0) +
    Number(summary.todayReceived || 0) +
    Number(summary.previousDuesReceived || 0);
  const totalDues =
    Number(summary.duesTillYesterday || 0) +
    Number(summary.todayDues || 0) -
    Number(summary.previousDuesReceived || 0);

  return {
    revenueTillYesterday: summary.revenueTillYesterday || 0,
    todayRevenue: summary.todayRevenue || 0,
    totalRevenue,
    receivedTillYesterday: summary.receivedTillYesterday || 0,
    todayReceived: summary.todayReceived || 0,
    previousDuesReceived: summary.previousDuesReceived || 0,
    previousDuesReceivedToday: summary.previousDuesReceivedToday || 0,
    totalReceived,
    duesTillYesterday: summary.duesTillYesterday || 0,
    todayDues: summary.todayDues || 0,
    totalDues: Math.max(0, totalDues),
    rawTotals: {
      revenue: summary.totalRevenueRaw || 0,
      received: summary.totalReceivedRaw || 0,
      dues: summary.totalDuesRaw || 0
    }
  };
};

const getDashboardData = async (req, res) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const summaryWindowMonths = getSummaryWindowMonths(req.query);
    const incomeMatch = getUserMatch(req.user);
    const expenseMatch = getUserMatch(req.user);
    const { months } = buildMonthBuckets(summaryWindowMonths);
    const serviceTypeMatch = req.query.serviceType
      ? { $or: [{ serviceType: req.query.serviceType }, { serviceType: { $in: [null, ""] }, description: req.query.serviceType }] }
      : null;
    const filteredIncomeMatch = serviceTypeMatch ? { ...incomeMatch, ...serviceTypeMatch } : incomeMatch;

    const todayMatchIncome = buildIncomeDateMatch(filteredIncomeMatch, startOfDay, endOfDay);
    const todayMatchExpense = { ...expenseMatch, createdAt: { $gte: startOfDay, $lt: endOfDay } };

    const selectedMonth = getMonthRangeFromQuery(req.query);
    const monthStart = selectedMonth.start;
    const nextMonthStart = selectedMonth.end;

    const monthMatchIncome = buildIncomeDateMatch(filteredIncomeMatch, monthStart, nextMonthStart);
    const monthMatchExpense = { ...expenseMatch, createdAt: { $gte: monthStart, $lt: nextMonthStart } };

    const [
      todayRevenue,
      todayExpenses,
      totalDues,
      monthlyIncomeTotals,
      monthlyExpenseTotals,
      perExecutiveIncomeToday,
      perExecutiveExpenseToday,
      perExecutiveIncomeMonth,
      perExecutiveExpenseMonth,
      dateWiseIncome,
      financialSummary,
      executives
    ] = await Promise.all([
      getSingleTotal(Income, todayMatchIncome, "receivedAmount"),
      getSingleTotal(Expense, todayMatchExpense, "amount"),
      getSingleTotal(Income, filteredIncomeMatch, "dues"),
      getMonthlyTotals(Income, filteredIncomeMatch, "receivedAmount", timezone, summaryWindowMonths),
      getMonthlyTotals(Expense, expenseMatch, "amount", timezone, summaryWindowMonths),
      Income.aggregate([
        { $match: todayMatchIncome },
        { $group: { _id: "$userId", collected: { $sum: "$receivedAmount" }, billed: { $sum: "$billAmount" }, entries: { $sum: 1 } } }
      ]),
      Expense.aggregate([
        { $match: todayMatchExpense },
        { $group: { _id: "$userId", expense: { $sum: "$amount" }, entries: { $sum: 1 } } }
      ]),
      Income.aggregate([
        { $match: monthMatchIncome },
        { $group: { _id: "$userId", collected: { $sum: "$receivedAmount" }, billed: { $sum: "$billAmount" }, entries: { $sum: 1 } } }
      ]),
      Expense.aggregate([
        { $match: monthMatchExpense },
        { $group: { _id: "$userId", expense: { $sum: "$amount" }, entries: { $sum: 1 } } }
      ]),
      Income.aggregate([
        { $match: monthMatchIncome },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: getIncomeDateExpr(),
                timezone
              }
            },
            entries: { $sum: 1 },
            totalAmount: { $sum: "$receivedAmount" },
            totalBill: { $sum: "$billAmount" },
            previousDuesReceived: { $sum: "$previousDuesReceived" },
            totalDues: { $sum: "$dues" }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      getFinancialSummary(filteredIncomeMatch, monthStart, nextMonthStart, startOfDay, endOfDay),
      req.user.role === "admin"
        ? User.find({ role: "executive" }).select("_id username").lean()
        : User.find({ _id: req.user.id }).select("_id username").lean()
    ]);

    // Build per-executive today + this-month breakdown
    const incomeByUserToday = new Map(perExecutiveIncomeToday.map((r) => [String(r._id), r]));
    const expenseByUserToday = new Map(perExecutiveExpenseToday.map((r) => [String(r._id), r]));
    const incomeByUserMonth = new Map(perExecutiveIncomeMonth.map((r) => [String(r._id), r]));
    const expenseByUserMonth = new Map(perExecutiveExpenseMonth.map((r) => [String(r._id), r]));

    const executiveBreakdown = executives.map((u) => {
      const incT = incomeByUserToday.get(String(u._id)) || {};
      const expT = expenseByUserToday.get(String(u._id)) || {};
      const incM = incomeByUserMonth.get(String(u._id)) || {};
      const expM = expenseByUserMonth.get(String(u._id)) || {};
      return {
        userId: String(u._id),
        username: u.username,
        todayCollected: incT.collected || 0,
        todayBilled: incT.billed || 0,
        todayIncomeEntries: incT.entries || 0,
        todayExpense: expT.expense || 0,
        todayExpenseEntries: expT.entries || 0,
        monthCollected: incM.collected || 0,
        monthBilled: incM.billed || 0,
        monthIncomeEntries: incM.entries || 0,
        monthExpense: expM.expense || 0,
        monthExpenseEntries: expM.entries || 0
      };
    }).sort((a, b) => b.monthCollected - a.monthCollected);

    const incomeMap = new Map(monthlyIncomeTotals.map((item) => [item._id, item.total]));
    const expenseMap = new Map(monthlyExpenseTotals.map((item) => [item._id, item.total]));

    const monthlySummary = months.map((month) => ({
      month: month.key,
      income: incomeMap.get(month.key) || 0,
      expense: expenseMap.get(month.key) || 0
    }));

    return res.status(200).json({
      todayRevenue: financialSummary.todayRevenue,
      todayExpenses,
      totalDues: financialSummary.totalDues,
      financialSummary,
      selectedMonth: selectedMonth.monthKey,
      summaryWindowMonths,
      monthlySummary,
      dateWiseBreakdown: dateWiseIncome.map((row) => ({
        date: row._id,
        entries: row.entries,
        totalAmount: row.totalAmount,
        totalBill: row.totalBill,
        previousDuesReceived: row.previousDuesReceived || 0,
        totalDues: row.totalDues || 0
      })),
      executiveBreakdown
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getDashboardData
};
