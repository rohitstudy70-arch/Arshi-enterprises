import { useEffect, useMemo, useState } from "react";
import api from "../api";
import DataTable from "../components/DataTable";
import RecordModal from "../components/RecordModal";
import StatCard from "../components/StatCard";
import {
  downloadExcelReport,
  downloadIncomeExcelReport,
  downloadExpenseExcelReport,
  downloadLedgerExcelReport,
  downloadCustomerLedgerExcel,
  downloadDueSummaryExcel,
  downloadImeiTrackingExcel
} from "../utils/reportDownload";
import { formatCurrency, formatDate, formatMonthLabel } from "../utils/formatters";
import { calculateDues } from "../utils/incomeCalculations";

const initialUserForm = {
  username: "",
  password: "",
  role: "executive"
};

const AdminPanelPage = () => {
  const [users, setUsers] = useState([]);
  const [createUserForm, setCreateUserForm] = useState(initialUserForm);
  const [createUserMessage, setCreateUserMessage] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);
  
  const [historyMonths, setHistoryMonths] = useState("12");
  const [filters, setFilters] = useState({
    userId: "",
    days: "1",
    startDate: "",
    endDate: "",
    month: "",
    serviceType: ""
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
  const [passwordChangeUser, setPasswordChangeUser] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [passwordChangeMessage, setPasswordChangeMessage] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Dashboard tabs
  const [activeTab, setActiveTab] = useState("records");

  // Customer Ledger
  const [ledgerCdbId, setLedgerCdbId] = useState("");
  const [ledgerData, setLedgerData] = useState(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // Due Dashboard
  const [dueSummaryData, setDueSummaryData] = useState(null);
  const [dueSummaryLoading, setDueSummaryLoading] = useState(false);
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [vehicleSearchResults, setVehicleSearchResults] = useState(null);
  const [vehicleSearchLoading, setVehicleSearchLoading] = useState(false);

  // IMEI Tracking
  const [imeiSearch, setImeiSearch] = useState("");
  const [imeiData, setImeiData] = useState([]);
  const [imeiLoading, setImeiLoading] = useState(false);

  // Update Due Modal (Payment Entry System)
  const [updateDueModal, setUpdateDueModal] = useState({ open: false, cdbId: "", currentDue: 0, customerName: "" });
  const [paymentForm, setPaymentForm] = useState({
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentAmount: "",
    paymentMode: "cash",
    referenceNumber: "",
    imeiNumber: "",
    vehicleNumber: "",
    chassisNumber: ""
  });
  const [updatingDue, setUpdatingDue] = useState(false);
  const [customerDetails, setCustomerDetails] = useState(null);
  const [loadingCustomerDetails, setLoadingCustomerDetails] = useState(false);

  const editingIncomeDues =
    editingRecord?.type === "income" ? calculateDues(editForm.billAmount, editForm.receivedAmount) : 0;

  const queryParams = useMemo(() => {
    return Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
  }, [filters]);

  const loadUsers = async () => {
    const { data } = await api.get("/auth/users");
    setUsers(data.users);
  };

  

  const loadRecords = async (params = queryParams) => {
    const [{ data: incomeData }, { data: expenseData }] = await Promise.all([
      api.get("/incomes", { params }),
      api.get("/expenses", { params })
    ]);

    setIncomes(incomeData.incomes);
    setExpenses(expenseData.expenses);
  };

  const loadDashboard = async (months = historyMonths, dashboardFilters = filters) => {
    const { data } = await api.get("/dashboard", {
      params: {
        months,
        month: dashboardFilters.month,
        serviceType: dashboardFilters.serviceType,
        startDate: dashboardFilters.startDate,
        endDate: dashboardFilters.endDate
      }
    });

    setDashboard(data);
  };

  // ================= CUSTOMER LEDGER =================
  const loadLedger = async (cdbId) => {
    if (!cdbId || !String(cdbId).trim()) return;
    setLedgerLoading(true);
    try {
      const { data } = await api.get("/due/ledger", { params: { cdbId } });
      setLedgerData(data);
    } catch (error) {
      console.error("Ledger load error:", error);
    } finally {
      setLedgerLoading(false);
    }
  };

  // ================= DUE SUMMARY =================
  const loadDueSummary = async () => {
    setDueSummaryLoading(true);
    try {
      const { data } = await api.get("/due/summary");
      setDueSummaryData(data);
      setVehicleSearchResults(null);
    } catch (error) {
      console.error("Due summary load error:", error);
    } finally {
      setDueSummaryLoading(false);
    }
  };

  // ================= SEARCH BY VEHICLE NUMBER =================
  const searchByVehicleNumber = async (vehicleNum) => {
    if (!vehicleNum || !String(vehicleNum).trim()) return;
    setVehicleSearchLoading(true);
    try {
      const { data } = await api.get("/due/search-vehicle", { params: { vehicleNumber: vehicleNum } });
      setVehicleSearchResults(data);
    } catch (error) {
      console.error("Vehicle search error:", error);
      alert(error.response?.data?.message || "Failed to search by vehicle number");
    } finally {
      setVehicleSearchLoading(false);
    }
  };

  // ================= IMEI TRACKING =================
  const loadImeiTracking = async (search = "") => {
    setImeiLoading(true);
    try {
      const { data } = await api.get("/due/items", { params: { search } });
      setImeiData(data.items || []);
    } catch (error) {
      console.error("IMEI tracking load error:", error);
    } finally {
      setImeiLoading(false);
    }
  };

  const handleUpdateDue = async (e) => {
    e.preventDefault();
    setUpdatingDue(true);

    try {
      const paymentAmountNum = Number(paymentForm.paymentAmount);
      const currentDueNum = updateDueModal.currentDue;

      // Validation: Payment amount cannot be greater than current due
      if (paymentAmountNum > currentDueNum) {
        alert("Payment amount cannot be greater than current due");
        return;
      }

      // Validation: Reference number required for UPI and Bank
      if ((paymentForm.paymentMode === "upi" || paymentForm.paymentMode === "bank") && !paymentForm.referenceNumber.trim()) {
        alert("Reference number is required for UPI and Bank payments");
        return;
      }

      // Calculate new due
      const newDue = currentDueNum - paymentAmountNum;

      // Show summary before submit
      const confirmed = confirm(
        `Payment Summary:\n\n` +
        `Current Due: ₹${formatCurrency(currentDueNum)}\n` +
        `Payment Amount: ₹${formatCurrency(paymentAmountNum)}\n` +
        `New Due: ₹${formatCurrency(newDue)}\n\n` +
        `Confirm payment?`
      );

      if (!confirmed) {
        return;
      }

      await api.post("/payments/save", {
        cdbId: updateDueModal.cdbId,
        customerName: updateDueModal.customerName,
        paymentDate: paymentForm.paymentDate,
        paymentAmount: paymentAmountNum,
        paymentMode: paymentForm.paymentMode,
        referenceNumber: paymentForm.referenceNumber,
        imeiNumber: paymentForm.imeiNumber,
        vehicleNumber: paymentForm.vehicleNumber,
        chassisNumber: paymentForm.chassisNumber,
        previousDue: currentDueNum
      });

      setUpdateDueModal({ open: false, cdbId: "", currentDue: 0, customerName: "" });
      setCustomerDetails(null);
      setPaymentForm({
        paymentDate: new Date().toISOString().slice(0, 10),
        paymentAmount: "",
        paymentMode: "cash",
        referenceNumber: "",
        imeiNumber: "",
        vehicleNumber: "",
        chassisNumber: ""
      });

      // Refresh all data
      await Promise.all([loadDueSummary(), loadRecords({})]);

      alert("Payment recorded successfully!");
    } catch (error) {
      console.error("Error saving payment:", error);
      alert(error.response?.data?.message || "Failed to save payment");
    } finally {
      setUpdatingDue(false);
    }
  };

  const openUpdateDueModal = async (cdbId, currentDue, customerName) => {
    setUpdateDueModal({ open: true, cdbId, currentDue, customerName });
    setLoadingCustomerDetails(true);

    try {
      const { data } = await api.get("/payments/customer-details", { params: { cdbId } });
      setCustomerDetails(data);
      setPaymentForm({
        paymentDate: new Date().toISOString().slice(0, 10),
        paymentAmount: "",
        paymentMode: "cash",
        referenceNumber: "",
        imeiNumber: data.imeiNumber || "",
        vehicleNumber: data.vehicleNumber || "",
        chassisNumber: data.chassisNumber || ""
      });
    } catch (error) {
      console.error("Error fetching customer details:", error);
      alert("Failed to fetch customer details");
    } finally {
      setLoadingCustomerDetails(false);
    }
  };

  const handlePaymentFormChange = (e) => {
    const { name, value } = e.target;
    setPaymentForm(prev => ({ ...prev, [name]: value }));
  };

  const closeUpdateDueModal = () => {
    setUpdateDueModal({ open: false, cdbId: "", currentDue: 0, customerName: "" });
    setCustomerDetails(null);
    setPaymentForm({
      paymentDate: new Date().toISOString().slice(0, 10),
      paymentAmount: "",
      paymentMode: "cash",
      referenceNumber: "",
      imeiNumber: "",
      vehicleNumber: "",
      chassisNumber: ""
    });
  };

  const calculatedNewDue = updateDueModal.currentDue - (Number(paymentForm.paymentAmount) || 0);

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
    const { name, value } = event.target;
    setFilters((current) => ({
      ...current,
      [name]: value,
      ...(name === "month" && value ? { days: "", startDate: "", endDate: "" } : {}),
      ...(name === "days" && value ? { month: "", startDate: "", endDate: "" } : {})
    }));
  };

  const handleApplyFilters = async (event) => {
    event.preventDefault();
    setRecordsLoading(true);
    setDashboardLoading(true);

    try {
      await Promise.all([loadRecords(), loadDashboard(historyMonths, filters)]);
    } finally {
      setRecordsLoading(false);
      setDashboardLoading(false);
    }
  };

  const handleClearFilters = async () => {
    const clearedFilters = {
      userId: "",
      days: "",
      startDate: "",
      endDate: "",
      month: "",
      serviceType: ""
    };

    setFilters(clearedFilters);
    setRecordsLoading(true);
    setDashboardLoading(true);

    try {
      await Promise.all([loadRecords({}), loadDashboard(historyMonths, clearedFilters)]);
    } finally {
      setRecordsLoading(false);
      setDashboardLoading(false);
    }
  };

  const handleCreateUserChange = (event) => {
    setCreateUserForm((current) => ({
      ...current,
      [event.target.name]: event.target.value
    }));
  };

  const handleCreateTagChange = (e) => {
    const { name, value } = e.target;
    setCreateTagForm((c) => ({ ...c, [name]: value }));
  };

  const handleCreateTag = async (e) => {
    e.preventDefault();
    setCreatingTag(true);
    setCreateTagMessage("");

    try {
      await api.post("/expense-tags", createTagForm);
      setCreateTagForm({ code: "", name: "" });
      setCreateTagMessage("Tag created");
      await loadExpenseTags();
    } catch (error) {
      setCreateTagMessage(error.response?.data?.message || "Failed to create tag");
    } finally {
      setCreatingTag(false);
    }
  };
  

  const handleCreateUser = async (event) => {
    event.preventDefault();
    setCreatingUser(true);
    setCreateUserMessage("");

    try {
      await api.post("/auth/register", createUserForm);

      setCreateUserForm(initialUserForm);
      setCreateUserMessage("User created successfully.");
      await loadUsers();
    } catch (error) {
      setCreateUserMessage(error.response?.data?.message || "Unable to create user.");
    } finally {
      setCreatingUser(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    const confirmed = window.confirm("Delete this user?");

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

  const openPasswordChange = (user) => {
    setPasswordChangeUser(user);
    setNewPassword("");
    setPasswordChangeMessage("");
  };

  const closePasswordChange = () => {
    setPasswordChangeUser(null);
    setNewPassword("");
    setPasswordChangeMessage("");
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setPasswordChangeMessage("Password must be at least 6 characters.");
      return;
    }

    setChangingPassword(true);
    setPasswordChangeMessage("");

    try {
      await api.put(`/auth/users/${passwordChangeUser.id}/password`, {
        password: newPassword
      });
      setPasswordChangeMessage("Password updated successfully.");
      setNewPassword("");
    } catch (error) {
      setPasswordChangeMessage(error.response?.data?.message || "Failed to update password.");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleExport = async (type) => {
    setExporting(type);

    try {
      // INCOME EXCEL REPORTS
      if (type === "income-daily-excel") {
        await downloadIncomeExcelReport("daily");
        return;
      }
      if (type === "income-weekly-excel") {
        await downloadIncomeExcelReport("weekly");
        return;
      }
      if (type === "income-monthly-excel") {
        await downloadIncomeExcelReport("monthly", { month: filters.month, serviceType: filters.serviceType });
        return;
      }
      if (type === "income-yearly-excel") {
        await downloadIncomeExcelReport("yearly");
        return;
      }
      if (type === "income-all-excel") {
        await downloadIncomeExcelReport("all");
        return;
      }

      // EXPENSE EXCEL REPORTS
      if (type === "expense-daily-excel") {
        await downloadExpenseExcelReport("daily");
        return;
      }
      if (type === "expense-weekly-excel") {
        await downloadExpenseExcelReport("weekly");
        return;
      }
      if (type === "expense-monthly-excel") {
        await downloadExpenseExcelReport("monthly");
        return;
      }
      if (type === "expense-yearly-excel") {
        await downloadExpenseExcelReport("yearly");
        return;
      }
      if (type === "expense-all-excel") {
        await downloadExpenseExcelReport("all");
        return;
      }

      // LEDGER (Transaction-based) REPORTS
      if (type === "ledger-daily-excel") {
        await downloadLedgerExcelReport("daily");
        return;
      }
      if (type === "ledger-weekly-excel") {
        await downloadLedgerExcelReport("weekly");
        return;
      }
      if (type === "ledger-monthly-excel") {
        await downloadLedgerExcelReport("monthly");
        return;
      }
      if (type === "ledger-yearly-excel") {
        await downloadLedgerExcelReport("yearly");
        return;
      }
      if (type === "ledger-all-excel") {
        await downloadLedgerExcelReport("all");
        return;
      }
      if (type === "executive-ledger-monthly-excel") {
        await downloadLedgerExcelReport("monthly", { userId: filters.userId });
        return;
      }

      // EXECUTIVE-SCOPED MONTHLY REPORTS (Excel, filtered by selected userId)
      if (type === "executive-income-monthly-excel") {
        await downloadIncomeExcelReport("monthly", { userId: filters.userId, month: filters.month, serviceType: filters.serviceType });
        return;
      }
      if (type === "executive-expense-monthly-excel") {
        await downloadExpenseExcelReport("monthly", { userId: filters.userId });
        return;
      }

      // DUE & ITEM TRACKING REPORTS
      if (type === "customer-ledger-excel") {
        await downloadCustomerLedgerExcel(ledgerCdbId);
        return;
      }
      if (type === "due-summary-excel") {
        await downloadDueSummaryExcel();
        return;
      }
      if (type === "imei-tracking-excel") {
        await downloadImeiTrackingExcel(imeiSearch);
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
        transaction_date: (record.transaction_date || record.createdAt || "").slice(0, 10),
        paymentDate: record.paymentDate ? record.paymentDate.slice(0, 10) : "",
        mobile1: record.mobile1 || "",
        mobile2: record.mobile2 || "",
        clientUserId: record.clientUserId || "",
        address: record.address || "",
        district: record.district || "",
        vehicleChassisNo: record.vehicleChassisNo || "",
        serviceType: record.serviceType || record.description || "",
        description: record.description || "",
        item: record.item || "",
        model: record.model || "",
        imeiNo: record.imeiNo || "",
        imeiLastSix: record.imeiLastSix || "",
        vtsNo: record.vtsNo || "",
        technician: record.technician || "",
        reference: record.reference || "",
        quantity: record.quantity || 0,
        billAmount: record.billAmount,
        receivedAmount: record.receivedAmount,
        previousDuesReceived: record.previousDuesReceived || 0,
        paymentMode: record.paymentMode,
        upiReferenceId: record.upiReferenceId || "",
        cashAmount: record.cashAmount || 0,
        upiAmount: record.upiAmount || 0,
        cctvDetails: record.cctvDetails || "",
        cctvSerialNo: record.cctvSerialNo || "",
        remarks: record.remarks || ""
      });
      return;
    }

    setEditForm({
      category: record.category || "petrol",
      amount: record.amount || "",
      notes: record.notes || "",
      date: record.date || new Date().toISOString().slice(0, 10)
    });
  };

  const closeEditor = () => {
    setEditingRecord(null);
    setEditForm({});
  };

  const handleEditChange = (event) => {
    const { name, value } = event.target;
    setEditForm((current) => ({
      ...current,
      [name]: value,
      ...(name === "serviceType"
        ? {
          vtsNo: "",
          cctvDetails: "",
          cctvSerialNo: ""
        }
        : {})
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
          transaction_date: editForm.transaction_date,
          paymentDate: editForm.paymentDate || null,
          mobile1: editForm.mobile1,
          mobile2: editForm.mobile2,
          clientUserId: editForm.clientUserId,
          address: editForm.address,
          district: editForm.district,
          vehicleChassisNo: editForm.vehicleChassisNo,
          serviceType: editForm.serviceType,
          description: editForm.description,
          item: editForm.serviceType,
          model: editForm.model,
          imeiNo: editForm.imeiNo,
          imeiLastSix: editForm.imeiLastSix,
          vtsNo: editForm.vtsNo,
          technician: editForm.technician,
          reference: editForm.reference,
          quantity: Number(editForm.quantity) || 0,
          billAmount: Number(editForm.billAmount),
          receivedAmount: Number(editForm.receivedAmount),
          previousDuesReceived: Number(editForm.previousDuesReceived || 0),
          paymentMode: editForm.paymentMode,
          upiReferenceId: editForm.upiReferenceId,
          cashAmount: Number(editForm.cashAmount || 0),
          upiAmount: Number(editForm.upiAmount || 0),
          cctvDetails: editForm.serviceType === "CCTV Installation" ? editForm.cctvDetails : "",
          cctvSerialNo: editForm.serviceType === "CCTV Installation" ? editForm.cctvSerialNo : "",
          remarks: editForm.remarks || ""
        });
      } else {
          if (editingRecord.record._id) {
          // Update existing expense
          await api.put(`/expenses/${editingRecord.record._id}`, {
            category: editForm.category,
            amount: Number(editForm.amount) || 0,
            notes: editForm.notes
          });
        } else {
          // Create new expense
          await api.post("/expenses", {
            category: editForm.category,
            amount: Number(editForm.amount) || 0,
            notes: editForm.notes,
            date: editForm.date
          });
        }
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
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="button-secondary px-3 py-2 text-xs"
            onClick={() => openPasswordChange(row)}
          >
            Change Password
          </button>
          <button
            type="button"
            className="button-danger px-3 py-2 text-xs"
            onClick={() => handleDeleteUser(row.id)}
            disabled={deletingUserId === row.id}
          >
            {deletingUserId === row.id ? "Deleting..." : "Delete"}
          </button>
        </div>
      )
    }
  ];

  const summaryRows = (dashboard?.monthlySummary || []).map((item) => ({
    ...item,
    id: item.month
  }));
  const financialSummary = dashboard?.financialSummary || {};
  const financialSections = [
    {
      title: "Revenue",
      tone: "border-emerald-200 bg-emerald-50",
      heading: "text-emerald-800",
      rows: [
        ["Revenue till Yesterday", financialSummary.revenueTillYesterday],
        ["Today's Revenue", financialSummary.todayRevenue],
        ["Total Revenue (Current Period)", financialSummary.totalRevenue]
      ]
    },
    {
      title: "Received",
      tone: "border-yellow-200 bg-yellow-50",
      heading: "text-yellow-800",
      rows: [
        ["Total Received till Yesterday", financialSummary.receivedTillYesterday],
        ["Today's Received", financialSummary.todayReceived],
        ["Previous Dues Amount Received (+)", financialSummary.previousDuesReceived],
        ["Total Received (Current Period)", financialSummary.totalReceived]
      ]
    },
    {
      title: "Dues",
      tone: "border-red-200 bg-red-50",
      heading: "text-red-800",
      rows: [
        ["Total Dues till Yesterday", financialSummary.duesTillYesterday],
        ["Today's Dues", financialSummary.todayDues],
        ["Previous Dues Amount Received (-)", financialSummary.previousDuesReceived],
        ["Total Dues Till Date", financialSummary.totalDues]
      ]
    }
  ];

  const summaryColumns = [
    { key: "month", header: "Month", render: (row) => formatMonthLabel(row.month) },
    { key: "income", header: "Income", render: (row) => formatCurrency(row.income) },
    { key: "expense", header: "Expense", render: (row) => formatCurrency(row.expense) }
  ];

  const incomeColumns = [
    { key: "transaction_date", header: "Date", render: (row) => formatDate(row.transaction_date || row.createdAt) },
    { key: "cbNumber", header: "CDB No" },
    { key: "clientName", header: "Client Name" },
    { key: "mobile1", header: "Mobile 1" },
    { key: "vehicleChassisNo", header: "Vehicle / Chassis" },
    { key: "serviceType", header: "Service Type", render: (row) => row.serviceType || row.description },
    { key: "description", header: "Description" },
    { key: "cctvDetails", header: "CCTV Details / Model" },
    { key: "cctvSerialNo", header: "Serial No" },
    { key: "model", header: "Model" },
    { key: "imeiLastSix", header: "IMEI Last 6" },
    { key: "vtsNo", header: "VTS No" },
    { key: "technician", header: "Technician" },
    { key: "reference", header: "Reference (Given By)" },
    { key: "quantity", header: "Qty" },
    { key: "billAmount", header: "Bill Amount", render: (row) => formatCurrency(row.billAmount) },
    { key: "receivedAmount", header: "Received Amount", render: (row) => formatCurrency(row.receivedAmount) },
    { key: "previousDuesReceived", header: "Previous Dues Received", render: (row) => formatCurrency(row.previousDuesReceived) },
    { key: "dues", header: "Dues", render: (row) => formatCurrency(row.dues) },
    {
      key: "paymentMode",
      header: "Payment Mode",
      render: (row) => {
        if (row.paymentMode === "upi") return "UPI";
        if (row.paymentMode === "split") {
          return `Split (Cash ${formatCurrency(row.cashAmount)} + UPI ${formatCurrency(row.upiAmount)})`;
        }
        if (row.paymentMode === "cash") return "Cash";
        return row.paymentMode || "-";
      }
    },
    { key: "cashAmount", header: "Cash Amount", render: (row) => formatCurrency(row.cashAmount) },
    { key: "upiAmount", header: "UPI Amount", render: (row) => formatCurrency(row.upiAmount) },
    { key: "upiReferenceId", header: "UPI / UTR Ref" },
    { key: "bankPersonName", header: "Bank Person" },
    { key: "cashReceivedBy", header: "Cash Received By" },
    { key: "remarks", header: "Remarks" },
    {
      key: "user",
      header: "Executive",
      render: (row) => <span className="font-semibold text-ink">{row.userId?.username || "N/A"}</span>
    },
    {
      key: "actions",
      header: "Actions",
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="button-secondary px-3 py-2 text-xs" onClick={() => openEditor("income", row)}>
            Edit
          </button>
          <button
            type="button"
            className="button-primary px-3 py-2 text-xs"
            onClick={() => openUpdateDueModal(row.cbNumber, row.dues, row.clientName)}
          >
            Update Due
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
      header: "Executive",
      render: (row) => <span className="font-semibold text-ink">{row.userId?.username || "N/A"}</span>
    },
    {
      key: "actions",
      header: "Actions",
      render: (row) => (
        <div className="flex flex-wrap gap-2">
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
    <div className="space-y-5 sm:space-y-6">
      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <form className="panel p-4 sm:p-6" onSubmit={handleCreateUser}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">Arshi Enterprises - User Access</p>
              <h3 className="mt-2 text-xl font-bold text-ink sm:text-2xl">Create executive user</h3>
            </div>
            <button type="submit" className="button-primary w-full sm:w-auto" disabled={creatingUser}>
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
              <select className="field" name="role" value={createUserForm.role} onChange={handleCreateUserChange} required>
                <option value="executive">Executive</option>
                <option value="expense-only">Expense Only</option>
              </select>
            </div>
            
          </div>

          {createUserMessage ? (
            <div className="mt-4 rounded-2xl border border-line bg-[#fff7ed] px-4 py-3 text-sm text-muted">
              {createUserMessage}
            </div>
          ) : null}
        </form>

        
        <div className="panel p-4 sm:p-6">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">Arshi Enterprises - User Management</p>
              <h3 className="mt-2 text-xl font-bold text-ink sm:text-2xl">All Users</h3>
            </div>
            <p className="text-sm text-muted">{users.length} users</p>
          </div>
          <DataTable columns={userColumns} rows={users} emptyMessage="No users found." />
        </div>
      </section>

      {/* ========== DASHBOARD TABS ========== */}
      <div className="sticky top-0 z-30 -mx-4 border-b border-line bg-white px-4 py-3 sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap gap-2">
          {[
            { key: "records", label: "Records & Reports" },
            { key: "ledger", label: "Customer Ledger" },
            { key: "due", label: "Due Dashboard" },
            { key: "imei", label: "IMEI Tracking" }
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${activeTab === tab.key
                ? "bg-ink text-white"
                : "bg-slate-100 text-muted hover:bg-slate-200"
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "records" && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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

          <section className="grid gap-4 xl:grid-cols-3">
            {financialSections.map((section) => (
              <div key={section.title} className={`rounded-2xl border p-5 ${section.tone}`}>
                <h3 className={`text-lg font-bold ${section.heading}`}>{section.title}</h3>
                <div className="mt-4 space-y-3">
                  {section.rows.map(([label, value], index) => (
                    <div
                      key={label}
                      className={`flex items-center justify-between gap-4 rounded-xl bg-white/75 px-4 py-3 ${index === section.rows.length - 1 ? "font-bold" : "font-semibold"
                        }`}
                    >
                      <span className="text-sm text-ink">{label}</span>
                      <span className="text-right text-sm">{formatCurrency(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>

          <section className="panel p-4 sm:p-6">
            <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">History</p>
                <h3 className="mt-2 text-xl font-bold text-ink sm:text-2xl">Previous year records</h3>
                <p className="mt-2 text-sm text-muted">Switch between 1 year and 2 years of month-wise admin data.</p>
              </div>
              <div className="w-full lg:max-w-xs">
                <label className="label">History Window</label>
                <select className="field" value={historyMonths} onChange={(event) => setHistoryMonths(event.target.value)}>
                  <option value="12">Last 12 months</option>
                  <option value="24">Last 24 months</option>
                </select>
              </div>
            </div>
            <DataTable
              columns={summaryColumns}
              rows={summaryRows}
              emptyMessage={dashboardLoading ? "Loading monthly summary..." : "No monthly summary found."}
            />
          </section>

          <section className="panel p-4 sm:p-6">
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">Date-wise Breakdown</p>
                <h3 className="mt-2 text-xl font-bold text-ink sm:text-2xl">
                  {dashboard?.selectedMonth ? formatMonthLabel(dashboard.selectedMonth) : "Selected month"}
                </h3>
              </div>
              <div className="text-sm text-muted">
                Entries: <span className="font-semibold text-ink">{(dashboard?.dateWiseBreakdown || []).reduce((sum, row) => sum + (row.entries || 0), 0)}</span>
                {" "} | Amount: <span className="font-semibold text-ink">{formatCurrency((dashboard?.dateWiseBreakdown || []).reduce((sum, row) => sum + (row.totalAmount || 0), 0))}</span>
              </div>
            </div>
            <DataTable
              columns={[
                { key: "date", header: "Date", render: (row) => formatDate(row.date) },
                { key: "entries", header: "Total Entries" },
                { key: "totalBill", header: "Bill Amount", render: (row) => formatCurrency(row.totalBill) },
                { key: "totalAmount", header: "Received Amount", render: (row) => formatCurrency(row.totalAmount) },
                { key: "previousDuesReceived", header: "Previous Dues Received", render: (row) => formatCurrency(row.previousDuesReceived) },
                { key: "totalDues", header: "Dues", render: (row) => formatCurrency(row.totalDues) }
              ]}
              rows={dashboard?.dateWiseBreakdown || []}
              emptyMessage={dashboardLoading ? "Loading date-wise report..." : "No records for selected month."}
            />
          </section>

          <section className="panel p-4 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">Filters</p>
                <h3 className="mt-2 text-xl font-bold text-ink sm:text-2xl">Refine records</h3>
              </div>
              <div className="rounded-2xl border border-line bg-slate-50 px-4 py-3 text-sm text-muted lg:shrink-0">
                Incomes: <span className="font-semibold text-ink">{incomes.length}</span> | Expenses:{" "}
                <span className="font-semibold text-ink">{expenses.length}</span>
              </div>
            </div>

            <form className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-[1.2fr_1fr_1fr_1fr_1fr_1fr_auto_auto]" onSubmit={handleApplyFilters}>
              <div>
                <label className="label">User</label>
                <select className="field" name="userId" value={filters.userId} onChange={handleFilterChange}>
                  <option value="">All executives</option>
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
                <label className="label">Month</label>
                <input
                  className="field"
                  name="month"
                  type="month"
                  value={filters.month}
                  onChange={handleFilterChange}
                />
              </div>
              <div>
                <label className="label">Service Type</label>
                <select className="field" name="serviceType" value={filters.serviceType} onChange={handleFilterChange}>
                  <option value="">All services</option>
                  <option value="GPS Installation">GPS Installation</option>
                  <option value="VLTD Installation">VLTD Installation</option>
                  <option value="GPS Renewal">GPS Renewal</option>
                  <option value="VLTD Renewal">VLTD Renewal</option>
                  <option value="CCTV Installation">CCTV Installation</option>
                  <option value="Renewal with Service">Renewal with Service</option>
                  <option value="Replacement and Service">Replacement and Service</option>
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
                />
              </div>
              <button type="submit" className="button-primary w-full self-end xl:w-auto">
                Apply
              </button>
              <button type="button" className="button-secondary w-full self-end xl:w-auto" onClick={handleClearFilters}>
                Clear
              </button>
            </form>

            <div className="mt-6 rounded-2xl border border-line bg-slate-50 p-4">
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">Executive Monthly Report</p>
                  <h4 className="mt-1 break-words text-base font-bold text-ink sm:text-lg">
                    {filters.userId
                      ? `Download monthly data for ${users.find((u) => u.id === filters.userId)?.username || "selected executive"}`
                      : "Select an executive above to download their monthly data"}
                  </h4>
                </div>
              </div>
              <div className="grid gap-2 sm:flex sm:flex-wrap">
                <button
                  type="button"
                  className="button-secondary text-sm"
                  disabled={!filters.userId || Boolean(exporting)}
                  onClick={() => handleExport("executive-income-monthly-excel")}
                >
                  {exporting === "executive-income-monthly-excel" ? "Exporting..." : "📊 Income Excel"}
                </button>
                <button
                  type="button"
                  className="button-secondary text-sm"
                  disabled={!filters.userId || Boolean(exporting)}
                  onClick={() => handleExport("executive-expense-monthly-excel")}
                >
                  {exporting === "executive-expense-monthly-excel" ? "Exporting..." : "📊 Expense Excel"}
                </button>
              </div>
              {!filters.userId ? (
                <p className="mt-3 text-xs text-muted">Tip: Pick an executive in the User dropdown above and click Apply, then download.</p>
              ) : null}
            </div>
          </section>

          <section className="panel p-4 sm:p-6">
            <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">Income Ledger</p>
                <h3 className="mt-2 text-xl font-bold text-ink sm:text-2xl">All income records</h3>
              </div>
              {recordsLoading ? <p className="text-sm text-muted">Refreshing...</p> : null}
            </div>
            <DataTable
              columns={incomeColumns}
              rows={incomes}
              emptyMessage={recordsLoading ? "Loading income records..." : "No income records for the selected filters."}
            />
          </section>

          <section className="panel p-4 sm:p-6">
            <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">Expense Ledger</p>
                <h3 className="mt-2 text-xl font-bold text-ink sm:text-2xl">All expense records</h3>
              </div>
              <div className="flex items-center gap-2">
                {recordsLoading ? <p className="text-sm text-muted">Refreshing...</p> : null}
                <button
                  type="button"
                  className="button-primary text-sm"
                  onClick={() => openEditor("expense", { _id: null, category: "petrol", amount: "", notes: "", date: new Date().toISOString().slice(0, 10) })}
                >
                  + Add Expense
                </button>
              </div>
            </div>
            <DataTable
              columns={expenseColumns}
              rows={expenses}
              emptyMessage={recordsLoading ? "Loading expense records..." : "No expense records for the selected filters."}
            />
          </section>

          <section className="panel p-4 sm:p-6">
            <div className="mb-5">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">Report Builder</p>
              <h3 className="mt-2 text-xl font-bold text-ink sm:text-2xl">Generate Period Reports</h3>
              <p className="mt-2 text-sm text-muted">Download comprehensive reports for different time periods.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {/* DAILY REPORTS */}
              <div className="rounded-xl border border-line bg-slate-50 p-4">
                <h4 className="mb-3 font-bold text-ink">Daily Reports</h4>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    className="button-secondary w-full text-sm"
                    onClick={() => handleExport("income-daily-excel")}
                    disabled={Boolean(exporting)}
                  >
                    {exporting === "income-daily-excel" ? "Exporting..." : "📊 Income Excel"}
                  </button>
                  <button
                    type="button"
                    className="button-secondary w-full text-sm"
                    onClick={() => handleExport("expense-daily-excel")}
                    disabled={Boolean(exporting)}
                  >
                    {exporting === "expense-daily-excel" ? "Exporting..." : "📊 Expense Excel"}
                  </button>
                  <button
                    type="button"
                    className="button-secondary w-full text-sm"
                    onClick={() => handleExport("ledger-daily-excel")}
                    disabled={Boolean(exporting)}
                  >
                    {exporting === "ledger-daily-excel" ? "Exporting..." : "📒 Ledger (Tx + Summary)"}
                  </button>
                </div>
              </div>

              {/* WEEKLY REPORTS */}
              <div className="rounded-xl border border-line bg-slate-50 p-4">
                <h4 className="mb-3 font-bold text-ink">Weekly Reports</h4>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    className="button-secondary w-full text-sm"
                    onClick={() => handleExport("income-weekly-excel")}
                    disabled={Boolean(exporting)}
                  >
                    {exporting === "income-weekly-excel" ? "Exporting..." : "📊 Income Excel"}
                  </button>
                  <button
                    type="button"
                    className="button-secondary w-full text-sm"
                    onClick={() => handleExport("expense-weekly-excel")}
                    disabled={Boolean(exporting)}
                  >
                    {exporting === "expense-weekly-excel" ? "Exporting..." : "📊 Expense Excel"}
                  </button>
                  <button
                    type="button"
                    className="button-secondary w-full text-sm"
                    onClick={() => handleExport("ledger-weekly-excel")}
                    disabled={Boolean(exporting)}
                  >
                    {exporting === "ledger-weekly-excel" ? "Exporting..." : "📒 Ledger (Tx + Summary)"}
                  </button>
                </div>
              </div>

              {/* MONTHLY REPORTS */}
              <div className="rounded-xl border border-line bg-slate-50 p-4">
                <h4 className="mb-3 font-bold text-ink">Monthly Reports</h4>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    className="button-secondary w-full text-sm"
                    onClick={() => handleExport("income-monthly-excel")}
                    disabled={Boolean(exporting)}
                  >
                    {exporting === "income-monthly-excel" ? "Exporting..." : "📊 Income Excel"}
                  </button>
                  <button
                    type="button"
                    className="button-secondary w-full text-sm"
                    onClick={() => handleExport("expense-monthly-excel")}
                    disabled={Boolean(exporting)}
                  >
                    {exporting === "expense-monthly-excel" ? "Exporting..." : "📊 Expense Excel"}
                  </button>
                  <button
                    type="button"
                    className="button-secondary w-full text-sm"
                    onClick={() => handleExport("ledger-monthly-excel")}
                    disabled={Boolean(exporting)}
                  >
                    {exporting === "ledger-monthly-excel" ? "Exporting..." : "📒 Ledger (Tx + Summary)"}
                  </button>
                </div>
              </div>

              {/* YEARLY REPORTS */}
              <div className="rounded-xl border border-line bg-slate-50 p-4">
                <h4 className="mb-3 font-bold text-ink">Yearly Reports</h4>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    className="button-secondary w-full text-sm"
                    onClick={() => handleExport("income-yearly-excel")}
                    disabled={Boolean(exporting)}
                  >
                    {exporting === "income-yearly-excel" ? "Exporting..." : "📊 Income Excel"}
                  </button>
                  <button
                    type="button"
                    className="button-secondary w-full text-sm"
                    onClick={() => handleExport("expense-yearly-excel")}
                    disabled={Boolean(exporting)}
                  >
                    {exporting === "expense-yearly-excel" ? "Exporting..." : "📊 Expense Excel"}
                  </button>
                  <button
                    type="button"
                    className="button-secondary w-full text-sm"
                    onClick={() => handleExport("ledger-yearly-excel")}
                    disabled={Boolean(exporting)}
                  >
                    {exporting === "ledger-yearly-excel" ? "Exporting..." : "📒 Ledger (Tx + Summary)"}
                  </button>
                </div>
              </div>

              {/* ALL REPORTS */}
              <div className="rounded-xl border border-line bg-slate-50 p-4">
                <h4 className="mb-3 font-bold text-ink">Complete History</h4>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    className="button-secondary w-full text-sm"
                    onClick={() => handleExport("income-all-excel")}
                    disabled={Boolean(exporting)}
                  >
                    {exporting === "income-all-excel" ? "Exporting..." : "📊 All Income Excel"}
                  </button>
                  <button
                    type="button"
                    className="button-secondary w-full text-sm"
                    onClick={() => handleExport("expense-all-excel")}
                    disabled={Boolean(exporting)}
                  >
                    {exporting === "expense-all-excel" ? "Exporting..." : "📊 All Expense Excel"}
                  </button>
                  <button
                    type="button"
                    className="button-secondary w-full text-sm"
                    onClick={() => handleExport("ledger-all-excel")}
                    disabled={Boolean(exporting)}
                  >
                    {exporting === "ledger-all-excel" ? "Exporting..." : "📒 All Ledger (Tx + Summary)"}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {/* ========== CUSTOMER LEDGER TAB ========== */}
      {activeTab === "ledger" && (
        <section className="panel p-4 sm:p-6">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">Customer Ledger</p>
              <h3 className="mt-2 text-xl font-bold text-ink sm:text-2xl">Transaction History by CDB ID</h3>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                className="field w-full sm:w-48"
                placeholder="Enter CDB ID"
                value={ledgerCdbId}
                onChange={(e) => setLedgerCdbId(e.target.value)}
              />
              <button
                type="button"
                className="button-primary text-sm"
                onClick={() => loadLedger(ledgerCdbId)}
                disabled={!ledgerCdbId || ledgerLoading}
              >
                {ledgerLoading ? "Loading..." : "Load Ledger"}
              </button>
              <button
                type="button"
                className="button-secondary text-sm"
                onClick={() => handleExport("customer-ledger-excel")}
                disabled={!ledgerData || Boolean(exporting)}
              >
                {exporting === "customer-ledger-excel" ? "Exporting..." : "📊 Export Excel"}
              </button>
            </div>
          </div>

          {ledgerData ? (
            <>
              <div className="mb-4 grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-line bg-slate-50 p-4">
                  <p className="text-xs text-muted">Total Bill</p>
                  <p className="mt-1 text-xl font-bold text-ink">{formatCurrency(ledgerData.totalBill)}</p>
                </div>
                <div className="rounded-xl border border-line bg-slate-50 p-4">
                  <p className="text-xs text-muted">Total Payment</p>
                  <p className="mt-1 text-xl font-bold text-ink">{formatCurrency(ledgerData.totalPayment)}</p>
                </div>
                <div className="rounded-xl border border-line bg-slate-50 p-4">
                  <p className="text-xs text-muted">Due</p>
                  <p className={`mt-1 text-xl font-bold ${ledgerData.due > 0 ? "text-red-600" : "text-green-600"}`}>
                    {formatCurrency(ledgerData.due)}
                  </p>
                </div>
              </div>
              <DataTable
                columns={[
                  { key: "date", header: "Date", render: (row) => formatDate(row.date) },
                  {
                    key: "type", header: "Type", render: (row) => (
                      <span className={`font-semibold ${row.type === "BILL" ? "text-amber-600" : "text-green-600"}`}>
                        {row.type}
                      </span>
                    )
                  },
                  { key: "amount", header: "Amount", render: (row) => formatCurrency(row.amount) },
                  { key: "paymentMode", header: "Payment Mode" },
                  { key: "paymentDate", header: "Payment Date", render: (row) => row.paymentDate ? formatDate(row.paymentDate) : "-" },
                  { key: "description", header: "Description" },
                  { key: "user", header: "Staff" }
                ]}
                rows={ledgerData.transactions || []}
                emptyMessage="No transactions found for this CDB ID."
              />
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  className="button-primary"
                  onClick={() => openUpdateDueModal(ledgerCdbId, ledgerData.due, ledgerData.customerName || "Customer")}
                  disabled={!ledgerData}
                >
                  Update Due
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">Enter a CDB ID and click Load Ledger to view transactions.</p>
          )}
        </section>
      )}

      {/* ========== DUE DASHBOARD TAB ========== */}
      {activeTab === "due" && (
        <section className="panel p-4 sm:p-6">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">Due Dashboard</p>
              <h3 className="mt-2 text-xl font-bold text-ink sm:text-2xl">Customer Due Summary</h3>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="button-primary text-sm"
                onClick={loadDueSummary}
                disabled={dueSummaryLoading}
              >
                {dueSummaryLoading ? "Loading..." : "Refresh"}
              </button>
              <button
                type="button"
                className="button-secondary text-sm"
                onClick={() => handleExport("due-summary-excel")}
                disabled={!dueSummaryData || Boolean(exporting)}
              >
                {exporting === "due-summary-excel" ? "Exporting..." : "📊 Export Excel"}
              </button>
            </div>
          </div>

          {/* VEHICLE/CHASSIS SEARCH */}
          <div className="mb-6 rounded-xl border border-line bg-slate-50 p-4">
            <h4 className="mb-3 font-bold text-ink">Search by Vehicle/Chassis Number</h4>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                className="field w-full sm:flex-1"
                placeholder="Enter vehicle or chassis number..."
                value={vehicleSearch}
                onChange={(e) => setVehicleSearch(e.target.value)}
              />
              <button
                type="button"
                className="button-primary text-sm"
                onClick={() => searchByVehicleNumber(vehicleSearch)}
                disabled={!vehicleSearch || vehicleSearchLoading}
              >
                {vehicleSearchLoading ? "Searching..." : "Search"}
              </button>
              {vehicleSearchResults && (
                <button
                  type="button"
                  className="button-secondary text-sm"
                  onClick={() => {
                    setVehicleSearch("");
                    setVehicleSearchResults(null);
                  }}
                >
                  Clear Search
                </button>
              )}
            </div>
          </div>

          {/* DISPLAY RESULTS */}
          {vehicleSearchResults ? (
            <>
              <div className="mb-4">
                <p className="mb-2 text-sm text-muted">
                  Search results for: <span className="font-semibold text-ink">"{vehicleSearchResults.searchTerm}"</span>
                </p>
              </div>
              <div className="mb-4 grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-line bg-slate-50 p-4">
                  <p className="text-xs text-muted">Grand Total Bill</p>
                  <p className="mt-1 text-xl font-bold text-ink">{formatCurrency(vehicleSearchResults.totals?.grandTotalBill)}</p>
                </div>
                <div className="rounded-xl border border-line bg-slate-50 p-4">
                  <p className="text-xs text-muted">Grand Total Paid</p>
                  <p className="mt-1 text-xl font-bold text-ink">{formatCurrency(vehicleSearchResults.totals?.grandTotalPaid)}</p>
                </div>
                <div className="rounded-xl border border-line bg-slate-50 p-4">
                  <p className="text-xs text-muted">Grand Total Due</p>
                  <p className={`mt-1 text-xl font-bold ${vehicleSearchResults.totals?.grandTotalDue > 0 ? "text-red-600" : "text-green-600"}`}>
                    {formatCurrency(vehicleSearchResults.totals?.grandTotalDue)}
                  </p>
                </div>
              </div>
              <DataTable
                columns={[
                  { key: "cdbId", header: "CDB ID" },
                  { key: "clientName", header: "Customer" },
                  { key: "vehicleChassisNo", header: "Vehicle / Chassis" },
                  { key: "totalBill", header: "Total Bill", render: (row) => formatCurrency(row.totalBill) },
                  { key: "totalPaid", header: "Total Paid", render: (row) => formatCurrency(row.totalPaid) },
                  {
                    key: "totalDue", header: "Due", render: (row) => (
                      <span className={row.totalDue > 0 ? "font-semibold text-red-600" : "font-semibold text-green-600"}>
                        {formatCurrency(row.totalDue)}
                      </span>
                    )
                  },
                  {
                    key: "actions",
                    header: "Actions",
                    render: (row) => (
                      <button
                        type="button"
                        className="button-primary px-3 py-2 text-xs"
                        onClick={() => openUpdateDueModal(row.cdbId, row.totalDue, row.clientName)}
                      >
                        Update Due
                      </button>
                    )
                  }
                ]}
                rows={vehicleSearchResults.customers || []}
                emptyMessage="No customers found for this vehicle number."
              />
            </>
          ) : dueSummaryData ? (
            <>
              <div className="mb-4 grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-line bg-slate-50 p-4">
                  <p className="text-xs text-muted">Grand Total Bill</p>
                  <p className="mt-1 text-xl font-bold text-ink">{formatCurrency(dueSummaryData.totals?.grandTotalBill)}</p>
                </div>
                <div className="rounded-xl border border-line bg-slate-50 p-4">
                  <p className="text-xs text-muted">Grand Total Paid</p>
                  <p className="mt-1 text-xl font-bold text-ink">{formatCurrency(dueSummaryData.totals?.grandTotalPaid)}</p>
                </div>
                <div className="rounded-xl border border-line bg-slate-50 p-4">
                  <p className="text-xs text-muted">Grand Total Due</p>
                  <p className={`mt-1 text-xl font-bold ${dueSummaryData.totals?.grandTotalDue > 0 ? "text-red-600" : "text-green-600"}`}>
                    {formatCurrency(dueSummaryData.totals?.grandTotalDue)}
                  </p>
                </div>
              </div>
              <DataTable
                columns={[
                  { key: "cdbId", header: "CDB ID" },
                  { key: "clientName", header: "Customer" },
                  { key: "totalBill", header: "Total Bill", render: (row) => formatCurrency(row.totalBill) },
                  { key: "totalPaid", header: "Total Paid", render: (row) => formatCurrency(row.totalPaid) },
                  {
                    key: "totalDue", header: "Due", render: (row) => (
                      <span className={row.totalDue > 0 ? "font-semibold text-red-600" : "font-semibold text-green-600"}>
                        {formatCurrency(row.totalDue)}
                      </span>
                    )
                  },
                  {
                    key: "actions",
                    header: "Actions",
                    render: (row) => (
                      <button
                        type="button"
                        className="button-primary px-3 py-2 text-xs"
                        onClick={() => openUpdateDueModal(row.cdbId, row.totalDue, row.clientName)}
                      >
                        Update Due
                      </button>
                    )
                  }
                ]}
                rows={dueSummaryData.customers || []}
                emptyMessage="No due data available."
              />
            </>
          ) : (
            <p className="text-sm text-muted">Click Refresh to load the due summary.</p>
          )}
        </section>
      )}

      {/* ========== IMEI TRACKING TAB ========== */}
      {activeTab === "imei" && (
        <section className="panel p-4 sm:p-6">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">IMEI / Serial Tracking</p>
              <h3 className="mt-2 text-xl font-bold text-ink sm:text-2xl">Item-Level Tracking</h3>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                className="field w-full sm:w-64"
                placeholder="Search IMEI, Serial, CDB ID or Item..."
                value={imeiSearch}
                onChange={(e) => setImeiSearch(e.target.value)}
              />
              <button
                type="button"
                className="button-primary text-sm"
                onClick={() => loadImeiTracking(imeiSearch)}
                disabled={imeiLoading}
              >
                {imeiLoading ? "Searching..." : "Search"}
              </button>
              <button
                type="button"
                className="button-secondary text-sm"
                onClick={() => handleExport("imei-tracking-excel")}
                disabled={imeiData.length === 0 || Boolean(exporting)}
              >
                {exporting === "imei-tracking-excel" ? "Exporting..." : "📊 Export Excel"}
              </button>
            </div>
          </div>

          <DataTable
            columns={[
              { key: "date", header: "Date", render: (row) => formatDate(row.date) },
              { key: "cdbId", header: "CDB ID" },
              { key: "clientName", header: "Customer" },
              { key: "itemName", header: "Item" },
              { key: "imeiSerial", header: "IMEI / Serial" },
              { key: "price", header: "Price", render: (row) => formatCurrency(row.price) },
              { key: "paidAmount", header: "Paid", render: (row) => formatCurrency(row.paidAmount) },
              {
                key: "dueAmount", header: "Due", render: (row) => (
                  <span className={row.dueAmount > 0 ? "font-semibold text-red-600" : "font-semibold text-green-600"}>
                    {formatCurrency(row.dueAmount)}
                  </span>
                )
              },
              {
                key: "status", header: "Status", render: (row) => (
                  <span className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${row.status === "PAID" ? "bg-green-100 text-green-700" :
                    row.status === "PARTIAL" ? "bg-yellow-100 text-yellow-700" :
                      "bg-red-100 text-red-700"
                    }`}>
                    {row.status}
                  </span>
                )
              },
              {
                key: "actions",
                header: "Actions",
                render: (row) => (
                  <button
                    type="button"
                    className="button-primary px-3 py-2 text-xs"
                    onClick={() => openUpdateDueModal(row.cdbId, row.dueAmount, row.clientName)}
                  >
                    Update Due
                  </button>
                )
              }
            ]}
            rows={imeiData}
            emptyMessage={imeiLoading ? "Searching..." : "No items found. Enter a search term and click Search."}
          />
        </section>
      )}

      {editingRecord ? (
        <RecordModal
          title={editingRecord.type === "income" ? "Edit income record" : "Edit expense record"}
          onClose={closeEditor}
        >
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSaveEdit}>
            {editingRecord.type === "income" ? (
              <>
                <div>
                  <label className="label">Transaction Date</label>
                  <input
                    className="field"
                    name="transaction_date"
                    type="date"
                    value={editForm.transaction_date || ""}
                    onChange={handleEditChange}
                    required
                  />
                </div>
                <div>
                  <label className="label">Payment Date</label>
                  <input
                    className="field"
                    name="paymentDate"
                    type="date"
                    value={editForm.paymentDate || ""}
                    onChange={handleEditChange}
                  />
                </div>
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
                  <label className="label">CDB No</label>
                  <input
                    className="field"
                    name="cbNumber"
                    value={editForm.cbNumber || ""}
                    onChange={handleEditChange}
                    required
                  />
                </div>
                <div>
                  <label className="label">Mobile No 1</label>
                  <input
                    className="field"
                    name="mobile1"
                    value={editForm.mobile1 || ""}
                    onChange={handleEditChange}
                  />
                </div>
                <div>
                  <label className="label">Mobile No 2</label>
                  <input
                    className="field"
                    name="mobile2"
                    value={editForm.mobile2 || ""}
                    onChange={handleEditChange}
                  />
                </div>
                <div>
                  <label className="label">User ID</label>
                  <input
                    className="field"
                    name="clientUserId"
                    value={editForm.clientUserId || ""}
                    onChange={handleEditChange}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="label">Address</label>
                  <input
                    className="field"
                    name="address"
                    value={editForm.address || ""}
                    onChange={handleEditChange}
                  />
                </div>
                <div>
                  <label className="label">District</label>
                  <input
                    className="field"
                    name="district"
                    value={editForm.district || ""}
                    onChange={handleEditChange}
                  />
                </div>
                <div>
                  <label className="label">Vehicle / Chassis No</label>
                  <input
                    className="field"
                    name="vehicleChassisNo"
                    value={editForm.vehicleChassisNo || ""}
                    onChange={handleEditChange}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="label">Service Type</label>
                  <select
                    className="field"
                    name="serviceType"
                    value={editForm.serviceType || ""}
                    onChange={handleEditChange}
                    required
                  >
                    <option value="">Select...</option>
                    <option value="GPS Installation">GPS Installation</option>
                    <option value="VLTD Installation">VLTD Installation</option>
                    <option value="GPS Renewal">GPS Renewal</option>
                    <option value="VLTD Renewal">VLTD Renewal</option>
                    <option value="CCTV Installation">CCTV Installation</option>
                    <option value="Renewal with Service">Renewal with Service</option>
                    <option value="Replacement and Service">Replacement and Service</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="label">Description</label>
                  <input
                    className="field"
                    name="description"
                    value={editForm.description || ""}
                    onChange={handleEditChange}
                    placeholder="Enter description manually (optional)"
                  />
                </div>
                {editForm.serviceType === "CCTV Installation" ? (
                  <>
                    <div>
                      <label className="label">CCTV Details / Model</label>
                      <input className="field" name="cctvDetails" value={editForm.cctvDetails || ""} onChange={handleEditChange} required />
                    </div>
                    <div>
                      <label className="label">Serial No</label>
                      <input className="field" name="cctvSerialNo" value={editForm.cctvSerialNo || ""} onChange={handleEditChange} />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="label">Model</label>
                      <input className="field" name="model" value={editForm.model || ""} onChange={handleEditChange} />
                    </div>
                    <div>
                      <label className="label">IMEI No</label>
                      <input className="field" name="imeiNo" value={editForm.imeiNo || ""} onChange={handleEditChange} />
                    </div>
                    <div>
                      <label className="label">IMEI Last 6</label>
                      <input className="field" name="imeiLastSix" value={editForm.imeiLastSix || ""} onChange={handleEditChange} />
                    </div>
                    <div>
                      <label className="label">VTS No</label>
                      <input className="field" name="vtsNo" value={editForm.vtsNo || ""} onChange={handleEditChange} />
                    </div>
                  </>
                )}
                <div>
                  <label className="label">Technician</label>
                  <input
                    className="field"
                    name="technician"
                    value={editForm.technician || ""}
                    onChange={handleEditChange}
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
                  <label className="label">Previous Dues Received</label>
                  <input
                    className="field"
                    name="previousDuesReceived"
                    type="number"
                    min="0"
                    step="0.01"
                    value={editForm.previousDuesReceived || ""}
                    onChange={handleEditChange}
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
                    <option value="split">Split</option>
                  </select>
                </div>
                {editForm.paymentMode === "split" && (
                  <>
                    <div>
                      <label className="label">Cash Amount</label>
                      <input
                        className="field"
                        name="cashAmount"
                        type="number"
                        min="0"
                        step="0.01"
                        value={editForm.cashAmount || ""}
                        onChange={handleEditChange}
                      />
                    </div>
                    <div>
                      <label className="label">UPI Amount</label>
                      <input
                        className="field"
                        name="upiAmount"
                        type="number"
                        min="0"
                        step="0.01"
                        value={editForm.upiAmount || ""}
                        onChange={handleEditChange}
                      />
                    </div>
                  </>
                )}
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
                <div className="md:col-span-2">
                  <label className="label">Remarks</label>
                  <textarea
                    className="field min-h-20"
                    name="remarks"
                    value={editForm.remarks || ""}
                    onChange={handleEditChange}
                    placeholder="Additional notes or remarks"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="label">Date</label>
                  <input
                    className="field"
                    name="date"
                    type="date"
                    value={editForm.date || new Date().toISOString().slice(0, 10)}
                    onChange={handleEditChange}
                    required
                  />
                </div>
                <div>
                  <label className="label">Category</label>
                  <select
                    className="field"
                    name="category"
                    value={editForm.category || "petrol"}
                    onChange={handleEditChange}
                  >
                    <option value="petrol">Petrol &amp; Other Conveyance</option>
                    <option value="food">Food</option>
                    <option value="material">Material Purchase</option>
                    <option value="misc">Miscellaneous (Hotel &amp; Other)</option>
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

            <div className="flex flex-col-reverse gap-3 pt-2 md:col-span-2 sm:flex-row sm:justify-end">
              <button type="button" className="button-secondary w-full sm:w-auto" onClick={closeEditor}>
                Cancel
              </button>
              <button type="submit" className="button-primary w-full sm:w-auto" disabled={saving}>
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
        </RecordModal>
      ) : null}

      {passwordChangeUser ? (
        <RecordModal
          title={`Change password for ${passwordChangeUser.username}`}
          onClose={closePasswordChange}
        >
          <form className="grid gap-4" onSubmit={handleChangePassword}>
            <div>
              <label className="label">New Password</label>
              <input
                className="field"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 6 chars)"
                required
                minLength={6}
              />
            </div>

            {passwordChangeMessage ? (
              <div
                className={`rounded-2xl border px-4 py-3 text-sm ${passwordChangeMessage.includes("success")
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-red-200 bg-red-50 text-red-700"
                  }`}
              >
                {passwordChangeMessage}
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
              <button type="button" className="button-secondary w-full sm:w-auto" onClick={closePasswordChange}>
                Cancel
              </button>
              <button type="submit" className="button-primary w-full sm:w-auto" disabled={changingPassword}>
                {changingPassword ? "Updating..." : "Update Password"}
              </button>
            </div>
          </form>
        </RecordModal>
      ) : null}

      {updateDueModal.open ? (
        <RecordModal title={`Payment Entry - ${updateDueModal.customerName}`} onClose={closeUpdateDueModal}>
          {loadingCustomerDetails ? (
            <div className="text-center py-8">
              <p className="text-muted">Loading customer details...</p>
            </div>
          ) : (
            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleUpdateDue}>
              {/* Existing Fields (Readonly) */}
              <div>
                <label className="label">CDB ID</label>
                <input className="field bg-slate-50" value={updateDueModal.cdbId} readOnly disabled />
              </div>
              <div>
                <label className="label">Customer Name</label>
                <input className="field bg-slate-50" value={updateDueModal.customerName} readOnly disabled />
              </div>
              <div>
                <label className="label">Current Due</label>
                <input className="field bg-slate-50" value={formatCurrency(updateDueModal.currentDue)} readOnly disabled />
              </div>

              {/* New Fields */}
              <div>
                <label className="label">Payment Date *</label>
                <input
                  className="field"
                  type="date"
                  name="paymentDate"
                  value={paymentForm.paymentDate}
                  onChange={handlePaymentFormChange}
                  required
                />
              </div>
              <div>
                <label className="label">Payment Amount *</label>
                <input
                  className="field"
                  type="number"
                  name="paymentAmount"
                  min="0"
                  step="0.01"
                  value={paymentForm.paymentAmount}
                  onChange={handlePaymentFormChange}
                  required
                />
              </div>
              <div>
                <label className="label">Payment Mode *</label>
                <select
                  className="field"
                  name="paymentMode"
                  value={paymentForm.paymentMode}
                  onChange={handlePaymentFormChange}
                  required
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="bank">Bank Transfer</option>
                </select>
              </div>
              <div>
                <label className="label">Reference Number {(paymentForm.paymentMode === "upi" || paymentForm.paymentMode === "bank") ? "*" : "(Optional)"}</label>
                <input
                  className="field"
                  name="referenceNumber"
                  value={paymentForm.referenceNumber}
                  onChange={handlePaymentFormChange}
                  required={paymentForm.paymentMode === "upi" || paymentForm.paymentMode === "bank"}
                />
              </div>
              <div>
                <label className="label">IMEI Number</label>
                <input
                  className="field"
                  name="imeiNumber"
                  value={paymentForm.imeiNumber}
                  onChange={handlePaymentFormChange}
                  placeholder="Auto-fetched from database"
                />
              </div>
              <div>
                <label className="label">Vehicle Number</label>
                <input
                  className="field"
                  name="vehicleNumber"
                  value={paymentForm.vehicleNumber}
                  onChange={handlePaymentFormChange}
                  placeholder="Auto-fetched from database"
                />
              </div>
              <div>
                <label className="label">Chassis Number</label>
                <input
                  className="field"
                  name="chassisNumber"
                  value={paymentForm.chassisNumber}
                  onChange={handlePaymentFormChange}
                  placeholder="Auto-fetched from database"
                />
              </div>

              {/* Summary Section */}
              <div className="md:col-span-2 rounded-xl border border-line bg-slate-50 p-4">
                <p className="text-sm font-semibold text-ink">Payment Summary</p>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Current Due:</span>
                    <span className="font-semibold">{formatCurrency(updateDueModal.currentDue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Payment Amount:</span>
                    <span className="font-semibold">{formatCurrency(Number(paymentForm.paymentAmount) || 0)}</span>
                  </div>
                  <div className="flex justify-between border-t border-line pt-2">
                    <span className="font-semibold">New Due:</span>
                    <span className={`font-bold ${calculatedNewDue === 0 ? "text-green-600" : calculatedNewDue > 0 ? "text-amber-600" : "text-red-600"}`}>
                      {formatCurrency(calculatedNewDue)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  className="button-secondary w-full sm:w-auto"
                  onClick={closeUpdateDueModal}
                >
                  Cancel
                </button>
                <button type="submit" className="button-primary w-full sm:w-auto" disabled={updatingDue}>
                  {updatingDue ? "Processing..." : "Record Payment"}
                </button>
              </div>
            </form>
          )}
        </RecordModal>
      ) : null}
    </div>
  );
};

export default AdminPanelPage;
