import api from "../api";

const saveBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

const getFilenameFromResponse = (response, fallback) => {
  const disposition = response.headers.get("content-disposition");

  if (!disposition) {
    return fallback;
  }

  const match = disposition.match(/filename="(.+?)"/i);
  return match?.[1] || fallback;
};

const buildQueryString = (params) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      searchParams.append(key, value);
    }
  });
  const query = searchParams.toString();
  return query ? `?${query}` : "";
};

// INCOME EXCEL REPORTS
export const downloadIncomeExcelReport = async (period = "monthly", options = {}) => {
  let path = "reports/income/excel";
  let filename = "income-report.xlsx";

  if (period === "daily") {
    path = "reports/income/daily/excel";
    filename = "income-daily.xlsx";
  } else if (period === "weekly") {
    path = "reports/income/weekly/excel";
    filename = "income-weekly.xlsx";
  } else if (period === "monthly") {
    path = "reports/income/monthly/excel";
    filename = "income-monthly.xlsx";
  } else if (period === "yearly") {
    path = "reports/income/yearly/excel";
    filename = "income-yearly.xlsx";
  } else if (period === "all") {
    path = "reports/income/all/excel";
    filename = "income-all.xlsx";
  }

  path += buildQueryString({
    userId: options.userId,
    month: options.month,
    serviceType: options.serviceType
  });

  const response = await api.get(path, { responseType: "blob" });
  const blob = response.data;
  const disposition = response.headers["content-disposition"];
  const finalName = getFilenameFromResponse({ headers: { get: () => disposition } }, filename);
  saveBlob(blob, finalName);
};

// EXPENSE EXCEL REPORTS
export const downloadExpenseExcelReport = async (period = "monthly", options = {}) => {
  let path = "reports/expense/monthly/excel";
  let filename = "expense-monthly.xlsx";

  if (period === "daily") {
    path = "reports/expense/daily/excel";
    filename = "expense-daily.xlsx";
  } else if (period === "weekly") {
    path = "reports/expense/weekly/excel";
    filename = "expense-weekly.xlsx";
  } else if (period === "monthly") {
    path = "reports/expense/monthly/excel";
    filename = "expense-monthly.xlsx";
  } else if (period === "yearly") {
    path = "reports/expense/yearly/excel";
    filename = "expense-yearly.xlsx";
  } else if (period === "all") {
    path = "reports/expense/all/excel";
    filename = "expense-all.xlsx";
  }

  path += buildQueryString({ userId: options.userId });

  const response = await api.get(path, { responseType: "blob" });
  const blob = response.data;
  const disposition = response.headers["content-disposition"];
  const finalName = getFilenameFromResponse({ headers: { get: () => disposition } }, filename);
  saveBlob(blob, finalName);
};

// LEDGER (Transaction-based) EXCEL REPORTS
export const downloadLedgerExcelReport = async (period = "monthly", options = {}) => {
  let path = "reports/ledger/monthly/excel";
  let filename = "ledger-monthly.xlsx";

  if (period === "daily") {
    path = "reports/ledger/daily/excel";
    filename = "ledger-daily.xlsx";
  } else if (period === "weekly") {
    path = "reports/ledger/weekly/excel";
    filename = "ledger-weekly.xlsx";
  } else if (period === "monthly") {
    path = "reports/ledger/monthly/excel";
    filename = "ledger-monthly.xlsx";
  } else if (period === "yearly") {
    path = "reports/ledger/yearly/excel";
    filename = "ledger-yearly.xlsx";
  } else if (period === "all") {
    path = "reports/ledger/all/excel";
    filename = "ledger-all.xlsx";
  }

  path += buildQueryString({ userId: options.userId });

  const response = await api.get(path, { responseType: "blob" });
  const blob = response.data;
  const disposition = response.headers["content-disposition"];
  const finalName = getFilenameFromResponse({ headers: { get: () => disposition } }, filename);
  saveBlob(blob, finalName);
};

// DUE & ITEM TRACKING REPORTS
export const downloadCustomerLedgerExcel = async (cdbId) => {
  const response = await api.get(`reports/due/customer-ledger/excel${buildQueryString({ cdbId })}`, {
    responseType: "blob"
  });
  const blob = response.data;
  const disposition = response.headers["content-disposition"];
  const finalName = getFilenameFromResponse(
    { headers: { get: () => disposition } },
    `ledger-${cdbId}.xlsx`
  );
  saveBlob(blob, finalName);
};

export const downloadDueSummaryExcel = async () => {
  const response = await api.get("reports/due/summary/excel", { responseType: "blob" });
  const blob = response.data;
  const disposition = response.headers["content-disposition"];
  const finalName = getFilenameFromResponse(
    { headers: { get: () => disposition } },
    "due-summary.xlsx"
  );
  saveBlob(blob, finalName);
};

export const downloadImeiTrackingExcel = async (search = "") => {
  const response = await api.get(
    `reports/due/imei-tracking/excel${buildQueryString({ search })}`,
    { responseType: "blob" }
  );
  const blob = response.data;
  const disposition = response.headers["content-disposition"];
  const finalName = getFilenameFromResponse(
    { headers: { get: () => disposition } },
    `imei-tracking${search ? "-" + search : ""}.xlsx`
  );
  saveBlob(blob, finalName);
};

// LEGACY SUPPORT
export const downloadExcelReport = async (type = null) => {
  if (type === "expense") {
    return downloadExpenseExcelReport("monthly");
  }
  return downloadIncomeExcelReport("monthly");
};
