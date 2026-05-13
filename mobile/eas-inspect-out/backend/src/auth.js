const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const JWT_ISSUER = "agrovibes";

function signJwt(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d", issuer: JWT_ISSUER });
}

function readBearerToken(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

function authOptional(req, _res, next) {
  const token = readBearerToken(req);
  if (!token) {
    req.user = null;
    next();
    return;
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET, { issuer: JWT_ISSUER });
  } catch (_e) {
    req.user = null;
  }
  next();
}

function authRequired(req, res, next) {
  const token = readBearerToken(req);
  if (!token) {
    res.status(401).json({ message: "Missing auth token" });
    return;
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET, { issuer: JWT_ISSUER });
    next();
  } catch (e) {
    res.status(401).json({ message: "Invalid auth token", error: e.message });
  }
}

function requireRole(roles) {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    if (!allowed.includes(req.user.role)) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    next();
  };
}

module.exports = {
  signJwt,
  authOptional,
  authRequired,
  requireRole
};

