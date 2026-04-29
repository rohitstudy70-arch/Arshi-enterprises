const mongoose = require("mongoose");

const incomeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    clientName: {
      type: String,
      required: true,
      trim: true
    },
    cbNumber: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true,
      default: ""
    },
    reference: {
      type: String,
      trim: true,
      default: ""
    },
    quantity: {
      type: Number,
      required: true,
      min: 0
    },
    billAmount: {
      type: Number,
      required: true,
      min: 0
    },
    receivedAmount: {
      type: Number,
      required: true,
      min: 0
    },
    dues: {
      type: Number,
      required: true
    },
    paymentMode: {
      type: String,
      enum: ["cash", "upi", "bank"],
      required: true
    },
    upiReferenceId: {
      type: String,
      trim: true,
      default: ""
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

incomeSchema.pre("validate", function setDerivedFields(next) {
  const billAmount = Number(this.billAmount || 0);
  const receivedAmount = Number(this.receivedAmount || 0);

  this.dues = billAmount - receivedAmount;

  if (this.paymentMode === "upi") {
    if (!String(this.upiReferenceId || "").trim()) {
      this.invalidate("upiReferenceId", "UPI reference ID is required for UPI payments");
    }
  } else {
    this.upiReferenceId = "";
  }

  next();
});

module.exports = mongoose.model("Income", incomeSchema);
