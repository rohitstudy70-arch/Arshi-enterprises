const mongoose = require("mongoose");
const Income = require("../models/Income");
const Expense = require("../models/Expense");

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

    const [
      todayRevenue,
      todayExpenses,
      totalDues,
      monthlyIncomeTotals,
      monthlyExpenseTotals
    ] = await Promise.all([
      getSingleTotal(Income, { ...incomeMatch, createdAt: { $gte: startOfDay, $lt: endOfDay } }, "receivedAmount"),
      getSingleTotal(Expense, { ...expenseMatch, createdAt: { $gte: startOfDay, $lt: endOfDay } }, "amount"),
      getSingleTotal(Income, incomeMatch, "dues"),
      getMonthlyTotals(Income, incomeMatch, "receivedAmount", timezone, summaryWindowMonths),
      getMonthlyTotals(Expense, expenseMatch, "amount", timezone, summaryWindowMonths)
    ]);

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
      monthlySummary
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getDashboardData
};
