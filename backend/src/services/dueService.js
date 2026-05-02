const Income = require("../models/Income");
const Item = require("../models/Item");

/**
 * Recalculate all Items for a given CDB_ID.
 * - Aggregates all Income records for the CDB_ID
 * - Creates/updates Item records from each bill
 * - Distributes total payments across items (oldest first)
 * - Updates item status (UNPAID / PARTIAL / PAID)
 */
const recalculateItemsForCdbId = async (cdbId) => {
  if (!cdbId || !String(cdbId).trim()) return;

  const normalizedCdbId = String(cdbId).trim();

  // 1. Remove existing items for this CDB_ID
  await Item.deleteMany({ cdbId: normalizedCdbId });

  // 2. Fetch all Income records for this CDB_ID, sorted oldest first
  const incomes = await Income.find({ cbNumber: normalizedCdbId })
    .sort({ transaction_date: 1, createdAt: 1 })
    .lean();

  if (incomes.length === 0) return;

  // 3. Total payment pool across all records for this customer
  let remainingPayment = incomes.reduce(
    (sum, inc) => sum + (Number(inc.receivedAmount) || 0) + (Number(inc.previousDuesReceived) || 0),
    0
  );

  // 4. Build Item records, distributing payments oldest-first
  const itemsToCreate = [];
  for (const income of incomes) {
    const billAmount = Number(income.billAmount) || 0;
    if (billAmount <= 0) continue; // skip pure payment entries

    const paidForItem = Math.min(remainingPayment, billAmount);
    remainingPayment -= paidForItem;

    const dueAmount = billAmount - paidForItem;
    let status = "UNPAID";
    if (dueAmount <= 0.001) {
      status = "PAID";
    } else if (paidForItem > 0.001) {
      status = "PARTIAL";
    }

    // Pick IMEI / Serial from available fields
    const imeiSerial =
      String(income.imeiNo || "").trim() ||
      String(income.imeiLastSix || "").trim() ||
      String(income.cctvSerialNo || "").trim() ||
      "";

    itemsToCreate.push({
      cdbId: normalizedCdbId,
      clientName: String(income.clientName || "").trim(),
      itemName: String(income.serviceType || income.description || income.item || "").trim(),
      imeiSerial,
      price: billAmount,
      paidAmount: paidForItem,
      dueAmount: Math.max(0, dueAmount),
      status,
      incomeId: income._id,
      date: income.transaction_date || income.createdAt || new Date()
    });
  }

  if (itemsToCreate.length > 0) {
    await Item.insertMany(itemsToCreate);
  }
};

/**
 * Recalculate Items for a single Income record and its CDB_ID.
 */
const recalculateFromIncome = async (income) => {
  if (!income || !income.cbNumber) return;
  await recalculateItemsForCdbId(income.cbNumber);
};

/**
 * Recalculate Items for an old CDB_ID (on CDB change) and the new one.
 */
const recalculateOnCdbChange = async (oldCdbId, newCdbId) => {
  if (oldCdbId && String(oldCdbId).trim()) {
    await recalculateItemsForCdbId(oldCdbId);
  }
  if (newCdbId && String(newCdbId).trim() && String(newCdbId).trim() !== String(oldCdbId || "").trim()) {
    await recalculateItemsForCdbId(newCdbId);
  }
};

module.exports = {
  recalculateItemsForCdbId,
  recalculateFromIncome,
  recalculateOnCdbChange
};
