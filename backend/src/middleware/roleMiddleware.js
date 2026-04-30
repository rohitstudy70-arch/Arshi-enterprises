const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      console.log("[AUTH DEBUG] No req.user — token missing or invalid");
      return res.status(401).json({ message: "Not authorized" });
    }

    console.log(`[AUTH DEBUG] User role: "${req.user.role}" | Required: [${roles.join(", ")}] | Match: ${roles.includes(req.user.role)}`);

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: `Access denied — your role "${req.user.role}" is not allowed. Required: ${roles.join(" or ")}` });
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
