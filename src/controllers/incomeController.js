const Income = require("../models/Income");
const { buildScopedFilter } = require("../utils/recordFilters");

// ===== STATUS HELPER =====
const getStatusCode = (error) => {
  return error.name === "ValidationError" ? 400 : 500;
};

// ================= ADD INCOME =================
const addIncome = async (req, res) => {
  try {
    const {
      clientName,
      cbNumber,
      description,
      reference,
      quantity,
      billAmount,
      receivedAmount,
      paymentMode,
      upiReferenceId
    } = req.body;

    // ✅ CHECK IF CB NUMBER ALREADY EXISTS
    const existingCB = await Income.findOne({ cbNumber: cbNumber.trim() });
    if (existingCB) {
      return res.status(400).json({ message: "Customer already exists with this CB number" });
    }

    const income = await Income.create({
      userId: req.user.id,
      clientName,
      cbNumber,
      description,
      reference, // ✅ IMPORTANT
      quantity,
      billAmount,
      receivedAmount,
      paymentMode,
      upiReferenceId
    });

    return res.status(201).json({ income });
  } catch (error) {
    console.error("ADD ERROR 👉", error);
    return res.status(getStatusCode(error)).json({ message: error.message });
  }
};

// ================= GET INCOMES =================
const getIncomes = async (req, res) => {
  try {
    const filter = buildScopedFilter(req.user, req.query);
    const incomes = await Income.find(filter)
      .populate("userId", "username role")
      .sort({ createdAt: -1 });

    return res.status(200).json({ incomes });
  } catch (error) {
    console.error("GET ERROR 👉", error);
    return res.status(500).json({ message: error.message });
  }
};

// ================= UPDATE =================
const updateIncome = async (req, res) => {
  try {
    const allowedFields = [
      "clientName",
      "cbNumber",
      "description",
      "reference", // ✅ IMPORTANT
      "quantity",
      "billAmount",
      "receivedAmount",
      "paymentMode",
      "upiReferenceId"
    ];

    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([key]) =>
        allowedFields.includes(key)
      )
    );

    const income = await Income.findById(req.params.id);

    if (!income) {
      return res.status(404).json({ message: "Income record not found" });
    }

    Object.assign(income, updates);
    await income.save();

    const populatedIncome = await Income.findById(income._id)
      .populate("userId", "username role");

    return res.status(200).json({ income: populatedIncome });
  } catch (error) {
    console.error("UPDATE ERROR 👉", error);
    return res.status(getStatusCode(error)).json({ message: error.message });
  }
};

// ================= DELETE =================
const deleteIncome = async (req, res) => {
  try {
    const income = await Income.findById(req.params.id);

    if (!income) {
      return res.status(404).json({ message: "Income record not found" });
    }

    await income.deleteOne();

    return res.status(200).json({
      message: "Income record deleted successfully"
    });
  } catch (error) {
    console.error("DELETE ERROR 👉", error);
    return res.status(500).json({ message: error.message });
  }
};

// ===== EXPORT =====
module.exports = {
  addIncome,
  getIncomes,
  updateIncome,
  deleteIncome
};