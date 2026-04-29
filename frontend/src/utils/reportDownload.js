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

// INCOME REPORTS
export const downloadIncomeExcelReport = async (period = "monthly") => {
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

  const response = await api.get(path, { responseType: "blob" });
  const blob = response.data;
  const disposition = response.headers["content-disposition"];
  const finalName = getFilenameFromResponse({ headers: { get: (k) => disposition } }, filename);
  saveBlob(blob, finalName);
};

export const downloadIncomePdfReport = async (period = "monthly") => {
  let path = "reports/income/pdf";
  let filename = "income-report.pdf";

  if (period === "daily") {
    path = "reports/income/daily/pdf";
    filename = "income-daily.pdf";
  } else if (period === "weekly") {
    path = "reports/income/weekly/pdf";
    filename = "income-weekly.pdf";
  } else if (period === "monthly") {
    path = "reports/income/monthly/pdf";
    filename = "income-monthly.pdf";
  } else if (period === "yearly") {
    path = "reports/income/yearly/pdf";
    filename = "income-yearly.pdf";
  } else if (period === "all") {
    path = "reports/income/all/pdf";
    filename = "income-all.pdf";
  }

  const response = await api.get(path, { responseType: "blob" });
  const blob = response.data;
  const disposition = response.headers["content-disposition"];
  const finalName = getFilenameFromResponse({ headers: { get: (k) => disposition } }, filename);
  saveBlob(blob, finalName);
};

// EXPENSE REPORTS
export const downloadExpenseExcelReport = async (period = "monthly") => {
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

  const response = await api.get(path, { responseType: "blob" });
  const blob = response.data;
  const disposition = response.headers["content-disposition"];
  const finalName = getFilenameFromResponse({ headers: { get: (k) => disposition } }, filename);
  saveBlob(blob, finalName);
};

export const downloadExpensePdfReport = async (period = "monthly") => {
  let path = "reports/expense/monthly/pdf";
  let filename = "expense-monthly.pdf";

  if (period === "daily") {
    path = "reports/expense/daily/pdf";
    filename = "expense-daily.pdf";
  } else if (period === "weekly") {
    path = "reports/expense/weekly/pdf";
    filename = "expense-weekly.pdf";
  } else if (period === "monthly") {
    path = "reports/expense/monthly/pdf";
    filename = "expense-monthly.pdf";
  } else if (period === "yearly") {
    path = "reports/expense/yearly/pdf";
    filename = "expense-yearly.pdf";
  } else if (period === "all") {
    path = "reports/expense/all/pdf";
    filename = "expense-all.pdf";
  }

  const response = await api.get(path, { responseType: "blob" });
  const blob = response.data;
  const disposition = response.headers["content-disposition"];
  const finalName = getFilenameFromResponse({ headers: { get: (k) => disposition } }, filename);
  saveBlob(blob, finalName);
};

// LEGACY SUPPORT
export const downloadExcelReport = async (type = null) => {
  let path = "reports/excel";
  let filename = "report.xlsx";

  if (type === "income") {
    return downloadIncomeExcelReport("monthly");
  } else if (type === "expense") {
    return downloadExpenseExcelReport("monthly");
  }

  const response = await api.get(path, { responseType: "blob" });
  const blob = response.data;
  const disposition = response.headers["content-disposition"];
  const finalName = getFilenameFromResponse({ headers: { get: (k) => disposition } }, filename);
  saveBlob(blob, finalName);
};

export const downloadPdfReport = async (type = null) => {
  let path = "reports/pdf";
  let filename = "report.pdf";

  if (type === "income") {
    return downloadIncomePdfReport("monthly");
  } else if (type === "expense") {
    return downloadExpensePdfReport("monthly");
  } else if (type === "daily") {
    path = "reports/pdf?range=day";
    filename = "daily-report.pdf";
  } else if (type === "weekly") {
    path = "reports/pdf?range=week";
    filename = "weekly-report.pdf";
  } else if (type === "monthly") {
    path = "reports/pdf?range=month";
    filename = "monthly-report.pdf";
  }

  const response = await api.get(path, { responseType: "blob" });
  const blob = response.data;
  const disposition = response.headers["content-disposition"];
  const finalName = getFilenameFromResponse({ headers: { get: (k) => disposition } }, filename);
  saveBlob(blob, finalName);
};
