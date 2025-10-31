// backend/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import apiRoutes from "./routes/api.js";

import DailySummary from "./services/dailySummaryScheduler.js";



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

  app.listen(PORT, () => console.log(`server is running - ${PORT}`));
  startDailySummaryScheduler();
}

if (require.main === module) {
  start();
}

start();

