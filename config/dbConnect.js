import mongoose from "mongoose";

let isConnected = false; // cached connection

const connectDB = async () => {
  if (isConnected) {
    console.log("✅ Using existing database connection");
    return;
  }

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      dbName: "lms-sys",
    });
    console.log(`✅ Database connected: ${conn.connection.host}`);
    isConnected = true;
  } catch (err) {
    console.error("❌ DB connection error:", err.message);
    throw err;
  }
};

export default connectDB;