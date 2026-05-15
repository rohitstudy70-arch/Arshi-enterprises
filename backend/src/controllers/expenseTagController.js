const ExpenseTag = require("../models/ExpenseTag");

const createTag = async (req, res) => {
    try {
        const { code, name } = req.body;

        if (!code || !name) {
            return res.status(400).json({ message: "Both code and name are required" });
        }

        const existing = await ExpenseTag.findOne({ code });

        if (existing) {
            return res.status(409).json({ message: "Expense tag code already exists" });
        }

        const tag = await ExpenseTag.create({ code, name, createdBy: req.user.id });

        return res.status(201).json({ tag });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const listTags = async (req, res) => {
    try {
        const tags = await ExpenseTag.find().sort({ createdAt: -1 });
        return res.status(200).json({ tags });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createTag,
    listTags
};
