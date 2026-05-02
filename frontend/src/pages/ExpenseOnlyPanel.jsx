import { useEffect, useState } from "react";
import api from "../api";
import DataTable from "../components/DataTable";
import RecordModal from "../components/RecordModal";
import { formatCurrency, formatDate } from "../utils/formatters";
import { downloadExpenseExcelReport } from "../utils/reportDownload";

const toDateInputValue = (date) => {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

const todayInputValue = () => toDateInputValue(new Date());

const initialExpenseForm = {
  category: "",
  amount: "",
  notes: ""
};

const ExpenseOnlyPanel = () => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRecord, setEditingRecord] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [exporting, setExporting] = useState("");
  const [filterDays, setFilterDays] = useState("30");
  const [user, setUser] = useState(null);

  const loadExpenses = async (days = filterDays) => {
    setLoading(true);
    try {
      const params = days ? { days } : {};
      const { data } = await api.get("/expenses", { params });
      setExpenses(data.expenses);
    } catch (error) {
      console.error("Error loading expenses:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadUser = async () => {
    try {
      const { data } = await api.get("/auth/profile");
      setUser(data);
    } catch (error) {
      console.error("Error loading user:", error);
    }
  };

  useEffect(() => {
    loadExpenses();
    loadUser();
  }, []);

  useEffect(() => {
    if (filterDays) {
      loadExpenses(filterDays);
    }
  }, [filterDays]);

  const handleAddExpense = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      await api.post("/expenses", {
        category: e.target.category.value,
        amount: parseFloat(e.target.amount.value),
        notes: e.target.notes.value
      });
      e.target.reset();
      loadExpenses();
    } catch (error) {
      console.error("Error adding expense:", error);
      alert("Failed to add expense");
    } finally {
      setSaving(false);
    }
  };

  const handleEditExpense = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      await api.put(`/expenses/${editingRecord._id}`, {
        category: e.target.category.value,
        amount: parseFloat(e.target.amount.value),
        notes: e.target.notes.value
      });
      setEditingRecord(null);
      setEditForm({});
      loadExpenses();
    } catch (error) {
      console.error("Error updating expense:", error);
      alert("Failed to update expense");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExpense = async (id) => {
    if (!confirm("Are you sure you want to delete this expense?")) return;
    setDeletingId(id);

    try {
      await api.delete(`/expenses/${id}`);
      loadExpenses();
    } catch (error) {
      console.error("Error deleting expense:", error);
      alert("Failed to delete expense");
    } finally {
      setDeletingId("");
    }
  };

  const openEditor = (record) => {
    setEditingRecord(record);
    setEditForm({
      category: record.category,
      amount: record.amount,
      notes: record.notes
    });
  };

  const closeEditor = () => {
    setEditingRecord(null);
    setEditForm({});
  };

  const handleExport = async (period) => {
    setExporting(period);
    try {
      await downloadExpenseExcelReport(period);
    } catch (error) {
      console.error("Error exporting:", error);
      alert("Failed to export");
    } finally {
      setExporting("");
    }
  };

  const expenseColumns = [
    { key: "date", header: "Date", render: (row) => formatDate(row.date) },
    { key: "category", header: "Category" },
    { key: "amount", header: "Amount", render: (row) => formatCurrency(row.amount) },
    { key: "notes", header: "Notes" },
    {
      key: "actions",
      header: "Actions",
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="button-secondary px-3 py-2 text-xs" onClick={() => openEditor(row)}>
            Edit
          </button>
          <button
            type="button"
            className="button-danger px-3 py-2 text-xs"
            onClick={() => handleDeleteExpense(row._id)}
            disabled={deletingId === row._id}
          >
            {deletingId === row._id ? "Deleting..." : "Delete"}
          </button>
        </div>
      )
    }
  ];

  const totalExpense = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="panel p-4 sm:p-6">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">Expense Management</p>
            <h3 className="mt-2 text-xl font-bold text-ink sm:text-2xl">
              {user?.username ? `Welcome, ${user.username}` : "Expense Dashboard"}
            </h3>
            <p className="mt-1 text-sm text-muted">Manage your expenses</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted">Total Expense</p>
            <p className="mt-1 text-2xl font-bold text-ink">{formatCurrency(totalExpense)}</p>
          </div>
        </div>

        <form className="mb-6 grid gap-4 sm:grid-cols-3" onSubmit={handleAddExpense}>
          <div>
            <label className="label">Category</label>
            <input className="field" name="category" placeholder="e.g., Office Supplies" required />
          </div>
          <div>
            <label className="label">Amount</label>
            <input className="field" name="amount" type="number" step="0.01" placeholder="0.00" required />
          </div>
          <div>
            <label className="label">Notes</label>
            <input className="field" name="notes" placeholder="Description" />
          </div>
          <div className="sm:col-span-3">
            <button type="submit" className="button-primary w-full sm:w-auto" disabled={saving}>
              {saving ? "Adding..." : "Add Expense"}
            </button>
          </div>
        </form>

        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="label">Filter by:</label>
          <select className="field w-full sm:w-40" value={filterDays} onChange={(e) => setFilterDays(e.target.value)}>
            <option value="">All time</option>
            <option value="1">Today</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last 365 days</option>
          </select>
        </div>

        <DataTable
          columns={expenseColumns}
          rows={expenses}
          emptyMessage={loading ? "Loading expenses..." : "No expenses found."}
        />
      </section>

      <section className="panel p-4 sm:p-6">
        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">Export Reports</p>
          <h3 className="mt-2 text-xl font-bold text-ink sm:text-2xl">Download Expense Reports</h3>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-xl border border-line bg-slate-50 p-4">
            <h4 className="mb-3 font-bold text-ink">Daily Report</h4>
            <button
              type="button"
              className="button-secondary w-full text-sm"
              onClick={() => handleExport("daily")}
              disabled={Boolean(exporting)}
            >
              {exporting === "daily" ? "Exporting..." : "📊 Download Excel"}
            </button>
          </div>
          <div className="rounded-xl border border-line bg-slate-50 p-4">
            <h4 className="mb-3 font-bold text-ink">Weekly Report</h4>
            <button
              type="button"
              className="button-secondary w-full text-sm"
              onClick={() => handleExport("weekly")}
              disabled={Boolean(exporting)}
            >
              {exporting === "weekly" ? "Exporting..." : "📊 Download Excel"}
            </button>
          </div>
          <div className="rounded-xl border border-line bg-slate-50 p-4">
            <h4 className="mb-3 font-bold text-ink">Monthly Report</h4>
            <button
              type="button"
              className="button-secondary w-full text-sm"
              onClick={() => handleExport("monthly")}
              disabled={Boolean(exporting)}
            >
              {exporting === "monthly" ? "Exporting..." : "📊 Download Excel"}
            </button>
          </div>
        </div>
      </section>

      {editingRecord ? (
        <RecordModal title="Edit Expense" onClose={closeEditor}>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleEditExpense}>
            <div className="md:col-span-2">
              <label className="label">Category</label>
              <input className="field" name="category" defaultValue={editForm.category} required />
            </div>
            <div>
              <label className="label">Amount</label>
              <input className="field" name="amount" type="number" step="0.01" defaultValue={editForm.amount} required />
            </div>
            <div>
              <label className="label">Notes</label>
              <input className="field" name="notes" defaultValue={editForm.notes} />
            </div>
            <div className="md:col-span-2 flex gap-2">
              <button type="submit" className="button-primary flex-1" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button type="button" className="button-secondary flex-1" onClick={closeEditor}>
                Cancel
              </button>
            </div>
          </form>
        </RecordModal>
      ) : null}
    </div>
  );
};

export default ExpenseOnlyPanel;
