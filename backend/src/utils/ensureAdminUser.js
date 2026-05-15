const User = require("../models/User");

const ensureAdminUser = async () => {
  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminUsername || !adminPassword) {
    console.warn("ADMIN_USERNAME or ADMIN_PASSWORD not set in .env — skipping admin setup");
    return;
  }

  await User.updateMany({ role: "staff" }, { $set: { role: "executive" } });
  await User.updateMany({ role: "user" }, { $set: { role: "executive" } });

  const existingAdmin = await User.findOne({ role: "admin" });

  if (existingAdmin) {
    return;
  }

  const existingAdminUsername = await User.findOne({ username: adminUsername }).select("+password");

  if (existingAdminUsername) {
    existingAdminUsername.password = adminPassword;
    existingAdminUsername.role = "admin";
    await existingAdminUsername.save();
    console.log(`Default admin updated: ${adminUsername}`);
    return;
  }

  await User.create({
    username: adminUsername,
    password: adminPassword,
    role: "admin"
  });

  console.log(`Default admin created: ${adminUsername}`);
};

module.exports = ensureAdminUser;
