const Expense = require("../models/Expense");
const { buildScopedFilter } = require("../utils/recordFilters");

const getStatusCode = (error) => {
  return error.name === "ValidationError" ? 400 : 500;
};

const addExpense = async (req, res) => {
  try {
    const { category, amount, notes } = req.body;

    const expense = await Expense.create({
      userId: req.user.id,
      category,
      amount,
      notes
    });

    return res.status(201).json({ expense });
  } catch (error) {
    return res.status(getStatusCode(error)).json({ message: error.message });
  }
};

const getExpenses = async (req, res) => {
  try {
    const expenses = await Expense.find(buildScopedFilter(req.user, req.query))
      .populate("userId", "username role")
      .sort({ createdAt: -1 });

    return res.status(200).json({ expenses });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updateExpense = async (req, res) => {
  try {
    const allowedFields = ["category", "amount", "notes"];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([key]) => allowedFields.includes(key))
    );

    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({ message: "Expense record not found" });
    }

    if (req.user.role === "executive" && String(expense.userId) !== String(req.user.id)) {
      return res.status(403).json({ message: "You can only edit your own records" });
    }

    Object.assign(expense, updates);
    await expense.save();

    const populatedExpense = await Expense.findById(expense._id).populate("userId", "username role");

    return res.status(200).json({ expense: populatedExpense });
  } catch (error) {
    return res.status(getStatusCode(error)).json({ message: error.message });
  }
};

const deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({ message: "Expense record not found" });
    }

    if (req.user.role === "executive" && String(expense.userId) !== String(req.user.id)) {
      return res.status(403).json({ message: "You can only delete your own records" });
    }

    await expense.deleteOne();

    return res.status(200).json({ message: "Expense record deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  addExpense,
  getExpenses,
  updateExpense,
  deleteExpense
};
