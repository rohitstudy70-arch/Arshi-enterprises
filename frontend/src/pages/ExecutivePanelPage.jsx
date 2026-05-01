import { useEffect, useState } from "react";
import api from "../api";
import DataTable from "../components/DataTable";
import { formatCurrency, formatDate } from "../utils/formatters";
import { calculateDues } from "../utils/incomeCalculations";

const initialIncomeForm = {
  clientName: "",
  mobile1: "",
  mobile2: "",
  clientUserId: "",
  address: "",
  district: "",
  vehicleChassisNo: "",
  description: "",
  model: "",
  imeiNo: "",
  imeiLastSix: "",
  vtsNo: "",
  technician: "",
  reference: "",
  quantity: 1,
  billAmount: "",
  receivedAmount: "",
  paymentMode: "cash",
  upiReferenceId: "",
  bankPersonName: "",
  cashReceivedBy: "",
  cashAmount: "",
  upiAmount: "",
  cctvDetails: "",
  cctvSerialNo: ""
};

const initialExpenseForm = {
  petrolAmount: "",
  foodAmount: "",
  materialAmount: "",
  miscAmount: "",
  notes: ""
};

const expenseCategoryFields = [
  { key: "petrolAmount", category: "petrol", label: "Petrol & Other Conveyance" },
  { key: "foodAmount", category: "food", label: "Food" },
  { key: "materialAmount", category: "material", label: "Material Purchase" },
  { key: "miscAmount", category: "misc", label: "Miscellaneous (Hotel & Other)" }
];

const expenseCategoryLabels = {
  petrol: "Petrol & Other Conveyance",
  food: "Food",
  material: "Material Purchase",
  misc: "Miscellaneous (Hotel & Other)",
  courier: "Courier"
};

const feedbackStyles = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  error: "border-red-200 bg-red-50 text-red-700"
};

const ExecutivePanelPage = () => {
  const [incomeForm, setIncomeForm] = useState(initialIncomeForm);
  const [expenseForm, setExpenseForm] = useState(initialExpenseForm);
  const [incomes, setIncomes] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submittingIncome, setSubmittingIncome] = useState(false);
  const [submittingExpense, setSubmittingExpense] = useState(false);
  const [incomeFeedback, setIncomeFeedback] = useState(null);
  const [expenseFeedback, setExpenseFeedback] = useState(null);
  const [editing, setEditing] = useState(null); // { type: "income"|"expense", data }
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");
  const incomeDues = calculateDues(incomeForm.billAmount, incomeForm.receivedAmount);

  const loadRecords = async () => {
    const [{ data: incomeData }, { data: expenseData }] = await Promise.all([
      api.get("/incomes"),
      api.get("/expenses")
    ]);
    setIncomes(incomeData.incomes);
    setExpenses(expenseData.expenses);
  };

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        await loadRecords();
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  const handleIncomeChange = (event) => {
    const { name, value } = event.target;
    setIncomeFeedback(null);

    setIncomeForm((current) => {
      if (name === "paymentMode") {
        const isUpiOrSplit = value === "upi" || value === "split";
        const isCashOrSplit = value === "cash" || value === "split";
        return {
          ...current,
          paymentMode: value,
          upiReferenceId: isUpiOrSplit ? current.upiReferenceId : "",
          bankPersonName: isUpiOrSplit ? current.bankPersonName : "",
          cashReceivedBy: isCashOrSplit ? current.cashReceivedBy : "",
          cashAmount: value === "split" ? current.cashAmount : "",
          upiAmount: value === "split" ? current.upiAmount : ""
        };
      }

      return {
        ...current,
        [name]: value
      };
    });
  };

  const handleExpenseChange = (event) => {
    const { name, value } = event.target;
    setExpenseFeedback(null);
    setExpenseForm((current) => ({
      ...current,
      [name]: value
    }));
  };

  const validateIncome = (form) => {
    const isCctvMaterial = form.description === "CCTV Material";

    const requiredFields = [
      { key: "clientName", label: "Client Name / ID" },
      { key: "mobile1", label: "Mobile No 1" },
      { key: "description", label: "Description / Item" },
      // Vehicle-specific fields skipped for CCTV Material
      ...(isCctvMaterial
        ? []
        : [
          { key: "model", label: "Model" },
          { key: "imeiLastSix", label: "IMEI Last 6 Digits" }
        ]),
      { key: "reference", label: "Reference" },
      { key: "quantity", label: "Quantity" },
      { key: "billAmount", label: "Bill Amount" },
      { key: "receivedAmount", label: "Received Amount" },
      { key: "paymentMode", label: "Payment Mode" }
    ];

    const missing = requiredFields
      .filter((f) => String(form[f.key] ?? "").trim() === "")
      .map((f) => f.label);

    if ((form.paymentMode === "upi" || form.paymentMode === "split") && !String(form.upiReferenceId || "").trim()) {
      missing.push("UPI Reference ID");
    }

    if ((form.paymentMode === "upi" || form.paymentMode === "split") && !String(form.bankPersonName || "").trim()) {
      missing.push("Bank Person");
    }

    if ((form.paymentMode === "cash" || form.paymentMode === "split") && !String(form.cashReceivedBy || "").trim()) {
      missing.push("Cash Received By");
    }

    if (isCctvMaterial && !String(form.cctvDetails || "").trim()) {
      missing.push("CCTV Details / Model");
    }
    if (isCctvMaterial && !String(form.cctvSerialNo || "").trim()) {
      missing.push("Serial No");
    }

    if (form.paymentMode === "split") {
      const cashAmt = Number(form.cashAmount || 0);
      const upiAmt = Number(form.upiAmount || 0);
      const recv = Number(form.receivedAmount || 0);
      if (!(cashAmt > 0)) missing.push("Cash Amount");
      if (!(upiAmt > 0)) missing.push("UPI Amount");
      if (cashAmt > 0 && upiAmt > 0 && Math.abs((cashAmt + upiAmt) - recv) > 0.009) {
        return `Cash (${cashAmt}) + UPI (${upiAmt}) must equal Received Amount (${recv}).`;
      }
    }

    if (String(form.imeiLastSix || "").trim() && !/^[0-9]{6}$/.test(form.imeiLastSix)) {
      return "IMEI Last 6 Digits must be exactly 6 digits.";
    }

    if (missing.length > 0) {
      return `Please fill required fields: ${missing.join(", ")}`;
    }
    return null;
  };

  const handleCombinedSubmit = async (event) => {
    event.preventDefault();
    setIncomeFeedback(null);
    setExpenseFeedback(null);

    const validationError = validateIncome(incomeForm);
    if (validationError) {
      setIncomeFeedback({ type: "error", message: validationError });
      return;
    }

    const expenseEntries = expenseCategoryFields
      .map((f) => ({
        category: f.category,
        label: f.label,
        amount: Number(expenseForm[f.key])
      }))
      .filter((e) => !isNaN(e.amount) && e.amount > 0);

    const hasExpense = expenseEntries.length > 0;

    setSubmittingIncome(true);
    if (hasExpense) setSubmittingExpense(true);

    let incomeOk = false;
    let expenseOk = !hasExpense; // if no expense, treat as success-skipped

    try {
      await api.post("/incomes", {
        ...incomeForm,
        item: incomeForm.description,
        quantity: Number(incomeForm.quantity),
        billAmount: Number(incomeForm.billAmount),
        receivedAmount: Number(incomeForm.receivedAmount),
        upiReferenceId:
          incomeForm.paymentMode === "upi" || incomeForm.paymentMode === "split"
            ? incomeForm.upiReferenceId
            : "",
        cashAmount: incomeForm.paymentMode === "split" ? Number(incomeForm.cashAmount || 0) : 0,
        upiAmount: incomeForm.paymentMode === "split" ? Number(incomeForm.upiAmount || 0) : 0
      });
      incomeOk = true;
      setIncomeForm(initialIncomeForm);
      setIncomeFeedback({ type: "success", message: "Income saved successfully." });
    } catch (error) {
      console.error("[INCOME POST ERROR]", error.response?.status, error.response?.data);
      setIncomeFeedback({
        type: "error",
        message: error.response?.data?.message || "Unable to save income."
      });
    } finally {
      setSubmittingIncome(false);
    }

    if (hasExpense) {
      const failed = [];
      let savedCount = 0;
      for (const entry of expenseEntries) {
        try {
          await api.post("/expenses", {
            category: entry.category,
            amount: entry.amount,
            notes: expenseForm.notes
          });
          savedCount += 1;
        } catch (error) {
          failed.push(`${entry.label} (${error.response?.data?.message || "failed"})`);
        }
      }
      if (failed.length === 0) {
        expenseOk = true;
        setExpenseForm(initialExpenseForm);
        setExpenseFeedback({
          type: "success",
          message: `${savedCount} expense ${savedCount === 1 ? "entry" : "entries"} saved.`
        });
      } else {
        setExpenseFeedback({
          type: "error",
          message: `Failed to save: ${failed.join(", ")}`
        });
      }
      setSubmittingExpense(false);
    }

    if (incomeOk || expenseOk) {
      await loadRecords();
    }
  };

  const handleExpenseSubmit = async (event) => {
    event.preventDefault();
    setSubmittingExpense(true);
    setExpenseFeedback(null);

    try {
      await api.post("/expenses", {
        ...expenseForm,
        amount: Number(expenseForm.amount)
      });

      setExpenseForm(initialExpenseForm);
      setExpenseFeedback({
        type: "success",
        message: "Expense saved successfully."
      });
      await loadRecords();
    } catch (error) {
      setExpenseFeedback({
        type: "error",
        message: error.response?.data?.message || "Unable to save expense."
      });
    } finally {
      setSubmittingExpense(false);
    }
  };

  const openEdit = (type, row) => {
    setEditError("");
    setEditing({ type, data: { ...row } });
  };

  const closeEdit = () => {
    setEditing(null);
    setEditError("");
  };

  const handleEditChange = (event) => {
    const { name, value } = event.target;
    setEditing((current) => ({
      ...current,
      data: {
        ...current.data,
        [name]: value,
        ...(name === "paymentMode" && value !== "upi" ? { upiReferenceId: "" } : {})
      }
    }));
  };

  const handleEditSubmit = async (event) => {
    event.preventDefault();
    setEditError("");

    if (editing.type === "income") {
      const validationError = validateIncome(editing.data);
      if (validationError) {
        setEditError(validationError);
        return;
      }
    } else if (editing.type === "expense") {
      if (!String(editing.data.category || "").trim() || String(editing.data.amount ?? "").trim() === "") {
        setEditError("Please fill required fields: Category, Amount");
        return;
      }
    }

    setSavingEdit(true);
    try {
      const { type, data } = editing;
      if (type === "income") {
        await api.put(`/incomes/${data._id}`, {
          clientName: data.clientName,
          mobile1: data.mobile1,
          mobile2: data.mobile2,
          clientUserId: data.clientUserId,
          address: data.address,
          district: data.district,
          vehicleChassisNo: data.vehicleChassisNo,
          description: data.description,
          item: data.description,
          model: data.model,
          imeiLastSix: data.imeiLastSix,
          vtsNo: data.vtsNo,
          technician: data.technician,
          reference: data.reference,
          quantity: Number(data.quantity),
          billAmount: Number(data.billAmount),
          receivedAmount: Number(data.receivedAmount),
          paymentMode: data.paymentMode,
          upiReferenceId: (data.paymentMode === "upi" || data.paymentMode === "split") ? data.upiReferenceId : "",
          bankPersonName: data.bankPersonName || "",
          cashReceivedBy: data.cashReceivedBy || "",
          cashAmount: data.paymentMode === "split" ? Number(data.cashAmount || 0) : 0,
          upiAmount: data.paymentMode === "split" ? Number(data.upiAmount || 0) : 0,
          cctvDetails: data.description === "CCTV Material" ? (data.cctvDetails || "") : "",
          cctvSerialNo: data.description === "CCTV Material" ? (data.cctvSerialNo || "") : ""
        });
      } else {
        await api.put(`/expenses/${data._id}`, {
          category: data.category,
          amount: Number(data.amount),
          notes: data.notes
        });
      }
      await loadRecords();
      closeEdit();
    } catch (error) {
      setEditError(error.response?.data?.message || "Unable to save changes.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (type, id) => {
    const confirmed = window.confirm(`Delete this ${type} record? This cannot be undone.`);
    if (!confirmed) return;
    try {
      await api.delete(`/${type === "income" ? "incomes" : "expenses"}/${id}`);
      await loadRecords();
    } catch (error) {
      window.alert(error.response?.data?.message || "Unable to delete record.");
    }
  };

  const actionsCell = (type) => (row) => (
    <div className="flex gap-2">
      <button type="button" className="button-secondary px-3 py-2 text-xs" onClick={() => openEdit(type, row)}>
        Edit
      </button>
      <button type="button" className="button-danger px-3 py-2 text-xs" onClick={() => handleDelete(type, row._id)}>
        Delete
      </button>
    </div>
  );

  const incomeColumns = [
    { key: "cbNumber", header: "CDB No" },
    { key: "clientName", header: "Client Name" },
    { key: "mobile1", header: "Mobile 1" },
    { key: "vehicleChassisNo", header: "Vehicle / Chassis" },
    { key: "description", header: "Description / Item" },
    { key: "cctvDetails", header: "CCTV Details / Model" },
    { key: "cctvSerialNo", header: "Serial No" },
    { key: "model", header: "Model" },
    { key: "imeiLastSix", header: "IMEI Last 6" },
    { key: "technician", header: "Technician" },
    { key: "reference", header: "Reference (Given By)" },
    { key: "billAmount", header: "Bill Amount", render: (row) => formatCurrency(row.billAmount) },
    { key: "receivedAmount", header: "Received Amount", render: (row) => formatCurrency(row.receivedAmount) },
    { key: "dues", header: "Dues", render: (row) => formatCurrency(row.dues) },
    {
      key: "paymentMode",
      header: "Payment Mode",
      render: (row) => {
        if (row.paymentMode === "upi") return "UPI";
        if (row.paymentMode === "split") {
          return `Split (Cash ${formatCurrency(row.cashAmount)} + UPI ${formatCurrency(row.upiAmount)})`;
        }
        return "Cash";
      }
    },
    { key: "upiReferenceId", header: "UPI Reference" },
    { key: "bankPersonName", header: "Bank Person" },
    { key: "cashReceivedBy", header: "Cash Received By" },
    { key: "actions", header: "Actions", render: actionsCell("income") }
  ];

  const expenseColumns = [
    { key: "category", header: "Category", render: (row) => expenseCategoryLabels[row.category] || row.category },
    { key: "amount", header: "Amount", render: (row) => formatCurrency(row.amount) },
    { key: "notes", header: "Notes" },
    { key: "actions", header: "Actions", render: actionsCell("expense") }
  ];

  if (loading) {
    return <div className="panel p-8 text-sm font-semibold text-muted">Loading Arshi Enterprises executive panel...</div>;
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleCombinedSubmit} className="space-y-6">
        <section className="grid gap-6 xl:grid-cols-2">
          <div className="panel p-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">Income Entry</p>
              <h3 className="mt-2 text-2xl font-bold text-ink">Add income record</h3>
            </div>

            {incomeFeedback ? (
              <div className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${feedbackStyles[incomeFeedback.type]}`}>
                {incomeFeedback.message}
              </div>
            ) : null}

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <label className="label">Client Name / ID *</label>
                <input className="field" name="clientName" value={incomeForm.clientName} onChange={handleIncomeChange} required />
              </div>
              <div>
                <label className="label">Mobile No 1 *</label>
                <input className="field" name="mobile1" value={incomeForm.mobile1} onChange={handleIncomeChange} required />
              </div>
              <div>
                <label className="label">Mobile No 2</label>
                <input className="field" name="mobile2" value={incomeForm.mobile2} onChange={handleIncomeChange} />
              </div>
              <div>
                <label className="label">User ID</label>
                <input className="field" name="clientUserId" value={incomeForm.clientUserId} onChange={handleIncomeChange} />
              </div>
              <div className="md:col-span-2">
                <label className="label">Address</label>
                <input className="field" name="address" value={incomeForm.address} onChange={handleIncomeChange} />
              </div>
              <div>
                <label className="label">District</label>
                <input className="field" name="district" value={incomeForm.district} onChange={handleIncomeChange} />
              </div>
              {incomeForm.description !== "CCTV Material" ? (
                <div>
                  <label className="label">Vehicle / Chassis No</label>
                  <input className="field" name="vehicleChassisNo" value={incomeForm.vehicleChassisNo} onChange={handleIncomeChange} />
                </div>
              ) : null}
              <div className="md:col-span-2">
                <label className="label">Description / Item *</label>
                <select className="field" name="description" value={incomeForm.description} onChange={handleIncomeChange} required>
                  <option value="">Select...</option>
                  <option value="GPS Installation">GPS Installation</option>
                  <option value="VLTD Installation">VLTD Installation</option>
                  <option value="GPS Renewal">GPS Renewal</option>
                  <option value="VLTD Renewal">VLTD Renewal</option>
                  <option value="CCTV Installation">CCTV Installation</option>
                  <option value="CCTV Material">CCTV Material</option>
                  <option value="Renewal with Service">Renewal with Service</option>
                  <option value="Replacement and Service">Replacement and Service</option>
                </select>
              </div>
              {incomeForm.description === "CCTV Material" ? (
                <>
                  <div>
                    <label className="label">CCTV Details / Model *</label>
                    <input
                      className="field"
                      name="cctvDetails"
                      value={incomeForm.cctvDetails}
                      onChange={handleIncomeChange}
                      placeholder="CCTV model / details"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Serial No *</label>
                    <input
                      className="field"
                      name="cctvSerialNo"
                      value={incomeForm.cctvSerialNo}
                      onChange={handleIncomeChange}
                      placeholder="Serial number"
                      required
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="label">Model *</label>
                    <select className="field" name="model" value={incomeForm.model} onChange={handleIncomeChange} required>
                      <option value="">Select...</option>
                      <option value="A5">A5</option>
                      <option value="PRO 4G">PRO 4G</option>
                      <option value="AGPS">AGPS</option>
                      <option value="AGT365N">AGT365N</option>
                      <option value="ITR140">ITR140</option>
                      <option value="ACTUTE140">ACTUTE140</option>
                      <option value="MARK 140">MARK 140</option>
                      <option value="RDM 140">RDM 140</option>
                      <option value="ACCOLADE">ACCOLADE</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">IMEI Last 6 Digits *</label>
                    <input className="field" name="imeiLastSix" value={incomeForm.imeiLastSix} onChange={handleIncomeChange} required minLength={6} maxLength={6} pattern="[0-9]{6}" title="Enter exactly 6 digits" />
                  </div>
                  <div>
                    <label className="label">VTS Last 6 Digits</label>
                    <input className="field" name="vtsNo" value={incomeForm.vtsNo} onChange={handleIncomeChange} />
                  </div>
                </>
              )}
              <div>
                <label className="label">Technician</label>
                <input className="field" name="technician" value={incomeForm.technician} onChange={handleIncomeChange} />
              </div>
              <div>
                <label className="label">Reference *</label>
                <input className="field" name="reference" value={incomeForm.reference} onChange={handleIncomeChange} required />
              </div>
              <div>
                <label className="label">Quantity *</label>
                <input className="field" name="quantity" type="number" min="0" value={incomeForm.quantity} onChange={handleIncomeChange} required />
              </div>
              <div>
                <label className="label">Bill Amount *</label>
                <input className="field" name="billAmount" type="number" min="0" value={incomeForm.billAmount} onChange={handleIncomeChange} required />
              </div>
              <div>
                <label className="label">Received Amount *</label>
                <input className="field" name="receivedAmount" type="number" min="0" value={incomeForm.receivedAmount} onChange={handleIncomeChange} required />
              </div>
              <div>
                <label className="label">Dues</label>
                <input className="field bg-slate-50" value={formatCurrency(incomeDues)} readOnly />
                <p className="mt-2 text-xs text-muted">Auto-calculated from bill amount minus received amount.</p>
              </div>
              <div>
                <label className="label">Payment Mode *</label>
                <select className="field" name="paymentMode" value={incomeForm.paymentMode} onChange={handleIncomeChange} required>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="split">Split (Cash + UPI)</option>
                </select>
              </div>
              {incomeForm.paymentMode === "upi" ? (
                <>
                  <div>
                    <label className="label">UPI Reference ID *</label>
                    <input
                      className="field"
                      name="upiReferenceId"
                      value={incomeForm.upiReferenceId}
                      onChange={handleIncomeChange}
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Bank Person *</label>
                    <input
                      className="field"
                      name="bankPersonName"
                      value={incomeForm.bankPersonName}
                      onChange={handleIncomeChange}
                      placeholder="Bank person who received payment"
                      required
                    />
                  </div>
                </>
              ) : null}
              {incomeForm.paymentMode === "cash" ? (
                <div>
                  <label className="label">Cash Received By *</label>
                  <input
                    className="field"
                    name="cashReceivedBy"
                    value={incomeForm.cashReceivedBy}
                    onChange={handleIncomeChange}
                    placeholder="Name of person who received cash"
                    required
                  />
                </div>
              ) : null}
              {incomeForm.paymentMode === "split" ? (
                <>
                  <div>
                    <label className="label">Cash Amount *</label>
                    <input className="field" type="number" min="0" step="0.01" name="cashAmount" value={incomeForm.cashAmount} onChange={handleIncomeChange} required />
                  </div>
                  <div>
                    <label className="label">UPI Amount *</label>
                    <input className="field" type="number" min="0" step="0.01" name="upiAmount" value={incomeForm.upiAmount} onChange={handleIncomeChange} required />
                    <p className="mt-1 text-xs text-muted">Cash + UPI must equal Received Amount.</p>
                  </div>
                  <div>
                    <label className="label">UPI Reference ID *</label>
                    <input className="field" name="upiReferenceId" value={incomeForm.upiReferenceId} onChange={handleIncomeChange} required />
                  </div>
                  <div>
                    <label className="label">Bank Person *</label>
                    <input className="field" name="bankPersonName" value={incomeForm.bankPersonName} onChange={handleIncomeChange} placeholder="Bank person who received UPI payment" required />
                  </div>
                  <div>
                    <label className="label">Cash Received By *</label>
                    <input className="field" name="cashReceivedBy" value={incomeForm.cashReceivedBy} onChange={handleIncomeChange} placeholder="Name of person who received cash" required />
                  </div>
                </>
              ) : null}
            </div>

          </div>

          <div className="panel p-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">Expense Entry (Optional)</p>
              <h3 className="mt-2 text-2xl font-bold text-ink">Add expense</h3>
              <p className="mt-1 text-xs text-muted">Fill amount only if you want to log an expense alongside income.</p>
            </div>

            {expenseFeedback ? (
              <div className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${feedbackStyles[expenseFeedback.type]}`}>
                {expenseFeedback.message}
              </div>
            ) : null}

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {expenseCategoryFields.map((f) => (
                <div key={f.key}>
                  <label className="label">{f.label}</label>
                  <input
                    className="field"
                    name={f.key}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Amount (optional)"
                    value={expenseForm[f.key]}
                    onChange={handleExpenseChange}
                  />
                </div>
              ))}
              <div className="md:col-span-2">
                <label className="label">Notes</label>
                <textarea className="field min-h-36 resize-y" name="notes" value={expenseForm.notes} onChange={handleExpenseChange} />
                <p className="mt-2 text-xs text-muted">Same notes will be saved with each expense entry.</p>
              </div>
            </div>

          </div>
        </section>

        <div className="flex justify-end">
          <button type="submit" className="button-primary" disabled={submittingIncome || submittingExpense}>
            {submittingIncome || submittingExpense ? "Saving..." : "Save records"}
          </button>
        </div>
      </form>

      <section className="space-y-6">
        <div className="panel p-6">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">Arshi Enterprises - Records</p>
              <h3 className="mt-2 text-2xl font-bold text-ink">Income records</h3>
            </div>
            <p className="text-sm text-muted">{incomes.length} rows</p>
          </div>
          <DataTable columns={incomeColumns} rows={incomes} emptyMessage="No income entries yet." />
        </div>

        <div className="panel p-6">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">Arshi Enterprises - Records</p>
              <h3 className="mt-2 text-2xl font-bold text-ink">Expense records</h3>
            </div>
            <p className="text-sm text-muted">{expenses.length} rows</p>
          </div>
          <DataTable columns={expenseColumns} rows={expenses} emptyMessage="No expense entries yet." />
        </div>
      </section>

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeEdit}>
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-ink">
                Edit {editing.type === "income" ? "income" : "expense"} record
              </h3>
              <button type="button" className="text-2xl text-muted hover:text-ink" onClick={closeEdit}>
                ×
              </button>
            </div>

            {editError ? (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {editError}
              </div>
            ) : null}

            <form onSubmit={handleEditSubmit} className="space-y-4">
              {editing.type === "income" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="label">Client Name / ID *</label>
                    <input className="field" name="clientName" value={editing.data.clientName || ""} onChange={handleEditChange} required />
                  </div>
                  <div>
                    <label className="label">Mobile No 1 *</label>
                    <input className="field" name="mobile1" value={editing.data.mobile1 || ""} onChange={handleEditChange} required />
                  </div>
                  <div>
                    <label className="label">Mobile No 2</label>
                    <input className="field" name="mobile2" value={editing.data.mobile2 || ""} onChange={handleEditChange} />
                  </div>
                  <div>
                    <label className="label">User ID</label>
                    <input className="field" name="clientUserId" value={editing.data.clientUserId || ""} onChange={handleEditChange} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="label">Address</label>
                    <input className="field" name="address" value={editing.data.address || ""} onChange={handleEditChange} />
                  </div>
                  <div>
                    <label className="label">District</label>
                    <input className="field" name="district" value={editing.data.district || ""} onChange={handleEditChange} />
                  </div>
                  {editing.data.description !== "CCTV Material" ? (
                    <div>
                      <label className="label">Vehicle / Chassis No</label>
                      <input className="field" name="vehicleChassisNo" value={editing.data.vehicleChassisNo || ""} onChange={handleEditChange} />
                    </div>
                  ) : null}
                  <div className="md:col-span-2">
                    <label className="label">Description / Item *</label>
                    <select className="field" name="description" value={editing.data.description || ""} onChange={handleEditChange} required>
                      <option value="">Select...</option>
                      <option value="GPS Installation">GPS Installation</option>
                      <option value="VLTD Installation">VLTD Installation</option>
                      <option value="GPS Renewal">GPS Renewal</option>
                      <option value="VLTD Renewal">VLTD Renewal</option>
                      <option value="CCTV Installation">CCTV Installation</option>
                      <option value="CCTV Material">CCTV Material</option>
                      <option value="Renewal with Service">Renewal with Service</option>
                      <option value="Replacement and Service">Replacement and Service</option>
                    </select>
                  </div>
                  {editing.data.description === "CCTV Material" ? (
                    <>
                      <div>
                        <label className="label">CCTV Details / Model *</label>
                        <input
                          className="field"
                          name="cctvDetails"
                          value={editing.data.cctvDetails || ""}
                          onChange={handleEditChange}
                          placeholder="CCTV model / details"
                          required
                        />
                      </div>
                      <div>
                        <label className="label">Serial No *</label>
                        <input
                          className="field"
                          name="cctvSerialNo"
                          value={editing.data.cctvSerialNo || ""}
                          onChange={handleEditChange}
                          placeholder="Serial number"
                          required
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="label">Model *</label>
                        <select className="field" name="model" value={editing.data.model || ""} onChange={handleEditChange} required>
                          <option value="">Select...</option>
                          <option value="A5">A5</option>
                          <option value="PRO 4G">PRO 4G</option>
                          <option value="AGPS">AGPS</option>
                          <option value="AGT365N">AGT365N</option>
                          <option value="ITR140">ITR140</option>
                          <option value="ACTUTE140">ACTUTE140</option>
                          <option value="MARK 140">MARK 140</option>
                          <option value="RDM 140">RDM 140</option>
                          <option value="ACCOLADE">ACCOLADE</option>
                        </select>
                      </div>
                      <div>
                        <label className="label">IMEI Last 6 Digits *</label>
                        <input className="field" name="imeiLastSix" value={editing.data.imeiLastSix || ""} onChange={handleEditChange} required minLength={6} maxLength={6} pattern="[0-9]{6}" title="Enter exactly 6 digits" />
                      </div>
                      <div>
                        <label className="label">VTS Last 6 Digits</label>
                        <input className="field" name="vtsNo" value={editing.data.vtsNo || ""} onChange={handleEditChange} />
                      </div>
                    </>
                  )}
                  <div>
                    <label className="label">Technician</label>
                    <input className="field" name="technician" value={editing.data.technician || ""} onChange={handleEditChange} />
                  </div>
                  <div>
                    <label className="label">Reference *</label>
                    <input className="field" name="reference" value={editing.data.reference || ""} onChange={handleEditChange} required />
                  </div>
                  <div>
                    <label className="label">Quantity *</label>
                    <input className="field" name="quantity" type="number" min="0" value={editing.data.quantity ?? ""} onChange={handleEditChange} required />
                  </div>
                  <div>
                    <label className="label">Bill Amount *</label>
                    <input className="field" name="billAmount" type="number" min="0" value={editing.data.billAmount ?? ""} onChange={handleEditChange} required />
                  </div>
                  <div>
                    <label className="label">Received Amount *</label>
                    <input className="field" name="receivedAmount" type="number" min="0" value={editing.data.receivedAmount ?? ""} onChange={handleEditChange} required />
                  </div>
                  <div>
                    <label className="label">Payment Mode *</label>
                    <select className="field" name="paymentMode" value={editing.data.paymentMode || "cash"} onChange={handleEditChange} required>
                      <option value="cash">Cash</option>
                      <option value="upi">UPI</option>
                      <option value="split">Split (Cash + UPI)</option>
                    </select>
                  </div>
                  {editing.data.paymentMode === "upi" ? (
                    <>
                      <div>
                        <label className="label">UPI Reference ID *</label>
                        <input className="field" name="upiReferenceId" value={editing.data.upiReferenceId || ""} onChange={handleEditChange} required />
                      </div>
                      <div>
                        <label className="label">Bank Person *</label>
                        <input className="field" name="bankPersonName" value={editing.data.bankPersonName || ""} onChange={handleEditChange} placeholder="Bank person who received payment" required />
                      </div>
                    </>
                  ) : null}
                  {editing.data.paymentMode === "cash" ? (
                    <div>
                      <label className="label">Cash Received By *</label>
                      <input className="field" name="cashReceivedBy" value={editing.data.cashReceivedBy || ""} onChange={handleEditChange} placeholder="Name of person who received cash" required />
                    </div>
                  ) : null}
                  {editing.data.paymentMode === "split" ? (
                    <>
                      <div>
                        <label className="label">Cash Amount *</label>
                        <input className="field" type="number" min="0" step="0.01" name="cashAmount" value={editing.data.cashAmount ?? ""} onChange={handleEditChange} required />
                      </div>
                      <div>
                        <label className="label">UPI Amount *</label>
                        <input className="field" type="number" min="0" step="0.01" name="upiAmount" value={editing.data.upiAmount ?? ""} onChange={handleEditChange} required />
                      </div>
                      <div>
                        <label className="label">UPI Reference ID *</label>
                        <input className="field" name="upiReferenceId" value={editing.data.upiReferenceId || ""} onChange={handleEditChange} required />
                      </div>
                      <div>
                        <label className="label">Bank Person *</label>
                        <input className="field" name="bankPersonName" value={editing.data.bankPersonName || ""} onChange={handleEditChange} required />
                      </div>
                      <div>
                        <label className="label">Cash Received By *</label>
                        <input className="field" name="cashReceivedBy" value={editing.data.cashReceivedBy || ""} onChange={handleEditChange} required />
                      </div>
                    </>
                  ) : null}
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="label">Category</label>
                    <select className="field" name="category" value={editing.data.category || "petrol"} onChange={handleEditChange}>
                      <option value="petrol">Petrol &amp; Other Conveyance</option>
                      <option value="food">Food</option>
                      <option value="material">Material Purchase</option>
                      <option value="misc">Miscellaneous (Hotel &amp; Other)</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Amount</label>
                    <input className="field" name="amount" type="number" min="0" value={editing.data.amount ?? ""} onChange={handleEditChange} required />
                  </div>
                  <div className="md:col-span-2">
                    <label className="label">Notes</label>
                    <textarea className="field min-h-32 resize-y" name="notes" value={editing.data.notes || ""} onChange={handleEditChange} />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="button-secondary" onClick={closeEdit} disabled={savingEdit}>
                  Cancel
                </button>
                <button type="submit" className="button-primary" disabled={savingEdit}>
                  {savingEdit ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ExecutivePanelPage;
