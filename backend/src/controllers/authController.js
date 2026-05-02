const User = require("../models/User");
const generateToken = require("../utils/generateToken");

const register = async (req, res) => {
  try {
    const { username, password, role } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required" });
    }

    if (role && role !== "executive") {
      return res.status(400).json({ message: "Admin can only create executive users" });
    }

    const existingUser = await User.findOne({ username });

    if (existingUser) {
      return res.status(409).json({ message: "Username already exists" });
    }

    const user = await User.create({
      username,
      password,
      role: "executive"
    });

    return res.status(201).json({
      message: "Executive user created successfully",
      user: {
        id: user._id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required" });
    }

    const user = await User.findOne({ username }).select("+password");

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = generateToken(user);

    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });

    return res.status(200).json({
      users: users.map((user) => ({
        id: user._id,
        username: user.username,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }))
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role !== "executive") {
      return res.status(403).json({ message: "Only executive users can be deleted" });
    }

    await user.deleteOne();

    return res.status(200).json({ message: "Executive user deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updateUserPassword = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password || String(password).length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const user = await User.findById(req.params.id).select("+password role");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role !== "executive") {
      return res.status(403).json({ message: "Only executive user passwords can be changed" });
    }

    user.password = password;
    await user.save();

    return res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  register,
  login,
  getProfile,
  getAllUsers,
  getUserById,
  deleteUser,
  updateUserPassword
};
