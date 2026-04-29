const mongoose = require("mongoose");
const Income = require("../models/Income");
const Expense = require("../models/Expense");
const User = require("../models/User");

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/income-expense", {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const db = mongoose.connection;
db.on("error", (err) => console.error("MongoDB connection error:", err));
db.once("open", async () => {
  console.log("✓ MongoDB connected for seed data");
  await seedData();
  process.exit(0);
});

async function seedData() {
  try {
    // Get a staff user or create one for testing
    let staffUser = await User.findOne({ role: "staff" });
    
    if (!staffUser) {
      staffUser = await User.create({
        username: "teststaff",
        email: "staff@test.com",
        password: "hashed_password",
        role: "staff"
      });
      console.log("✓ Created test staff user:", staffUser.username);
    }

    // Clear existing test data
    await Income.deleteMany({});
    await Expense.deleteMany({});
    console.log("✓ Cleared existing test data");

    // Helper to create dates in last 30 days
    const getRandomDateInLastDays = (days) => {
      const now = new Date();
      const randomDays = Math.floor(Math.random() * days);
      now.setDate(now.getDate() - randomDays);
      now.setHours(Math.floor(Math.random() * 24));
      now.setMinutes(Math.floor(Math.random() * 60));
      return new Date(now);
    };

    // Create Income records
    const incomeRecords = [
      {
        clientName: "Acme Corporation",
        cbNumber: "CB001",
        description: "Website Development",
        quantity: 1,
        billAmount: 50000,
        receivedAmount: 50000,
        paymentMode: "bank",
        userId: staffUser._id,
        createdAt: getRandomDateInLastDays(30)
      },
      {
        clientName: "Tech Solutions Inc",
        cbNumber: "CB002",
        description: "Mobile App Development",
        quantity: 1,
        billAmount: 75000,
        receivedAmount: 60000,
        paymentMode: "bank",
        userId: staffUser._id,
        createdAt: getRandomDateInLastDays(30)
      },
      {
        clientName: "Global Enterprises",
        cbNumber: "CB003",
        description: "Database Migration",
        quantity: 2,
        billAmount: 30000,
        receivedAmount: 30000,
        paymentMode: "upi",
        upiReferenceId: "UPI12345678",
        userId: staffUser._id,
        createdAt: getRandomDateInLastDays(30)
      },
      {
        clientName: "StartUp Ventures",
        cbNumber: "CB004",
        description: "Cloud Infrastructure Setup",
        quantity: 1,
        billAmount: 45000,
        receivedAmount: 25000,
        paymentMode: "upi",
        upiReferenceId: "UPI87654321",
        userId: staffUser._id,
        createdAt: getRandomDateInLastDays(30)
      },
      {
        clientName: "Digital Marketing Pro",
        cbNumber: "CB005",
        description: "SEO Optimization",
        quantity: 3,
        billAmount: 20000,
        receivedAmount: 20000,
        paymentMode: "cash",
        userId: staffUser._id,
        createdAt: getRandomDateInLastDays(30)
      },
      {
        clientName: "Finance Consultancy",
        cbNumber: "CB006",
        description: "Financial Dashboard",
        quantity: 1,
        billAmount: 60000,
        receivedAmount: 60000,
        paymentMode: "upi",
        upiReferenceId: "UPI11223344",
        userId: staffUser._id,
        createdAt: getRandomDateInLastDays(30)
      },
      {
        clientName: "Healthcare Systems",
        cbNumber: "CB007",
        description: "Patient Management System",
        quantity: 2,
        billAmount: 85000,
        receivedAmount: 70000,
        paymentMode: "bank",
        userId: staffUser._id,
        createdAt: getRandomDateInLastDays(30)
      }
    ];

    const createdIncomes = await Income.insertMany(incomeRecords);
    console.log(`✓ Created ${createdIncomes.length} Income records`);

    // Create Expense records
    const expenseRecords = [
      {
        category: "petrol",
        amount: 5000,
        notes: "Fuel for vehicle maintenance",
        userId: staffUser._id,
        createdAt: getRandomDateInLastDays(30)
      },
      {
        category: "food",
        amount: 3500,
        notes: "Team lunch and meals",
        userId: staffUser._id,
        createdAt: getRandomDateInLastDays(30)
      },
      {
        category: "courier",
        amount: 2000,
        notes: "Document courier service",
        userId: staffUser._id,
        createdAt: getRandomDateInLastDays(30)
      },
      {
        category: "misc",
        amount: 8000,
        notes: "Miscellaneous office expenses",
        userId: staffUser._id,
        createdAt: getRandomDateInLastDays(30)
      },
      {
        category: "petrol",
        amount: 6500,
        notes: "Fuel expenses for client visits",
        userId: staffUser._id,
        createdAt: getRandomDateInLastDays(30)
      },
      {
        category: "food",
        amount: 4200,
        notes: "Client meeting refreshments",
        userId: staffUser._id,
        createdAt: getRandomDateInLastDays(30)
      },
      {
        category: "courier",
        amount: 1500,
        notes: "Priority courier for important documents",
        userId: staffUser._id,
        createdAt: getRandomDateInLastDays(30)
      },
      {
        category: "misc",
        amount: 12000,
        notes: "Hardware and equipment maintenance",
        userId: staffUser._id,
        createdAt: getRandomDateInLastDays(30)
      }
    ];

    const createdExpenses = await Expense.insertMany(expenseRecords);
    console.log(`✓ Created ${createdExpenses.length} Expense records`);

    // Calculate totals
    const totalIncome = incomeRecords.reduce((sum, item) => sum + item.billAmount, 0);
    const totalReceived = incomeRecords.reduce((sum, item) => sum + item.receivedAmount, 0);
    const totalDues = totalIncome - totalReceived;
    const totalExpense = expenseRecords.reduce((sum, item) => sum + item.amount, 0);

    console.log("\n════════════════════════════════════════════");
    console.log("       TEST DATA SEEDING COMPLETE ✓");
    console.log("════════════════════════════════════════════");
    console.log(`\n📊 INCOME SUMMARY (Last 30 days):`);
    console.log(`   • Total Billed: ₹${totalIncome.toFixed(2)}`);
    console.log(`   • Total Received: ₹${totalReceived.toFixed(2)}`);
    console.log(`   • Total Dues: ₹${totalDues.toFixed(2)}`);
    console.log(`   • Records: ${createdIncomes.length}`);

    console.log(`\n💰 EXPENSE SUMMARY (Last 30 days):`);
    console.log(`   • Total Expenses: ₹${totalExpense.toFixed(2)}`);
    console.log(`   • Records: ${createdExpenses.length}`);

    console.log(`\n✅ You can now test the export buttons!`);
    console.log(`   • Go to Admin Panel`);
    console.log(`   • Click "Export Income PDF (Last 1 Month)"`);
    console.log(`   • Click "Export Income Excel (Last 1 Month)"`);
    console.log(`   • Click "Export Expense PDF (Last 1 Month)"`);
    console.log(`   • Click "Export Expense Excel (Last 1 Month)"`);
    console.log("════════════════════════════════════════════\n");

  } catch (err) {
    console.error("❌ Error seeding data:", err);
    process.exit(1);
  }
}
