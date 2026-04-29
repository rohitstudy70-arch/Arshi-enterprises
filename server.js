require("dotenv").config();

const cors = require("cors");
const path = require("path");
const express = require("express");
const connectDB = require("./src/config/db");
const authRoutes = require("./src/routes/authRoutes");
const incomeRoutes = require("./src/routes/incomeRoutes");
const expenseRoutes = require("./src/routes/expenseRoutes");
const dashboardRoutes = require("./src/routes/dashboardRoutes");
const reportRoutes = require("./src/routes/reportRoutes");
const ensureAdminUser = require("./src/utils/ensureAdminUser");

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true
}));
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "Arshi Enterprises API is running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/incomes", incomeRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/reports", reportRoutes);

// Serve frontend build in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "frontend", "dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "frontend", "dist", "index.html"));
  });
} else {
  app.use((req, res) => {
    res.status(404).json({ message: "Route not found" });
  });
}

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not defined");
    }

    await connectDB();
    await ensureAdminUser();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();