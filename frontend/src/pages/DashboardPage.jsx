import { useEffect, useState } from "react";
import api from "../api";
import StatCard from "../components/StatCard";
import { downloadIncomeExcelReport, downloadExpenseExcelReport } from "../utils/reportDownload";
import { formatCurrency, formatMonthLabel } from "../utils/formatters";

const DashboardPage = () => {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState("");

  useEffect(() => {
    let mounted = true;

    const loadDashboard = async () => {
      try {
        const { data } = await api.get("/dashboard");

        if (mounted) {
          setDashboard(data);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadDashboard();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return <div className="panel p-8 text-sm font-semibold text-muted">Loading Arshi Enterprises dashboard...</div>;
  }

  const monthlySummary = dashboard?.monthlySummary || [];
  const maxValue = Math.max(
    ...monthlySummary.flatMap((item) => [item.income || 0, item.expense || 0]),
    1
  );

  const handleExport = async (type) => {
    setExporting(type);

    try {
      if (type === "income-excel") {
        await downloadIncomeExcelReport("monthly");
        return;
      }

      if (type === "expense-excel") {
        await downloadExpenseExcelReport("monthly");
        return;
      }
    } finally {
      setExporting("");
    }
  };

  return (
    <div className="space-y-6">
      <section className="panel p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">Exports</p>
            <h3 className="mt-2 text-2xl font-bold text-ink">Download reports</h3>
            <p className="mt-2 text-sm text-muted">Download monthly Excel summaries for income and expense.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              className="button-secondary"
              onClick={() => handleExport("income-excel")}
              disabled={Boolean(exporting)}
            >
              {exporting === "income-excel" ? "Exporting..." : "\u{1F4CA} Income Excel"}
            </button>
            <button
              type="button"
              className="button-primary"
              onClick={() => handleExport("expense-excel")}
              disabled={Boolean(exporting)}
            >
              {exporting === "expense-excel" ? "Exporting..." : "\u{1F4CA} Expense Excel"}
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Today's Revenue"
          value={formatCurrency(dashboard?.todayRevenue)}
          tone="revenue"
          subtitle="Received amount captured today"
        />
        <StatCard
          title="Today's Expenses"
          value={formatCurrency(dashboard?.todayExpenses)}
          tone="expense"
          subtitle="Operational spend posted today"
        />
        <StatCard
          title="Total Dues"
          value={formatCurrency(dashboard?.totalDues)}
          tone="dues"
          subtitle="Open amount still pending collection"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="panel p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">Monthly Summary</p>
              <h3 className="mt-2 text-2xl font-bold text-ink">Last 3 months</h3>
            </div>
            <p className="text-sm text-muted">Income vs expense</p>
          </div>

          <div className="mt-8 space-y-5">
            {monthlySummary.map((item) => (
              <div key={item.month} className="rounded-[24px] border border-line/80 bg-white p-4">
                <div className="flex items-center justify-between gap-4">
                  <p className="font-semibold text-ink">{formatMonthLabel(item.month)}</p>
                  <div className="text-right text-xs uppercase tracking-[0.18em] text-muted">
                    <div>Income {formatCurrency(item.income)}</div>
                    <div className="mt-1">Expense {formatCurrency(item.expense)}</div>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <div>
                    <div className="mb-2 flex justify-between text-xs font-semibold uppercase tracking-[0.16em] text-teal">
                      <span>Income</span>
                      <span>{formatCurrency(item.income)}</span>
                    </div>
                    <div className="h-3 rounded-full bg-teal/10">
                      <div
                        className="h-3 rounded-full bg-teal transition-all"
                        style={{ width: `${Math.max((item.income / maxValue) * 100, item.income ? 8 : 0)}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex justify-between text-xs font-semibold uppercase tracking-[0.16em] text-amber">
                      <span>Expense</span>
                      <span>{formatCurrency(item.expense)}</span>
                    </div>
                    <div className="h-3 rounded-full bg-amber/10">
                      <div
                        className="h-3 rounded-full bg-amber transition-all"
                        style={{ width: `${Math.max((item.expense / maxValue) * 100, item.expense ? 8 : 0)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel p-6">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">Snapshot</p>
          <h3 className="mt-2 text-2xl font-bold text-ink">Working capital rhythm</h3>
          <div className="mt-8 space-y-4">
            {[
              {
                label: "Revenue strength",
                value: dashboard?.todayRevenue,
                tone: "bg-teal"
              },
              {
                label: "Expense load",
                value: dashboard?.todayExpenses,
                tone: "bg-amber"
              },
              {
                label: "Receivable stack",
                value: dashboard?.totalDues,
                tone: "bg-slate-700"
              }
            ].map((item) => (
              <div key={item.label} className="rounded-[24px] border border-line/80 bg-white p-5">
                <div className="flex items-center justify-between gap-4">
                  <p className="font-semibold text-ink">{item.label}</p>
                  <span className="text-sm font-semibold text-muted">{formatCurrency(item.value)}</span>
                </div>
                <div className="mt-4 h-2 rounded-full bg-slate-200">
                  <div
                    className={`h-2 rounded-full ${item.tone}`}
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(
                          12,
                          ((Number(item.value || 0) /
                            Math.max(
                              Number(dashboard?.todayRevenue || 0),
                              Number(dashboard?.todayExpenses || 0),
                              Number(dashboard?.totalDues || 0),
                              1
                            )) *
                            100)
                        )
                      )}%`
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default DashboardPage;
