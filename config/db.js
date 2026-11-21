// config/db.js
// Koneksi ke MongoDB menggunakan Mongoose.

import mongoose from "mongoose";

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI belum diatur. Salin .env.example menjadi .env lalu isi nilainya.");
  }

  const koneksi = await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  console.log(`MongoDB terhubung: ${koneksi.connection.host}/${koneksi.connection.name}`);
  return koneksi;
}
