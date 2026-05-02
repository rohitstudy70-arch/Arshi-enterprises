const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema(
  {
    cdbId: {
      type: String,
      required: true,
      index: true,
      trim: true
    },
    clientName: {
      type: String,
      trim: true,
      default: ""
    },
    itemName: {
      type: String,
      trim: true,
      default: ""
    },
    imeiSerial: {
      type: String,
      trim: true,
      default: ""
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    dueAmount: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ["UNPAID", "PARTIAL", "PAID"],
      default: "UNPAID"
    },
    incomeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Income",
      required: true,
      index: true
    },
    date: {
      type: Date,
      required: true
    }
  },
  {
    timestamps: true
  }
);

itemSchema.index({ cdbId: 1, date: 1 });
itemSchema.index({ imeiSerial: "text", itemName: "text", cdbId: "text" });

module.exports = mongoose.model("Item", itemSchema);
