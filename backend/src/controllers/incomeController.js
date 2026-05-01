const Income = require("../models/Income");
const { buildScopedFilter } = require("../utils/recordFilters");

// ===== STATUS HELPER =====
const getStatusCode = (error) => {
  return error.name === "ValidationError" ? 400 : 500;
};

// ===== AUTO-GENERATE SEQUENTIAL CDB NUMBER =====
const getNextCdbNumber = async () => {
  const records = await Income.find({}, "cbNumber").lean();
  let max = 0;
  for (const r of records) {
    const num = parseInt(r.cbNumber, 10);
    if (!isNaN(num) && num > max) {
      max = num;
    }
  }
  return String(max + 1).padStart(2, "0");
};

// ================= ADD INCOME =================
const addIncome = async (req, res) => {
  try {
    const {
      clientName,
      description,
      reference,
      mobile1,
      mobile2,
      address,
      district,
      vehicleChassisNo,
      clientUserId,
      item,
      model,
      imeiNo,
      imeiLastSix,
      vtsNo,
      technician,
      quantity,
      billAmount,
      receivedAmount,
      paymentMode,
      upiReferenceId,
      bankPersonName,
      cashReceivedBy,
      cashAmount,
      upiAmount,
      cctvDetails,
      cctvSerialNo
    } = req.body;

    const cdbNumber = await getNextCdbNumber();

    const income = await Income.create({
      userId: req.user.id,
      clientName,
      cbNumber: cdbNumber,
      description,
      reference,
      mobile1,
      mobile2,
      address,
      district,
      vehicleChassisNo,
      clientUserId,
      item,
      model,
      imeiNo,
      imeiLastSix,
      vtsNo,
      technician,
      quantity,
      billAmount,
      receivedAmount,
      paymentMode,
      upiReferenceId,
      bankPersonName,
      cashReceivedBy,
      cashAmount,
      upiAmount,
      cctvDetails,
      cctvSerialNo
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
      "reference",
      "mobile1",
      "mobile2",
      "address",
      "district",
      "vehicleChassisNo",
      "clientUserId",
      "item",
      "model",
      "imeiNo",
      "imeiLastSix",
      "vtsNo",
      "technician",
      "quantity",
      "billAmount",
      "receivedAmount",
      "paymentMode",
      "upiReferenceId",
      "bankPersonName",
      "cashReceivedBy",
      "cashAmount",
      "upiAmount",
      "cctvDetails",
      "cctvSerialNo"
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

    if (req.user.role === "executive" && String(income.userId) !== String(req.user.id)) {
      return res.status(403).json({ message: "You can only edit your own records" });
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

    if (req.user.role === "executive" && String(income.userId) !== String(req.user.id)) {
      return res.status(403).json({ message: "You can only delete your own records" });
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