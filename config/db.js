// backend/config/db.js
import mongoose from "mongoose";

export async function connectDB(uri){
  try {
    if(!uri) throw new Error("Missing MONGODB_URI");
    await mongoose.connect(uri, { dbName: "smart_queue_system" });
    console.log("DB CONNECTED");
  } catch(err) {
    console.error("MONGO ERROR", err.message);
    process.exit(1);
  }
}
