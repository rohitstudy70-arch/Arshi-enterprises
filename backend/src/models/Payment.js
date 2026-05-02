const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    cdbId: {
      type: String,
      required: true,
      trim: true
    },
    customerName: {
      type: String,
      required: true,
      trim: true
    },
    paymentDate: {
      type: Date,
      required: true,
      default: Date.now
    },
    paymentAmount: {
      type: Number,
      required: true,
      min: 0
    },
    paymentMode: {
      type: String,
      required: true,
      enum: ["cash", "upi", "bank"]
    },
    referenceNumber: {
      type: String,
      trim: true,
      default: ""
    },
    imeiNumber: {
      type: String,
      trim: true,
      default: ""
    },
    vehicleNumber: {
      type: String,
      trim: true,
      default: ""
    },
    chassisNumber: {
      type: String,
      trim: true,
      default: ""
    },
    previousDue: {
      type: Number,
      required: true,
      min: 0
    },
    newDue: {
      type: Number,
      required: true,
      min: 0
    },
    status: {
      type: String,
      required: true,
      enum: ["PAID", "PARTIAL", "NO_UPDATE"],
      default: "PARTIAL"
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

module.exports = mongoose.model("Payment", paymentSchema);
