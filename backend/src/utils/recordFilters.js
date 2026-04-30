const mongoose = require("mongoose");

const buildScopedFilter = (user, query = {}) => {
  const filter = user.role === "admin" ? {} : { userId: new mongoose.Types.ObjectId(user.id) };

  if (user.role === "admin" && query.userId) {
    if (!mongoose.isValidObjectId(query.userId)) {
      throw new Error("Invalid userId");
    }

    filter.userId = new mongoose.Types.ObjectId(query.userId);
  }

  if (query.days && !isNaN(Number(query.days))) {
    const days = Number(query.days);
    const now = new Date();
    const start = new Date(now);
    // days=1 -> today only; days=7 -> last 7 days including today
    start.setDate(start.getDate() - days + 1);
    start.setHours(0, 0, 0, 0);
    filter.createdAt = { $gte: start, $lte: now };
  } else if (query.startDate || query.endDate) {
    filter.createdAt = {};

    if (query.startDate) {
      const startDate = new Date(query.startDate);
      startDate.setHours(0, 0, 0, 0);
      filter.createdAt.$gte = startDate;
    }

    if (query.endDate) {
      const endDate = new Date(query.endDate);
      endDate.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = endDate;
    }
  }

  return filter;
};

module.exports = {
  buildScopedFilter
};
