import { useEffect, useState } from "react";
import api from "../api";
import DataTable from "../components/DataTable";
import { formatCurrency, formatDate } from "../utils/formatters";
import { calculateDues } from "../utils/incomeCalculations";

const initialIncomeForm = {
  clientName: "",
  cbNumber: "",
  description: "",
  reference: "",
  quantity: 1,
  billAmount: "",
  receivedAmount: "",
  paymentMode: "cash",
  upiReferenceId: ""
};

const initialExpenseForm = {
  category: "petrol",
  amount: "",
  notes: ""
};

const feedbackStyles = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  error: "border-red-200 bg-red-50 text-red-700"
};

const StaffPanelPage = () => {
  const [incomeForm, setIncomeForm] = useState(initialIncomeForm);
  const [expenseForm, setExpenseForm] = useState(initialExpenseForm);
  const [incomes, setIncomes] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submittingIncome, setSubmittingIncome] = useState(false);
  const [submittingExpense, setSubmittingExpense] = useState(false);
  const [incomeFeedback, setIncomeFeedback] = useState(null);
  const [expenseFeedback, setExpenseFeedback] = useState(null);
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
        return {
          ...current,
          paymentMode: value,
          upiReferenceId: value === "upi" ? current.upiReferenceId : ""
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

  const handleIncomeSubmit = async (event) => {
    event.preventDefault();
    setSubmittingIncome(true);
    setIncomeFeedback(null);

    try {
      await api.post("/incomes", {
        ...incomeForm,
        quantity: Number(incomeForm.quantity),
        billAmount: Number(incomeForm.billAmount),
        receivedAmount: Number(incomeForm.receivedAmount),
        upiReferenceId: incomeForm.paymentMode === "upi" ? incomeForm.upiReferenceId : ""
      });

      setIncomeForm(initialIncomeForm);
      setIncomeFeedback({
        type: "success",
        message: "Income saved successfully."
      });
      await loadRecords();
    } catch (error) {
      setIncomeFeedback({
        type: "error",
        message: error.response?.data?.message || "Unable to save income."
      });
    } finally {
      setSubmittingIncome(false);
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

  const incomeColumns = [
    { key: "clientName", header: "Client Name" },
    { key: "billAmount", header: "Bill Amount", render: (row) => formatCurrency(row.billAmount) },
    { key: "receivedAmount", header: "Received Amount", render: (row) => formatCurrency(row.receivedAmount) },
    { key: "dues", header: "Dues", render: (row) => formatCurrency(row.dues) },
    {
      key: "paymentMode",
      header: "Payment Mode",
      render: (row) => (row.paymentMode === "upi" ? "UPI" : "Cash")
    },
    { key: "upiReferenceId", header: "UPI Reference" }
  ];

  const expenseColumns = [
    { key: "category", header: "Category" },
    { key: "amount", header: "Amount", render: (row) => formatCurrency(row.amount) },
    { key: "notes", header: "Notes" }
  ];

  if (loading) {
    return <div className="panel p-8 text-sm font-semibold text-muted">Loading Arshi Enterprises panel...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-2">
        <form className="panel p-6" onSubmit={handleIncomeSubmit}>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">Income Entry</p>
            <h3 className="mt-2 text-2xl font-bold text-ink">Add income</h3>
          </div>

          {incomeFeedback ? (
            <div className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${feedbackStyles[incomeFeedback.type]}`}>
              {incomeFeedback.message}
            </div>
          ) : null}

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Client Name / ID</label>
              <input className="field" name="clientName" value={incomeForm.clientName} onChange={handleIncomeChange} required />
            </div>
            <div>
              <label className="label">C/B Number</label>
              <input className="field" name="cbNumber" value={incomeForm.cbNumber} onChange={handleIncomeChange} required />
            </div>
            <div className="md:col-span-2">
              <label className="label">Description</label>
              <input className="field" name="description" value={incomeForm.description} onChange={handleIncomeChange} />
            </div>
            <div>
              <label className="label">Reference</label>
              <input className="field" name="reference" value={incomeForm.reference} onChange={handleIncomeChange} />
            </div>
            <div>
              <label className="label">Quantity</label>
              <input className="field" name="quantity" type="number" min="0" value={incomeForm.quantity} onChange={handleIncomeChange} required />
            </div>
            <div>
              <label className="label">Bill Amount</label>
              <input className="field" name="billAmount" type="number" min="0" value={incomeForm.billAmount} onChange={handleIncomeChange} required />
            </div>
            <div>
              <label className="label">Received Amount</label>
              <input className="field" name="receivedAmount" type="number" min="0" value={incomeForm.receivedAmount} onChange={handleIncomeChange} required />
            </div>
            <div>
              <label className="label">Dues</label>
              <input className="field bg-slate-50" value={formatCurrency(incomeDues)} readOnly />
              <p className="mt-2 text-xs text-muted">Auto-calculated from bill amount minus received amount.</p>
            </div>
            <div>
              <label className="label">Payment Mode</label>
              <select className="field" name="paymentMode" value={incomeForm.paymentMode} onChange={handleIncomeChange}>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
              </select>
            </div>
            {incomeForm.paymentMode === "upi" ? (
              <div>
                <label className="label">UPI Reference ID</label>
                <input
                  className="field"
                  name="upiReferenceId"
                  value={incomeForm.upiReferenceId}
                  onChange={handleIncomeChange}
                  required
                />
              </div>
            ) : null}
          </div>

          <div className="mt-6 flex justify-end">
            <button type="submit" className="button-primary" disabled={submittingIncome}>
              {submittingIncome ? "Saving..." : "Save income"}
            </button>
          </div>
        </form>

        <form className="panel p-6" onSubmit={handleExpenseSubmit}>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">Expense Entry</p>
            <h3 className="mt-2 text-2xl font-bold text-ink">Add expense</h3>
          </div>

          {expenseFeedback ? (
            <div className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${feedbackStyles[expenseFeedback.type]}`}>
              {expenseFeedback.message}
            </div>
          ) : null}

          <div className="mt-6 grid gap-4">
            <div>
              <label className="label">Category</label>
              <select className="field" name="category" value={expenseForm.category} onChange={handleExpenseChange}>
                <option value="petrol">Petrol</option>
                <option value="food">Food</option>
                <option value="courier">Courier</option>
                <option value="misc">Misc</option>
              </select>
            </div>
            <div>
              <label className="label">Amount</label>
              <input className="field" name="amount" type="number" min="0" value={expenseForm.amount} onChange={handleExpenseChange} required />
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea className="field min-h-36 resize-y" name="notes" value={expenseForm.notes} onChange={handleExpenseChange} />
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button type="submit" className="button-primary" disabled={submittingExpense}>
              {submittingExpense ? "Saving..." : "Save expense"}
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-6">
        <div className="panel p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">Income Ledger</p>
              <h3 className="mt-2 text-2xl font-bold text-ink">Your income records</h3>
            </div>
            <p className="text-sm text-muted">{incomes.length} rows</p>
          </div>
          <DataTable columns={incomeColumns} rows={incomes} emptyMessage="No income entries yet." />
        </div>

        <div className="panel p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">Expense Ledger</p>
              <h3 className="mt-2 text-2xl font-bold text-ink">Your expense records</h3>
            </div>
            <p className="text-sm text-muted">{expenses.length} rows</p>
          </div>
          <DataTable columns={expenseColumns} rows={expenses} emptyMessage="No expense entries yet." />
        </div>
      </section>
    </div>
  );
};

export default StaffPanelPage;
