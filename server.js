// backend/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import apiRoutes from "./routes/api.js";
import { startDailySummaryScheduler } from "./services/dailySummaryScheduler.js";
import { initPoller } from "./services/poller.js"; // assuming you have this

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// health
app.get("/health", (req, res) => res.json({ ok: true }));

// api
app.use("/api", apiRoutes);

const PORT = process.env.PORT || 4000;

async function start() {
  await connectDB(process.env.MONGODB_URI);

  // start poller
  const esp = process.env.ESP_ENDPOINT;
  const interval = parseInt(process.env.POLL_INTERVAL_MS, 10);
  initPoller({ endpoint: esp, intervalMs: interval });

  app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

  startDailySummaryScheduler();
}

// ✅ ESM-compatible equivalent of "if (require.main === module)"
if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}

export { start };
