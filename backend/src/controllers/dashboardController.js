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
        createdAt: {
          $gte: rangeStart,
          $lt: rangeEnd
        }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: "%Y-%m",
            date: "$createdAt",
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

    const todayMatchIncome = { ...incomeMatch, createdAt: { $gte: startOfDay, $lt: endOfDay } };
    const todayMatchExpense = { ...expenseMatch, createdAt: { $gte: startOfDay, $lt: endOfDay } };

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);
    const nextMonthStart = new Date(monthStart);
    nextMonthStart.setMonth(nextMonthStart.getMonth() + 1);

    const monthMatchIncome = { ...incomeMatch, createdAt: { $gte: monthStart, $lt: nextMonthStart } };
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
      executives
    ] = await Promise.all([
      getSingleTotal(Income, todayMatchIncome, "receivedAmount"),
      getSingleTotal(Expense, todayMatchExpense, "amount"),
      getSingleTotal(Income, incomeMatch, "dues"),
      getMonthlyTotals(Income, incomeMatch, "receivedAmount", timezone, summaryWindowMonths),
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
      todayRevenue,
      todayExpenses,
      totalDues,
      summaryWindowMonths,
      monthlySummary,
      executiveBreakdown
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getDashboardData
};
