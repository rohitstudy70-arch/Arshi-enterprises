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
      required: true,
      trim: true
    },
    reference: {
      type: String,
      required: true,
      trim: true
    },
    mobile1: {
      type: String,
      required: true,
      trim: true
    },
    mobile2: {
      type: String,
      trim: true,
      default: ""
    },
    address: {
      type: String,
      trim: true,
      default: ""
    },
    district: {
      type: String,
      trim: true,
      default: ""
    },
    vehicleChassisNo: {
      type: String,
      trim: true,
      default: ""
    },
    clientUserId: {
      type: String,
      trim: true,
      default: ""
    },
    item: {
      type: String,
      trim: true,
      default: ""
    },
    model: {
      type: String,
      required: function () {
        return String(this.description || "").trim() !== "CCTV Material";
      },
      trim: true,
      default: ""
    },
    imeiNo: {
      type: String,
      trim: true,
      default: ""
    },
    imeiLastSix: {
      type: String,
      required: function () {
        return String(this.description || "").trim() !== "CCTV Material";
      },
      trim: true,
      default: ""
    },
    vtsNo: {
      type: String,
      trim: true,
      default: ""
    },
    technician: {
      type: String,
      trim: true,
      default: ""
    },
    cctvDetails: {
      type: String,
      trim: true,
      default: ""
    },
    cctvSerialNo: {
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
      enum: ["cash", "upi", "bank", "split"],
      required: true
    },
    upiReferenceId: {
      type: String,
      trim: true,
      default: ""
    },
    bankPersonName: {
      type: String,
      trim: true,
      default: ""
    },
    cashReceivedBy: {
      type: String,
      trim: true,
      default: ""
    },
    cashAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    upiAmount: {
      type: Number,
      default: 0,
      min: 0
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

  if (String(this.description || "").trim() === "CCTV Material") {
    if (!String(this.cctvDetails || "").trim()) {
      this.invalidate("cctvDetails", "CCTV Details / Model is required for CCTV Material");
    }
    if (!String(this.cctvSerialNo || "").trim()) {
      this.invalidate("cctvSerialNo", "Serial No is required for CCTV Material");
    }
    // Clear vehicle-specific fields that do not apply to CCTV Material
    this.vehicleChassisNo = "";
    this.model = "";
    this.imeiLastSix = "";
    this.imeiNo = "";
    this.vtsNo = "";
  } else {
    // Keep CCTV-specific fields blank for non-CCTV entries
    this.cctvDetails = "";
    this.cctvSerialNo = "";
  }

  if (this.paymentMode === "upi") {
    if (!String(this.upiReferenceId || "").trim()) {
      this.invalidate("upiReferenceId", "UPI reference ID is required for UPI payments");
    }
    if (!String(this.bankPersonName || "").trim()) {
      this.invalidate("bankPersonName", "Bank person name is required for UPI payments");
    }
    this.cashReceivedBy = "";
    this.cashAmount = 0;
    this.upiAmount = receivedAmount;
  } else if (this.paymentMode === "cash") {
    if (!String(this.cashReceivedBy || "").trim()) {
      this.invalidate("cashReceivedBy", "Cash receiver name is required for cash payments");
    }
    this.upiReferenceId = "";
    this.bankPersonName = "";
    this.cashAmount = receivedAmount;
    this.upiAmount = 0;
  } else if (this.paymentMode === "split") {
    const cashAmount = Number(this.cashAmount || 0);
    const upiAmount = Number(this.upiAmount || 0);

    if (cashAmount <= 0) {
      this.invalidate("cashAmount", "Cash amount must be greater than 0 for split payments");
    }
    if (upiAmount <= 0) {
      this.invalidate("upiAmount", "UPI amount must be greater than 0 for split payments");
    }
    if (Math.abs((cashAmount + upiAmount) - receivedAmount) > 0.009) {
      this.invalidate("cashAmount", "Cash + UPI must equal Received Amount");
    }
    if (!String(this.upiReferenceId || "").trim()) {
      this.invalidate("upiReferenceId", "UPI reference ID is required for split payments");
    }
    if (!String(this.bankPersonName || "").trim()) {
      this.invalidate("bankPersonName", "Bank person name is required for split payments");
    }
    if (!String(this.cashReceivedBy || "").trim()) {
      this.invalidate("cashReceivedBy", "Cash receiver name is required for split payments");
    }
  } else {
    this.upiReferenceId = "";
    this.bankPersonName = "";
    this.cashReceivedBy = "";
    this.cashAmount = 0;
    this.upiAmount = 0;
  }

  next();
});

module.exports = mongoose.model("Income", incomeSchema);
