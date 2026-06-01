const Income = require("../models/Income");
const Item = require("../models/Item");
const { recalculateItemsForCdbId } = require("../services/dueService");

// ================= CUSTOMER LEDGER =================
const getCustomerLedger = async (req, res) => {
  try {
    const { cdbId } = req.query;
    if (!cdbId || !String(cdbId).trim()) {
      return res.status(400).json({ message: "cdbId query parameter is required" });
    }

    const normalizedCdbId = String(cdbId).trim();

    const incomes = await Income.find({ cbNumber: normalizedCdbId })
      .populate("userId", "username")
      .sort({ createdAt: -1 })
      .lean();

    const transactions = incomes.map((inc) => {
      const billAmt = Number(inc.billAmount) || 0;
      const paidAmt = Number(inc.receivedAmount) || 0;

      // A record can contribute both a bill and a payment
      const rows = [];
      if (billAmt > 0) {
        rows.push({
          date: inc.createdAt,
          cdbId: inc.cbNumber,
          type: "BILL",
          amount: billAmt,
          paymentMode: "-",
          description: inc.description || "",
          user: inc.userId?.username || "N/A",
          paymentDate: null
        });
      }
      if (paidAmt > 0) {
        rows.push({
          date: inc.createdAt,
          cdbId: inc.cbNumber,
          type: "PAYMENT",
          amount: paidAmt,
          paymentMode: inc.paymentMode || "-",
          description: inc.description || "",
          user: inc.userId?.username || "N/A",
          paymentDate: inc.paymentDate || null
        });
      }
      return rows;
    }).flat();

    const totalBill = incomes.reduce((s, i) => s + (Number(i.billAmount) || 0), 0);
    const totalPayment = incomes.reduce((s, i) => s + (Number(i.receivedAmount) || 0), 0);
    const clientName = incomes[0]?.clientName || "Customer";

    return res.status(200).json({
      cdbId: normalizedCdbId,
      clientName,
      transactions,
      totalBill,
      totalPayment,
      due: Math.max(0, totalBill - totalPayment)
    });
  } catch (error) {
    console.error("LEDGER ERROR 👉", error);
    return res.status(500).json({ message: error.message });
  }
};

// ================= DUE SUMMARY =================
const getDueSummary = async (req, res) => {
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

    const customers = summary.map((s) => ({
      cdbId: s._id,
      clientName: s.clientName || "Unknown",
      totalBill: s.totalBill || 0,
      totalPaid: s.totalPaid || 0,
      totalDue: s.totalDue || 0
    }));

    const grandTotalBill = customers.reduce((sum, c) => sum + c.totalBill, 0);
    const grandTotalPaid = customers.reduce((sum, c) => sum + c.totalPaid, 0);
    const grandTotalDue = customers.reduce((sum, c) => sum + c.totalDue, 0);

    return res.status(200).json({
      customers,
      totals: {
        grandTotalBill,
        grandTotalPaid,
        grandTotalDue
      }
    });
  } catch (error) {
    console.error("DUE SUMMARY ERROR 👉", error);
    return res.status(500).json({ message: error.message });
  }
};

// ================= IMEI TRACKING =================
const getImeiTracking = async (req, res) => {
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

    const items = await Item.find(query)
      .sort({ date: -1 })
      .lean();

    return res.status(200).json({ items });
  } catch (error) {
    console.error("IMEI TRACKING ERROR 👉", error);
    return res.status(500).json({ message: error.message });
  }
};

// ================= SYNC ITEMS (one-time seed / restart) =================
const syncItems = async (req, res) => {
  try {
    // Get all distinct CDB IDs from Income records
    const cdbIds = await Income.distinct("cbNumber");
    let processed = 0;

    for (const cdbId of cdbIds) {
      if (!cdbId || !String(cdbId).trim()) continue;
      await recalculateItemsForCdbId(cdbId);
      processed++;
    }

    const totalItems = await Item.countDocuments();

    return res.status(200).json({
      message: "Item sync completed successfully",
      cdbIdsProcessed: processed,
      totalItems
    });
  } catch (error) {
    console.error("SYNC ERROR 👉", error);
    return res.status(500).json({ message: error.message });
  }
};

// ================= UPDATE CUSTOMER DUE =================
const updateCustomerDue = async (req, res) => {
  try {
    const { cdbId, dueAmount } = req.body;

    if (!cdbId || !String(cdbId).trim()) {
      return res.status(400).json({ message: "cdbId is required" });
    }

    if (dueAmount === undefined || dueAmount === null) {
      return res.status(400).json({ message: "dueAmount is required" });
    }

    const normalizedCdbId = String(cdbId).trim();
    const newDueAmount = Number(dueAmount);

    if (isNaN(newDueAmount) || newDueAmount < 0) {
      return res.status(400).json({ message: "dueAmount must be a valid non-negative number" });
    }

    // Find all income records for this customer, sorted by newest first
    const incomes = await Income.find({ cbNumber: normalizedCdbId }).sort({ createdAt: -1 });

    if (incomes.length === 0) {
      return res.status(404).json({ message: "No records found for this customer" });
    }

    // Update the most recent income record's received amount to adjust the due
    const mostRecentIncome = incomes[0];
    const currentBillAmount = Number(mostRecentIncome.billAmount) || 0;
    const currentPreviousDuesReceived = Number(mostRecentIncome.previousDuesReceived) || 0;

    // Calculate new received amount: Bill - Previous Dues Received - New Due Amount
    const newReceivedAmount = currentBillAmount - currentPreviousDuesReceived - newDueAmount;

    if (newReceivedAmount < 0) {
      return res.status(400).json({ message: "Due amount cannot exceed bill amount minus previous dues received" });
    }

    // Update the income record
    mostRecentIncome.receivedAmount = newReceivedAmount;
    await mostRecentIncome.save();

    // Recalculate item-level dues
    await recalculateItemsForCdbId(normalizedCdbId);

    return res.status(200).json({
      message: "Customer due updated successfully",
      cdbId: normalizedCdbId,
      newDueAmount,
      newReceivedAmount
    });
  } catch (error) {
    console.error("UPDATE DUE ERROR 👉", error);
    return res.status(500).json({ message: error.message });
  }
};

// ================= SEARCH BY VEHICLE / CHASSIS NUMBER =================
const searchByVehicleNumber = async (req, res) => {
  try {
    const { vehicleNumber } = req.query;

    if (!vehicleNumber || !String(vehicleNumber).trim()) {
      return res.status(400).json({ message: "vehicleNumber query parameter is required" });
    }

    const normalizedVehicleNumber = String(vehicleNumber).trim();

    // Find all income records with this vehicle number
    const incomes = await Income.find({
      vehicleChassisNo: { $regex: normalizedVehicleNumber, $options: "i" }
    })
      .populate("userId", "username")
      .sort({ createdAt: -1 })
      .lean();

    // Group by CDB ID and calculate dues
    const cdbMap = {};
    for (const income of incomes) {
      const cdbId = String(income.cbNumber || "").trim();
      if (!cdbId) continue;

      if (!cdbMap[cdbId]) {
        cdbMap[cdbId] = {
          cdbId,
          clientName: income.clientName || "Unknown",
          vehicleChassisNo: income.vehicleChassisNo || "",
          totalBill: 0,
          totalPaid: 0,
          totalDue: 0
        };
      }

      const billAmt = Number(income.billAmount) || 0;
      const paidAmt = Number(income.receivedAmount) || 0;

      cdbMap[cdbId].totalBill += billAmt;
      cdbMap[cdbId].totalPaid += paidAmt;
    }

    // Calculate dues
    const customers = Object.values(cdbMap).map(c => ({
      ...c,
      totalDue: Math.max(0, c.totalBill - c.totalPaid)
    }));

    const grandTotalBill = customers.reduce((sum, c) => sum + c.totalBill, 0);
    const grandTotalPaid = customers.reduce((sum, c) => sum + c.totalPaid, 0);
    const grandTotalDue = customers.reduce((sum, c) => sum + c.totalDue, 0);

    return res.status(200).json({
      searchTerm: normalizedVehicleNumber,
      customers,
      totals: {
        grandTotalBill,
        grandTotalPaid,
        grandTotalDue
      }
    });
  } catch (error) {
    console.error("SEARCH VEHICLE ERROR 👉", error);
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getCustomerLedger,
  getDueSummary,
  getImeiTracking,
  syncItems,
  updateCustomerDue,
  searchByVehicleNumber
};
