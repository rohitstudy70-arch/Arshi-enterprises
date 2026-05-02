const mongoose = require("mongoose");

const applyDateFilter = (filter, dateRange) => {
  filter.$and = filter.$and || [];
  filter.$and.push({ $or: [
    { transaction_date: dateRange },
    { transaction_date: { $exists: false }, createdAt: dateRange }
  ] });
};

const buildScopedFilter = (user, query = {}) => {
  const filter = user.role === "admin" ? {} : { userId: new mongoose.Types.ObjectId(user.id) };

  if (user.role === "admin" && query.userId) {
    if (!mongoose.isValidObjectId(query.userId)) {
      throw new Error("Invalid userId");
    }

    filter.userId = new mongoose.Types.ObjectId(query.userId);
  }

  if (query.serviceType) {
    filter.$and = filter.$and || [];
    filter.$and.push({ $or: [
      { serviceType: query.serviceType },
      { serviceType: { $in: [null, ""] }, description: query.serviceType }
    ] });
  }

  if (query.month && /^\d{4}-\d{2}$/.test(String(query.month))) {
    const [year, month] = String(query.month).split("-").map(Number);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    applyDateFilter(filter, { $gte: start, $lt: end });
  } else if (query.days && !isNaN(Number(query.days))) {
    const days = Number(query.days);
    const now = new Date();
    const start = new Date(now);
    // days=1 -> today only; days=7 -> last 7 days including today
    start.setDate(start.getDate() - days + 1);
    start.setHours(0, 0, 0, 0);
    applyDateFilter(filter, { $gte: start, $lte: now });
  } else if (query.startDate || query.endDate) {
    const dateRange = {};

    if (query.startDate) {
      const startDate = new Date(query.startDate);
      startDate.setHours(0, 0, 0, 0);
      dateRange.$gte = startDate;
    }

    if (query.endDate) {
      const endDate = new Date(query.endDate);
      endDate.setHours(23, 59, 59, 999);
      dateRange.$lte = endDate;
    }
    applyDateFilter(filter, dateRange);
  }

  return filter;
};

module.exports = {
  buildScopedFilter
};
