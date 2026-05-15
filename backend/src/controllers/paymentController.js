const Payment = require("../models/Payment");
const Income = require("../models/Income");
const { recalculateItemsForCdbId } = require("../services/dueService");

// ================= GET CUSTOMER DETAILS BY CDB ID =================
const getCustomerDetails = async (req, res) => {
  try {
    const { cdbId } = req.query;
    if (!cdbId || !String(cdbId).trim()) {
      return res.status(400).json({ message: "cdbId is required" });
    }

    const normalizedCdbId = String(cdbId).trim();

    const income = await Income.findOne({ cbNumber: normalizedCdbId })
      .sort({ createdAt: -1 })
      .lean();

    if (!income) {
      return res.status(404).json({ message: "No records found for this customer" });
    }

    const billAmount = Number(income.billAmount) || 0;
    const receivedAmount = Number(income.receivedAmount) || 0;
    const previousDuesReceived = Number(income.previousDuesReceived) || 0;
    const currentDue = billAmount - receivedAmount;

    return res.status(200).json({
      cdbId: normalizedCdbId,
      customerName: income.clientName,
      currentDue,
      imeiNumber: income.imeiLastSix || income.imeiNo || "",
      vehicleNumber: income.vehicleChassisNo || "",
      chassisNumber: income.model || ""
    });
  } catch (error) {
    console.error("GET CUSTOMER DETAILS ERROR 👉", error);
    return res.status(500).json({ message: error.message });
  }
};

// ================= SAVE PAYMENT =================
const savePayment = async (req, res) => {
  try {
    const {
      cdbId,
      customerName,
      paymentDate,
      paymentAmount,
      paymentMode,
      referenceNumber,
      imeiNumber,
      vehicleNumber,
      chassisNumber,
      previousDue
    } = req.body;

    // Validation
    if (!cdbId || !String(cdbId).trim()) {
      return res.status(400).json({ message: "cdbId is required" });
    }

    if (!customerName || !String(customerName).trim()) {
      return res.status(400).json({ message: "customerName is required" });
    }

    if (paymentAmount === undefined || paymentAmount === null) {
      return res.status(400).json({ message: "paymentAmount is required" });
    }

    if (!paymentMode || !["cash", "upi", "bank"].includes(paymentMode)) {
      return res.status(400).json({ message: "Valid paymentMode is required (cash, upi, bank)" });
    }

    // Reference number required for UPI and Bank
    if ((paymentMode === "upi" || paymentMode === "bank") && !String(referenceNumber || "").trim()) {
      return res.status(400).json({ message: "Reference number is required for UPI and Bank payments" });
    }

    const normalizedCdbId = String(cdbId).trim();
    const paymentAmountNum = Number(paymentAmount);
    const previousDueNum = Number(previousDue) || 0;

    // Validation: No negative values
    if (paymentAmountNum < 0) {
      return res.status(400).json({ message: "Payment amount cannot be negative" });
    }

    if (previousDueNum < 0) {
      return res.status(400).json({ message: "Previous due cannot be negative" });
    }

    // Validation: Payment amount cannot be greater than current due
    if (paymentAmountNum > previousDueNum) {
      return res.status(400).json({ message: "Payment amount cannot be greater than current due" });
    }

    // Calculate new due
    const newDue = previousDueNum - paymentAmountNum;

    // Determine status
    let status = "NO_UPDATE";
    if (paymentAmountNum === 0) {
      status = "NO_UPDATE";
    } else if (newDue === 0) {
      status = "PAID";
    } else if (newDue > 0) {
      status = "PARTIAL";
    }

    // If no payment amount, don't save
    if (paymentAmountNum === 0) {
      return res.status(400).json({ message: "Payment amount must be greater than 0" });
    }

    // Save payment record
    const payment = await Payment.create({
      cdbId: normalizedCdbId,
      customerName: String(customerName).trim(),
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      paymentAmount: paymentAmountNum,
      paymentMode,
      referenceNumber: String(referenceNumber || "").trim(),
      imeiNumber: String(imeiNumber || "").trim(),
      vehicleNumber: String(vehicleNumber || "").trim(),
      chassisNumber: String(chassisNumber || "").trim(),
      previousDue: previousDueNum,
      newDue,
      status,
      userId: req.user.id
    });

    // Update the most recent income record's received amount
    const income = await Income.findOne({ cbNumber: normalizedCdbId })
      .sort({ createdAt: -1 });

    if (income) {
      const currentBillAmount = Number(income.billAmount) || 0;

      // Calculate new received amount: Bill Amount - Remaining Due
      const newReceivedAmount = currentBillAmount - newDue;

      income.receivedAmount = newReceivedAmount;

      // Update payment fields based on new payment mode
      if (paymentMode === "cash") {
        income.paymentMode = "cash";
        income.cashAmount = newReceivedAmount;
        income.upiAmount = 0;
        income.upiReferenceId = "";
        income.bankPersonName = "";
        income.cashReceivedBy = req.user.username || "Admin";
      } else if (paymentMode === "upi") {
        income.paymentMode = "upi";
        income.upiAmount = newReceivedAmount;
        income.cashAmount = 0;
        income.cashReceivedBy = "";
        income.upiReferenceId = referenceNumber;
        income.bankPersonName = "Admin";
      } else if (paymentMode === "bank") {
        income.paymentMode = "bank";
        income.upiAmount = newReceivedAmount;
        income.cashAmount = 0;
        income.cashReceivedBy = "";
        income.upiReferenceId = referenceNumber;
        income.bankPersonName = "Admin";
      }

      await income.save();

      // Recalculate item-level dues
      await recalculateItemsForCdbId(normalizedCdbId);
    }

    return res.status(201).json({
      message: "Payment recorded successfully",
      payment,
      newDue
    });
  } catch (error) {
    console.error("SAVE PAYMENT ERROR 👉", error);
    return res.status(500).json({ message: error.message });
  }
};

// ================= GET PAYMENT HISTORY =================
const getPaymentHistory = async (req, res) => {
  try {
    const { cdbId } = req.query;

    const filter = {};
    if (cdbId) {
      filter.cdbId = String(cdbId).trim();
    }

    const payments = await Payment.find(filter)
      .populate("userId", "username")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ payments });
  } catch (error) {
    console.error("GET PAYMENT HISTORY ERROR 👉", error);
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getCustomerDetails,
  savePayment,
  getPaymentHistory
};
