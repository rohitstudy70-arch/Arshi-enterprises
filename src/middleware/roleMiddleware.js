const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authorized" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }

    return next();
  };
};

const allowSelfOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Not authorized" });
  }

  if (req.user.role === "admin" || req.user.id === req.params.id) {
    return next();
  }

  return res.status(403).json({ message: "Access denied" });
};

module.exports = {
  authorizeRoles,
  allowSelfOrAdmin
};
