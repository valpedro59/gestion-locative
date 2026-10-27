import rateLimit from "express-rate-limit";

export const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Trop de tentatives de connexion, veuillez réessayer plus tard.",
  standardHeaders: true,
  legacyHeaders: false,
});

export const globalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 1000,
  message: "Trop de requêtes depuis cette IP, veuillez réessayer plus tard.",
});
