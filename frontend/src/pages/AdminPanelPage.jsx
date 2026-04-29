import { useEffect, useMemo, useState } from "react";
import api from "../api";
import DataTable from "../components/DataTable";
import RecordModal from "../components/RecordModal";
import StatCard from "../components/StatCard";
import {
  downloadExcelReport,
  downloadPdfReport,
  downloadIncomeExcelReport,
  downloadIncomePdfReport,
  downloadExpenseExcelReport,
  downloadExpensePdfReport
} from "../utils/reportDownload";
import { formatCurrency, formatDate, formatMonthLabel } from "../utils/formatters";
import { calculateDues } from "../utils/incomeCalculations";

const initialUserForm = {
  username: "",
  password: ""
};

const AdminPanelPage = () => {
  const [users, setUsers] = useState([]);
  const [createUserForm, setCreateUserForm] = useState(initialUserForm);
  const [createUserMessage, setCreateUserMessage] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);
  const [historyMonths, setHistoryMonths] = useState("12");
  const [filters, setFilters] = useState({
    userId: "",
    days: "",
    startDate: "",
    endDate: ""
  });
  const [incomes, setIncomes] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [editingRecord, setEditingRecord] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState("");
  const [deletingUserId, setDeletingUserId] = useState("");
  const editingIncomeDues =
    editingRecord?.type === "income" ? calculateDues(editForm.billAmount, editForm.receivedAmount) : 0;

  const queryParams = useMemo(() => {
    return Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
  }, [filters]);

  const loadUsers = async () => {
    const { data } = await api.get("/auth/users");
    setUsers(data.users.filter((user) => user.role === "staff"));
  };

  const loadRecords = async (params = queryParams) => {
    const [{ data: incomeData }, { data: expenseData }] = await Promise.all([
      api.get("/incomes", { params }),
      api.get("/expenses", { params })
    ]);

    setIncomes(incomeData.incomes);
    setExpenses(expenseData.expenses);
  };

  const loadDashboard = async (months = historyMonths) => {
    const { data } = await api.get("/dashboard", {
      params: {
        months
      }
    });

    setDashboard(data);
  };

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        await Promise.all([loadUsers(), loadRecords({})]);
      } finally {
        if (mounted) {
          setRecordsLoading(false);
        }
      }
    };

    bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const fetchDashboard = async () => {
      setDashboardLoading(true);

      try {
        await loadDashboard(historyMonths);
      } finally {
        if (mounted) {
          setDashboardLoading(false);
        }
      }
    };

    fetchDashboard();

    return () => {
      mounted = false;
    };
  }, [historyMonths]);

  const refreshAdminData = async () => {
    await Promise.all([loadUsers(), loadRecords(), loadDashboard(historyMonths)]);
  };

  const handleFilterChange = (event) => {
    setFilters((current) => ({
      ...current,
      [event.target.name]: event.target.value
    }));
  };

  const handleApplyFilters = async (event) => {
    event.preventDefault();
    setRecordsLoading(true);

    try {
      await loadRecords();
    } finally {
      setRecordsLoading(false);
    }
  };

  const handleClearFilters = async () => {
    const clearedFilters = {
      userId: "",
      days: "",
      startDate: "",
      endDate: ""
    };

    setFilters(clearedFilters);
    setRecordsLoading(true);

    try {
      await loadRecords({});
    } finally {
      setRecordsLoading(false);
    }
  };

  const handleCreateUserChange = (event) => {
    setCreateUserForm((current) => ({
      ...current,
      [event.target.name]: event.target.value
    }));
  };

  const handleCreateUser = async (event) => {
    event.preventDefault();
    setCreatingUser(true);
    setCreateUserMessage("");

    try {
      await api.post("/auth/register", {
        ...createUserForm,
        role: "staff"
      });

      setCreateUserForm(initialUserForm);
      setCreateUserMessage("Staff user created successfully.");
      await loadUsers();
    } catch (error) {
      setCreateUserMessage(error.response?.data?.message || "Unable to create staff user.");
    } finally {
      setCreatingUser(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    const confirmed = window.confirm("Delete this staff user?");

    if (!confirmed) {
      return;
    }

    setDeletingUserId(userId);

    try {
      await api.delete(`/auth/users/${userId}`);
      await refreshAdminData();
    } finally {
      setDeletingUserId("");
    }
  };

  const handleExport = async (type) => {
    setExporting(type);

    try {
      // INCOME REPORTS
      if (type === "income-excel") {
        await downloadIncomeExcelReport("monthly");
        return;
      }
      if (type === "income-pdf") {
        await downloadIncomePdfReport("monthly");
        return;
      }
      if (type === "income-daily-pdf") {
        await downloadIncomePdfReport("daily");
        return;
      }
      if (type === "income-daily-excel") {
        await downloadIncomeExcelReport("daily");
        return;
      }
      if (type === "income-weekly-pdf") {
        await downloadIncomePdfReport("weekly");
        return;
      }
      if (type === "income-weekly-excel") {
        await downloadIncomeExcelReport("weekly");
        return;
      }
      if (type === "income-monthly-pdf") {
        await downloadIncomePdfReport("monthly");
        return;
      }
      if (type === "income-monthly-excel") {
        await downloadIncomeExcelReport("monthly");
        return;
      }
      if (type === "income-yearly-pdf") {
        await downloadIncomePdfReport("yearly");
        return;
      }
      if (type === "income-yearly-excel") {
        await downloadIncomeExcelReport("yearly");
        return;
      }
      if (type === "income-all-pdf") {
        await downloadIncomePdfReport("all");
        return;
      }
      if (type === "income-all-excel") {
        await downloadIncomeExcelReport("all");
        return;
      }

      // EXPENSE REPORTS
      if (type === "expense-excel") {
        await downloadExpenseExcelReport("monthly");
        return;
      }
      if (type === "expense-pdf") {
        await downloadExpensePdfReport("monthly");
        return;
      }
      if (type === "expense-daily-pdf") {
        await downloadExpensePdfReport("daily");
        return;
      }
      if (type === "expense-daily-excel") {
        await downloadExpenseExcelReport("daily");
        return;
      }
      if (type === "expense-weekly-pdf") {
        await downloadExpensePdfReport("weekly");
        return;
      }
      if (type === "expense-weekly-excel") {
        await downloadExpenseExcelReport("weekly");
        return;
      }
      if (type === "expense-monthly-pdf") {
        await downloadExpensePdfReport("monthly");
        return;
      }
      if (type === "expense-monthly-excel") {
        await downloadExpenseExcelReport("monthly");
        return;
      }
      if (type === "expense-yearly-pdf") {
        await downloadExpensePdfReport("yearly");
        return;
      }
      if (type === "expense-yearly-excel") {
        await downloadExpenseExcelReport("yearly");
        return;
      }
      if (type === "expense-all-pdf") {
        await downloadExpensePdfReport("all");
        return;
      }
      if (type === "expense-all-excel") {
        await downloadExpenseExcelReport("all");
        return;
      }
    } finally {
      setExporting("");
    }
  };

  const openEditor = (type, record) => {
    setEditingRecord({ type, record });

    if (type === "income") {
      setEditForm({
        clientName: record.clientName,
        cbNumber: record.cbNumber,
        description: record.description || "",
        reference: record.reference || "",
        quantity: record.quantity || 0,
        billAmount: record.billAmount,
        receivedAmount: record.receivedAmount,
        paymentMode: record.paymentMode,
        upiReferenceId: record.upiReferenceId || ""
      });
      return;
    }

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

  const handleEditChange = (event) => {
    setEditForm((current) => ({
      ...current,
      [event.target.name]: event.target.value
    }));
  };

  const handleSaveEdit = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      if (editingRecord.type === "income") {
        await api.put(`/incomes/${editingRecord.record._id}`, {
          clientName: editForm.clientName,
          cbNumber: editForm.cbNumber,
          description: editForm.description,
          reference: editForm.reference,
          quantity: Number(editForm.quantity) || 0,
          billAmount: Number(editForm.billAmount),
          receivedAmount: Number(editForm.receivedAmount),
          paymentMode: editForm.paymentMode,
          upiReferenceId: editForm.upiReferenceId
        });
      } else {
        await api.put(`/expenses/${editingRecord.record._id}`, {
          category: editForm.category,
          amount: Number(editForm.amount),
          notes: editForm.notes
        });
      }

      await Promise.all([loadRecords(), loadDashboard(historyMonths)]);
      closeEditor();
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRecord = async (type, id) => {
    const confirmed = window.confirm("Delete this record?");

    if (!confirmed) {
      return;
    }

    if (type === "income") {
      await api.delete(`/incomes/${id}`);
    } else {
      await api.delete(`/expenses/${id}`);
    }

    await Promise.all([loadRecords(), loadDashboard(historyMonths)]);
  };

  const userColumns = [
    { key: "username", header: "Username" },
    { key: "role", header: "Role" },
    { key: "createdAt", header: "Created", render: (row) => formatDate(row.createdAt) },
    {
      key: "actions",
      header: "Actions",
      render: (row) => (
        <button
          type="button"
          className="button-danger px-3 py-2 text-xs"
          onClick={() => handleDeleteUser(row.id)}
          disabled={deletingUserId === row.id}
        >
          {deletingUserId === row.id ? "Deleting..." : "Delete"}
        </button>
      )
    }
  ];

  const summaryRows = (dashboard?.monthlySummary || []).map((item) => ({
    ...item,
    id: item.month
  }));

  const summaryColumns = [
    { key: "month", header: "Month", render: (row) => formatMonthLabel(row.month) },
    { key: "income", header: "Income", render: (row) => formatCurrency(row.income) },
    { key: "expense", header: "Expense", render: (row) => formatCurrency(row.expense) }
  ];

  const incomeColumns = [
    { key: "cbNumber", header: "CB Number" },
    { key: "clientName", header: "Client Name" },
    { key: "description", header: "Description" },
    { key: "reference", header: "Reference" },
    { key: "quantity", header: "Qty" },
    { key: "billAmount", header: "Bill Amount", render: (row) => formatCurrency(row.billAmount) },
    { key: "receivedAmount", header: "Received Amount", render: (row) => formatCurrency(row.receivedAmount) },
    { key: "dues", header: "Dues", render: (row) => formatCurrency(row.dues) },
    { key: "paymentMode", header: "Payment Mode" },
    { key: "upiReferenceId", header: "UPI Reference" },
    {
      key: "user",
      header: "Staff",
      render: (row) => <span className="font-semibold text-ink">{row.userId?.username || "N/A"}</span>
    },
    {
      key: "actions",
      header: "Actions",
      render: (row) => (
        <div className="flex gap-2">
          <button type="button" className="button-secondary px-3 py-2 text-xs" onClick={() => openEditor("income", row)}>
            Edit
          </button>
          <button
            type="button"
            className="button-danger px-3 py-2 text-xs"
            onClick={() => handleDeleteRecord("income", row._id)}
          >
            Delete
          </button>
        </div>
      )
    }
  ];

  const expenseColumns = [
    { key: "category", header: "Category" },
    { key: "amount", header: "Amount", render: (row) => formatCurrency(row.amount) },
    { key: "notes", header: "Notes" },
    {
      key: "user",
      header: "Staff",
      render: (row) => <span className="font-semibold text-ink">{row.userId?.username || "N/A"}</span>
    },
    {
      key: "actions",
      header: "Actions",
      render: (row) => (
        <div className="flex gap-2">
          <button type="button" className="button-secondary px-3 py-2 text-xs" onClick={() => openEditor("expense", row)}>
            Edit
          </button>
          <button
            type="button"
            className="button-danger px-3 py-2 text-xs"
            onClick={() => handleDeleteRecord("expense", row._id)}
          >
            Delete
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <form className="panel p-6" onSubmit={handleCreateUser}>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">Arshi Enterprises - User Access</p>
              <h3 className="mt-2 text-2xl font-bold text-ink">Create staff user</h3>
            </div>
            <button type="submit" className="button-primary" disabled={creatingUser}>
              {creatingUser ? "Creating..." : "Create User"}
            </button>
          </div>

          <div className="mt-6 grid gap-4">
            <div>
              <label className="label">Username</label>
              <input
                className="field"
                name="username"
                value={createUserForm.username}
                onChange={handleCreateUserChange}
                required
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                className="field"
                name="password"
                type="password"
                value={createUserForm.password}
                onChange={handleCreateUserChange}
                required
              />
            </div>
            <div>
              <label className="label">Role</label>
              <input className="field bg-slate-50" value="staff" disabled readOnly />
            </div>
          </div>

          {createUserMessage ? (
            <div className="mt-4 rounded-2xl border border-line bg-[#fff7ed] px-4 py-3 text-sm text-muted">
              {createUserMessage}
            </div>
          ) : null}
        </form>

        <div className="panel p-6">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">Arshi Enterprises - User Management</p>
              <h3 className="mt-2 text-2xl font-bold text-ink">Staff users</h3>
            </div>
            <p className="text-sm text-muted">{users.length} staff</p>
          </div>
          <div className="overflow-x-auto">
            <DataTable columns={userColumns} rows={users} emptyMessage="No staff users found." />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Today's Revenue"
          value={dashboardLoading ? "Loading..." : formatCurrency(dashboard?.todayRevenue)}
          tone="revenue"
          subtitle="All collected income for today"
        />
        <StatCard
          title="Today's Expenses"
          value={dashboardLoading ? "Loading..." : formatCurrency(dashboard?.todayExpenses)}
          tone="expense"
          subtitle="All expense entries posted today"
        />
        <StatCard
          title="Total Dues"
          value={dashboardLoading ? "Loading..." : formatCurrency(dashboard?.totalDues)}
          tone="dues"
          subtitle="Open dues across the whole business"
        />
      </section>

      <section className="panel p-6">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">History</p>
            <h3 className="mt-2 text-2xl font-bold text-ink">Previous year records</h3>
            <p className="mt-2 text-sm text-muted">Switch between 1 year and 2 years of month-wise admin data.</p>
          </div>
          <div className="w-full max-w-xs">
            <label className="label">History Window</label>
            <select className="field" value={historyMonths} onChange={(event) => setHistoryMonths(event.target.value)}>
              <option value="12">Last 12 months</option>
              <option value="24">Last 24 months</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <DataTable
            columns={summaryColumns}
            rows={summaryRows}
            emptyMessage={dashboardLoading ? "Loading monthly summary..." : "No monthly summary found."}
          />
        </div>
      </section>

      <section className="panel p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">Filters</p>
            <h3 className="mt-2 text-2xl font-bold text-ink">Refine records</h3>
          </div>
          <div className="rounded-2xl border border-line bg-slate-50 px-4 py-3 text-sm text-muted">
            Incomes: <span className="font-semibold text-ink">{incomes.length}</span> | Expenses:{" "}
            <span className="font-semibold text-ink">{expenses.length}</span>
          </div>
        </div>

        <form className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr_1fr_auto_auto]" onSubmit={handleApplyFilters}>
          <div>
            <label className="label">User</label>
            <select className="field" name="userId" value={filters.userId} onChange={handleFilterChange}>
              <option value="">All staff</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.username}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Last N Days</label>
            <select className="field" name="days" value={filters.days} onChange={handleFilterChange}>
              <option value="">All time</option>
              <option value="1">Today</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last 365 days</option>
            </select>
          </div>
          <div>
            <label className="label">Start Date</label>
            <input
              className="field"
              name="startDate"
              type="date"
              value={filters.startDate}
              onChange={handleFilterChange}
              disabled={filters.days}
            />
          </div>
          <div>
            <label className="label">End Date</label>
            <input
              className="field"
              name="endDate"
              type="date"
              value={filters.endDate}
              onChange={handleFilterChange}
              disabled={filters.days}
            />
          </div>
          <button type="submit" className="button-primary self-end">
            Apply
          </button>
          <button type="button" className="button-secondary self-end" onClick={handleClearFilters}>
            Clear
          </button>
        </form>
      </section>

      <section className="panel p-6">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">Income Ledger</p>
            <h3 className="mt-2 text-2xl font-bold text-ink">All income records</h3>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              className="button-secondary w-full sm:w-auto"
              onClick={() => handleExport("income-pdf")}
              disabled={Boolean(exporting)}
            >
              {exporting === "income-pdf" ? "Exporting..." : "Export Income PDF"}
            </button>
            <button
              type="button"
              className="button-secondary w-full sm:w-auto"
              onClick={() => handleExport("income-excel")}
              disabled={Boolean(exporting)}
            >
              {exporting === "income-excel" ? "Exporting..." : "Export Income Excel"}
            </button>
          </div>
          {recordsLoading ? <p className="text-sm text-muted">Refreshing...</p> : null}
        </div>
        <div className="overflow-x-auto">
          <DataTable
            columns={incomeColumns}
            rows={incomes}
            emptyMessage={recordsLoading ? "Loading income records..." : "No income records for the selected filters."}
          />
        </div>
      </section>

      <section className="panel p-6">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">Expense Ledger</p>
            <h3 className="mt-2 text-2xl font-bold text-ink">All expense records</h3>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              className="button-secondary w-full sm:w-auto"
              onClick={() => handleExport("expense-pdf")}
              disabled={Boolean(exporting)}
            >
              {exporting === "expense-pdf" ? "Exporting..." : "Export Expense PDF"}
            </button>
            <button
              type="button"
              className="button-secondary w-full sm:w-auto"
              onClick={() => handleExport("expense-excel")}
              disabled={Boolean(exporting)}
            >
              {exporting === "expense-excel" ? "Exporting..." : "Export Expense Excel"}
            </button>
          </div>
          {recordsLoading ? <p className="text-sm text-muted">Refreshing...</p> : null}
        </div>
        <div className="overflow-x-auto">
          <DataTable
            columns={expenseColumns}
            rows={expenses}
            emptyMessage={recordsLoading ? "Loading expense records..." : "No expense records for the selected filters."}
          />
        </div>
      </section>

      <section className="panel p-6">
        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">Report Builder</p>
          <h3 className="mt-2 text-2xl font-bold text-ink">Generate Period Reports</h3>
          <p className="mt-2 text-sm text-muted">Download comprehensive reports for different time periods.</p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2">
          {/* DAILY REPORTS */}
          <div className="rounded-xl border border-line bg-slate-50 p-4">
            <h4 className="mb-3 font-bold text-ink">Daily Reports</h4>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="button-secondary text-sm w-full sm:w-auto"
                onClick={() => handleExport("income-daily-pdf")}
                disabled={Boolean(exporting)}
              >
                {exporting === "income-daily-pdf" ? "Exporting..." : "📄 Income PDF"}
              </button>
              <button
                type="button"
                className="button-secondary text-sm w-full sm:w-auto"
                onClick={() => handleExport("income-daily-excel")}
                disabled={Boolean(exporting)}
              >
                {exporting === "income-daily-excel" ? "Exporting..." : "📊 Income Excel"}
              </button>
              <button
                type="button"
                className="button-secondary text-sm w-full sm:w-auto"
                onClick={() => handleExport("expense-daily-pdf")}
                disabled={Boolean(exporting)}
              >
                {exporting === "expense-daily-pdf" ? "Exporting..." : "📄 Expense PDF"}
              </button>
              <button
                type="button"
                className="button-secondary text-sm w-full sm:w-auto"
                onClick={() => handleExport("expense-daily-excel")}
                disabled={Boolean(exporting)}
              >
                {exporting === "expense-daily-excel" ? "Exporting..." : "📊 Expense Excel"}
              </button>
            </div>
          </div>

          {/* WEEKLY REPORTS */}
          <div className="rounded-xl border border-line bg-slate-50 p-4">
            <h4 className="mb-3 font-bold text-ink">Weekly Reports</h4>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="button-secondary text-sm w-full sm:w-auto"
                onClick={() => handleExport("income-weekly-pdf")}
                disabled={Boolean(exporting)}
              >
                {exporting === "income-weekly-pdf" ? "Exporting..." : "📄 Income PDF"}
              </button>
              <button
                type="button"
                className="button-secondary text-sm w-full sm:w-auto"
                onClick={() => handleExport("income-weekly-excel")}
                disabled={Boolean(exporting)}
              >
                {exporting === "income-weekly-excel" ? "Exporting..." : "📊 Income Excel"}
              </button>
              <button
                type="button"
                className="button-secondary text-sm w-full sm:w-auto"
                onClick={() => handleExport("expense-weekly-pdf")}
                disabled={Boolean(exporting)}
              >
                {exporting === "expense-weekly-pdf" ? "Exporting..." : "📄 Expense PDF"}
              </button>
              <button
                type="button"
                className="button-secondary text-sm w-full sm:w-auto"
                onClick={() => handleExport("expense-weekly-excel")}
                disabled={Boolean(exporting)}
              >
                {exporting === "expense-weekly-excel" ? "Exporting..." : "📊 Expense Excel"}
              </button>
            </div>
          </div>

          {/* MONTHLY REPORTS */}
          <div className="rounded-xl border border-line bg-slate-50 p-4">
            <h4 className="mb-3 font-bold text-ink">Monthly Reports</h4>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="button-secondary text-sm w-full sm:w-auto"
                onClick={() => handleExport("income-monthly-pdf")}
                disabled={Boolean(exporting)}
              >
                {exporting === "income-monthly-pdf" ? "Exporting..." : "📄 Income PDF"}
              </button>
              <button
                type="button"
                className="button-secondary text-sm w-full sm:w-auto"
                onClick={() => handleExport("income-monthly-excel")}
                disabled={Boolean(exporting)}
              >
                {exporting === "income-monthly-excel" ? "Exporting..." : "📊 Income Excel"}
              </button>
              <button
                type="button"
                className="button-secondary text-sm w-full sm:w-auto"
                onClick={() => handleExport("expense-monthly-pdf")}
                disabled={Boolean(exporting)}
              >
                {exporting === "expense-monthly-pdf" ? "Exporting..." : "📄 Expense PDF"}
              </button>
              <button
                type="button"
                className="button-secondary text-sm w-full sm:w-auto"
                onClick={() => handleExport("expense-monthly-excel")}
                disabled={Boolean(exporting)}
              >
                {exporting === "expense-monthly-excel" ? "Exporting..." : "📊 Expense Excel"}
              </button>
            </div>
          </div>

          {/* YEARLY REPORTS */}
          <div className="rounded-xl border border-line bg-slate-50 p-4">
            <h4 className="mb-3 font-bold text-ink">Yearly Reports</h4>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="button-secondary text-sm w-full sm:w-auto"
                onClick={() => handleExport("income-yearly-pdf")}
                disabled={Boolean(exporting)}
              >
                {exporting === "income-yearly-pdf" ? "Exporting..." : "📄 Income PDF"}
              </button>
              <button
                type="button"
                className="button-secondary text-sm w-full sm:w-auto"
                onClick={() => handleExport("income-yearly-excel")}
                disabled={Boolean(exporting)}
              >
                {exporting === "income-yearly-excel" ? "Exporting..." : "📊 Income Excel"}
              </button>
              <button
                type="button"
                className="button-secondary text-sm w-full sm:w-auto"
                onClick={() => handleExport("expense-yearly-pdf")}
                disabled={Boolean(exporting)}
              >
                {exporting === "expense-yearly-pdf" ? "Exporting..." : "📄 Expense PDF"}
              </button>
              <button
                type="button"
                className="button-secondary text-sm w-full sm:w-auto"
                onClick={() => handleExport("expense-yearly-excel")}
                disabled={Boolean(exporting)}
              >
                {exporting === "expense-yearly-excel" ? "Exporting..." : "📊 Expense Excel"}
              </button>
            </div>
          </div>

          {/* ALL REPORTS */}
          <div className="rounded-xl border border-line bg-slate-50 p-4">
            <h4 className="mb-3 font-bold text-ink">Complete History</h4>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="button-secondary text-sm w-full sm:w-auto"
                onClick={() => handleExport("income-all-pdf")}
                disabled={Boolean(exporting)}
              >
                {exporting === "income-all-pdf" ? "Exporting..." : "📄 All Income PDF"}
              </button>
              <button
                type="button"
                className="button-secondary text-sm w-full sm:w-auto"
                onClick={() => handleExport("income-all-excel")}
                disabled={Boolean(exporting)}
              >
                {exporting === "income-all-excel" ? "Exporting..." : "📊 All Income Excel"}
              </button>
              <button
                type="button"
                className="button-secondary text-sm"
                onClick={() => handleExport("expense-all-pdf")}
                disabled={Boolean(exporting)}
              >
                {exporting === "expense-all-pdf" ? "Exporting..." : "📄 All Expense PDF"}
              </button>
              <button
                type="button"
                className="button-secondary text-sm"
                onClick={() => handleExport("expense-all-excel")}
                disabled={Boolean(exporting)}
              >
                {exporting === "expense-all-excel" ? "Exporting..." : "📊 All Expense Excel"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {editingRecord ? (
        <RecordModal
          title={editingRecord.type === "income" ? "Edit income record" : "Edit expense record"}
          onClose={closeEditor}
        >
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSaveEdit}>
            {editingRecord.type === "income" ? (
              <>
                <div className="md:col-span-2">
                  <label className="label">Client Name / ID</label>
                  <input
                    className="field"
                    name="clientName"
                    value={editForm.clientName || ""}
                    onChange={handleEditChange}
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="label">CB Number</label>
                  <input
                    className="field"
                    name="cbNumber"
                    value={editForm.cbNumber || ""}
                    onChange={handleEditChange}
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="label">Description</label>
                  <input
                    className="field"
                    name="description"
                    value={editForm.description || ""}
                    onChange={handleEditChange}
                    placeholder="Enter description"
                  />
                </div>
                <div>
                  <label className="label">Reference</label>
                  <input
                    className="field"
                    name="reference"
                    value={editForm.reference || ""}
                    onChange={handleEditChange}
                    placeholder="Enter reference"
                  />
                </div>
                <div>
                  <label className="label">Quantity</label>
                  <input
                    className="field"
                    name="quantity"
                    type="number"
                    min="0"
                    value={editForm.quantity || 0}
                    onChange={handleEditChange}
                    required
                  />
                </div>
                <div>
                  <label className="label">Bill Amount</label>
                  <input
                    className="field"
                    name="billAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={editForm.billAmount || ""}
                    onChange={handleEditChange}
                    required
                  />
                </div>
                <div>
                  <label className="label">Received Amount</label>
                  <input
                    className="field"
                    name="receivedAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={editForm.receivedAmount || ""}
                    onChange={handleEditChange}
                    required
                  />
                </div>
                <div>
                  <label className="label">Dues (Auto-calculated)</label>
                  <input className="field bg-slate-50" value={formatCurrency(editingIncomeDues)} readOnly disabled />
                </div>
                <div>
                  <label className="label">Payment Mode</label>
                  <select
                    className="field"
                    name="paymentMode"
                    value={editForm.paymentMode || "cash"}
                    onChange={handleEditChange}
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="bank">Bank</option>
                  </select>
                </div>
                <div>
                  <label className="label">UPI Reference (if applicable)</label>
                  <input
                    className="field"
                    name="upiReferenceId"
                    value={editForm.upiReferenceId || ""}
                    onChange={handleEditChange}
                    placeholder="Enter UPI reference or transaction ID"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="label">Category</label>
                  <select
                    className="field"
                    name="category"
                    value={editForm.category || "petrol"}
                    onChange={handleEditChange}
                  >
                    <option value="petrol">Petrol</option>
                    <option value="food">Food</option>
                    <option value="courier">Courier</option>
                    <option value="misc">Misc</option>
                  </select>
                </div>
                <div>
                  <label className="label">Amount</label>
                  <input
                    className="field"
                    name="amount"
                    type="number"
                    min="0"
                    value={editForm.amount || ""}
                    onChange={handleEditChange}
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="label">Notes</label>
                  <textarea
                    className="field min-h-36 resize-y"
                    name="notes"
                    value={editForm.notes || ""}
                    onChange={handleEditChange}
                  />
                </div>
              </>
            )}

            <div className="md:col-span-2 flex justify-end gap-3 pt-2">
              <button type="button" className="button-secondary" onClick={closeEditor}>
                Cancel
              </button>
              <button type="submit" className="button-primary" disabled={saving}>
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
        </RecordModal>
      ) : null}
    </div>
  );
};

export default AdminPanelPage;
