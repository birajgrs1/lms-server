import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import dbConnect from "../config/dbConnect.js";
import connectCloudinary from "../config/cloudinary.js";
import educatorRouter from "../routes/educatorRoutes.js";
import courseRouter from "../routes/courseRoutes.js";
import userRouter from "../routes/userRoutes.js";
import { clerkWebHooks, stripeWebHooks } from "../controllers/webhooks.js";
import { clerkMiddleware } from "@clerk/express";

dotenv.config();
const app = express();

// --- Webhooks (raw body needed) ---
app.post("/stripe", express.raw({ type: "application/json" }), stripeWebHooks);
app.post("/clerk", express.raw({ type: "application/json" }), clerkWebHooks);

// --- CORS Setup ---
const allowedOrigins = [
  "https://lms-client-khaki.vercel.app",
  "https://lms-frontend-gray-kappa.vercel.app",
  "http://localhost:5173"
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, mobile apps, etc.)
      if (!origin) return callback(null, true);

      // ✅ Always allow (acts like "*"), but keeps credentials working
      if (allowedOrigins.includes(origin) || true) {
        return callback(null, origin); // echo back the request origin
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(clerkMiddleware());

// --- DB + Cloudinary Setup ---
let isDBConnected = false;

const initializeServices = async () => {
  if (!isDBConnected) {
    await dbConnect();
    isDBConnected = true;
  }
  connectCloudinary();
};

// Middleware to ensure DB is connected before handling requests
app.use(async (req, res, next) => {
  try {
    await initializeServices();
    next();
  } catch (err) {
    console.error("Service init error:", err);
    res.status(503).json({ success: false, message: "Service temporarily unavailable" });
  }
});

// --- Routes ---
app.get("/", (req, res) =>
  res.json({ success: true, message: "Server is running", timestamp: new Date() })
);

app.use("/api/educator", educatorRouter);
app.use("/api/course", courseRouter);
app.use("/api/user", userRouter);

// Health check
app.get("/health", (req, res) =>
  res.json({ status: "OK", timestamp: new Date() })
);

// --- Error handling ---
app.use((error, req, res, next) => {
  console.error(error.stack);
  res.status(500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : error.message,
  });
});

// --- Start server for Railway ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
