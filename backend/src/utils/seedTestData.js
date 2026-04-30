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
    // Get an executive user or create one for testing
    let executiveUser = await User.findOne({ role: "executive" });

    if (!executiveUser) {
      executiveUser = await User.create({
        username: "testexecutive",
        email: "executive@test.com",
        password: "hashed_password",
        role: "executive"
      });
      console.log("✓ Created test executive user:", executiveUser.username);
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
        cbNumber: "01",
        description: "Website Development",
        mobile1: "9876543210",
        mobile2: "",
        address: "123 Business Park, Mumbai",
        district: "Mumbai",
        vehicleChassisNo: "MH12AB1234",
        clientUserId: "USR001",
        item: "GPS Tracker",
        model: "GT-500",
        imeiNo: "123456789012345",
        imeiLastSix: "012345",
        vtsNo: "VTS001",
        technician: "Ramesh",
        quantity: 1,
        billAmount: 50000,
        receivedAmount: 50000,
        paymentMode: "bank",
        userId: executiveUser._id,
        createdAt: getRandomDateInLastDays(30)
      },
      {
        clientName: "Tech Solutions Inc",
        cbNumber: "02",
        description: "Mobile App Development",
        mobile1: "9988776655",
        mobile2: "",
        address: "456 IT Hub, Pune",
        district: "Pune",
        vehicleChassisNo: "MH14CD5678",
        clientUserId: "USR002",
        item: "Speed Governor",
        model: "SG-200",
        imeiNo: "987654321098765",
        imeiLastSix: "098765",
        vtsNo: "VTS002",
        technician: "Suresh",
        quantity: 1,
        billAmount: 75000,
        receivedAmount: 60000,
        paymentMode: "bank",
        userId: executiveUser._id,
        createdAt: getRandomDateInLastDays(30)
      },
      {
        clientName: "Global Enterprises",
        cbNumber: "03",
        description: "Database Migration",
        mobile1: "9123456789",
        mobile2: "",
        address: "789 Corporate Zone, Delhi",
        district: "Delhi",
        vehicleChassisNo: "DL05EF9012",
        clientUserId: "USR003",
        item: "CCTV Camera",
        model: "CC-4K",
        imeiNo: "567890123456789",
        imeiLastSix: "456789",
        vtsNo: "VTS003",
        technician: "Mahesh",
        quantity: 2,
        billAmount: 30000,
        receivedAmount: 30000,
        paymentMode: "upi",
        upiReferenceId: "UPI12345678",
        userId: executiveUser._id,
        createdAt: getRandomDateInLastDays(30)
      },
      {
        clientName: "StartUp Ventures",
        cbNumber: "04",
        description: "Cloud Infrastructure Setup",
        mobile1: "9012345678",
        mobile2: "",
        address: "101 Startup Lane, Bangalore",
        district: "Bangalore",
        vehicleChassisNo: "KA01GH3456",
        clientUserId: "USR004",
        item: "Fuel Sensor",
        model: "FS-100",
        imeiNo: "345678901234567",
        imeiLastSix: "234567",
        vtsNo: "VTS004",
        technician: "Ramesh",
        quantity: 1,
        billAmount: 45000,
        receivedAmount: 25000,
        paymentMode: "upi",
        upiReferenceId: "UPI87654321",
        userId: executiveUser._id,
        createdAt: getRandomDateInLastDays(30)
      },
      {
        clientName: "Digital Marketing Pro",
        cbNumber: "05",
        description: "SEO Optimization",
        mobile1: "8899001122",
        mobile2: "",
        address: "202 Market Street, Chennai",
        district: "Chennai",
        vehicleChassisNo: "TN07IJ7890",
        clientUserId: "USR005",
        item: "Panic Button",
        model: "PB-01",
        imeiNo: "789012345678901",
        imeiLastSix: "678901",
        vtsNo: "VTS005",
        technician: "Suresh",
        quantity: 3,
        billAmount: 20000,
        receivedAmount: 20000,
        paymentMode: "cash",
        userId: executiveUser._id,
        createdAt: getRandomDateInLastDays(30)
      },
      {
        clientName: "Finance Consultancy",
        cbNumber: "06",
        description: "Financial Dashboard",
        mobile1: "8765432109",
        mobile2: "",
        address: "303 Finance Tower, Hyderabad",
        district: "Hyderabad",
        vehicleChassisNo: "TS08KL1234",
        clientUserId: "USR006",
        item: "GPS Tracker",
        model: "GT-500",
        imeiNo: "234567890123456",
        imeiLastSix: "123456",
        vtsNo: "VTS006",
        technician: "Mahesh",
        quantity: 1,
        billAmount: 60000,
        receivedAmount: 60000,
        paymentMode: "upi",
        upiReferenceId: "UPI11223344",
        userId: executiveUser._id,
        createdAt: getRandomDateInLastDays(30)
      },
      {
        clientName: "Healthcare Systems",
        cbNumber: "07",
        description: "Patient Management System",
        mobile1: "7654321098",
        mobile2: "",
        address: "404 Health Complex, Kolkata",
        district: "Kolkata",
        vehicleChassisNo: "WB09MN5678",
        clientUserId: "USR007",
        item: "CCTV Camera",
        model: "CC-4K",
        imeiNo: "890123456789012",
        imeiLastSix: "789012",
        vtsNo: "VTS007",
        technician: "Ramesh",
        quantity: 2,
        billAmount: 85000,
        receivedAmount: 70000,
        paymentMode: "bank",
        userId: executiveUser._id,
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
        userId: executiveUser._id,
        createdAt: getRandomDateInLastDays(30)
      },
      {
        category: "food",
        amount: 3500,
        notes: "Team lunch and meals",
        userId: executiveUser._id,
        createdAt: getRandomDateInLastDays(30)
      },
      {
        category: "material",
        amount: 2000,
        notes: "Material purchase for installation",
        userId: executiveUser._id,
        createdAt: getRandomDateInLastDays(30)
      },
      {
        category: "misc",
        amount: 8000,
        notes: "Miscellaneous office expenses",
        userId: executiveUser._id,
        createdAt: getRandomDateInLastDays(30)
      },
      {
        category: "petrol",
        amount: 6500,
        notes: "Fuel expenses for client visits",
        userId: executiveUser._id,
        createdAt: getRandomDateInLastDays(30)
      },
      {
        category: "food",
        amount: 4200,
        notes: "Client meeting refreshments",
        userId: executiveUser._id,
        createdAt: getRandomDateInLastDays(30)
      },
      {
        category: "material",
        amount: 1500,
        notes: "Spare parts and materials",
        userId: executiveUser._id,
        createdAt: getRandomDateInLastDays(30)
      },
      {
        category: "misc",
        amount: 12000,
        notes: "Hardware and equipment maintenance",
        userId: executiveUser._id,
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
    console.log(`   • Click "Export Income Excel (Last 1 Month)"`);
    console.log(`   • Click "Export Income Excel (Last 1 Month)"`);
    console.log(`   • Click "Export Expense Excel (Last 1 Month)"`);
    console.log(`   • Click "Export Expense Excel (Last 1 Month)"`);
    console.log("════════════════════════════════════════════\n");

  } catch (err) {
    console.error("❌ Error seeding data:", err);
    process.exit(1);
  }
}
