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
    transaction_date: {
      type: Date,
      required: true,
      default: Date.now
    },
    paymentDate: {
      type: Date,
      default: null
    },
    serviceType: {
      type: String,
      trim: true,
      default: ""
    },
    description: {
      type: String,
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
        return String(this.serviceType || this.description || "").trim() !== "CCTV Installation";
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
        return String(this.serviceType || this.description || "").trim() !== "CCTV Installation";
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
    previousDuesReceived: {
      type: Number,
      default: 0,
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
    },
    remarks: {
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
  const serviceType = String(this.serviceType || this.description || "").trim();
  const now = new Date();
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  const minDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  minDate.setHours(0, 0, 0, 0);

  this.dues = billAmount - receivedAmount;
  if (!serviceType) {
    this.invalidate("serviceType", "Service Type is required");
  } else if (!this.serviceType) {
    this.serviceType = serviceType;
  }

  if (!this.transaction_date) {
    this.transaction_date = new Date();
  }

  const transactionDate = new Date(this.transaction_date);
  if (Number.isNaN(transactionDate.getTime())) {
    this.invalidate("transaction_date", "Transaction date is invalid");
  } else if (transactionDate > todayEnd) {
    this.invalidate("transaction_date", "Transaction date cannot be in the future");
  } else if (transactionDate < minDate && this.isNew) {
    this.invalidate("transaction_date", "Transaction date can only be backdated to the previous month");
  }

  if (serviceType === "CCTV Installation") {
    if (!String(this.cctvDetails || "").trim()) {
      this.invalidate("cctvDetails", "CCTV Details / Model is required for CCTV Installation");
    }
    this.model = "";
    this.imeiLastSix = "";
    this.imeiNo = "";
    this.vtsNo = "";
  } else {
    this.cctvDetails = "";
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
  } else if (this.paymentMode === "bank") {
    if (!String(this.upiReferenceId || "").trim()) {
      this.invalidate("upiReferenceId", "Reference number is required for Bank payments");
    }
    if (!String(this.bankPersonName || "").trim()) {
      this.invalidate("bankPersonName", "Bank person name is required for Bank payments");
    }
    this.cashReceivedBy = "";
    this.cashAmount = 0;
    this.upiAmount = receivedAmount;
  } else if (this.paymentMode === "split") {
    const cashAmount = Number(this.cashAmount || 0);
    const upiAmount = Number(this.upiAmount || 0);

    if (cashAmount <= 0 && upiAmount <= 0) {
      this.invalidate("cashAmount", "At least one of Cash or UPI amount must be greater than 0 for split payments");
    }
    // Removed strict validation: cashAmount + upiAmount = receivedAmount
    // Now just ensure they don't exceed receivedAmount
    if (cashAmount + upiAmount > receivedAmount + 0.009) {
      this.invalidate("cashAmount", "Cash + UPI cannot exceed Received Amount");
    }
    if (upiAmount > 0 && !String(this.upiReferenceId || "").trim()) {
      this.invalidate("upiReferenceId", "UPI reference ID is required when UPI amount > 0");
    }
    if (upiAmount > 0 && !String(this.bankPersonName || "").trim()) {
      this.invalidate("bankPersonName", "Bank person name is required when UPI amount > 0");
    }
    if (cashAmount > 0 && !String(this.cashReceivedBy || "").trim()) {
      this.invalidate("cashReceivedBy", "Cash receiver name is required when Cash amount > 0");
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
