import mongoose from "mongoose";
import { config } from "./config.js";

export async function connectDb(): Promise<typeof mongoose> {
  mongoose.set("strictQuery", true);
  return mongoose.connect(config.mongoUrl);
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
