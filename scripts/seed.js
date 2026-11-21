// scripts/seed.js
// Mengisi database dengan data contoh (dari Tugas 1). PERHATIAN: menghapus semua item lama.
// Jalankan dengan: npm run seed

import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import Item from "../models/Item.js";

const dataAwal = [
  { nama: "Tenda dome 2 orang", kategori: "Tenda & Tidur", berat: 1800, jumlah: 1, prioritas: "wajib", dikemas: false },
  { nama: "Sleeping bag", kategori: "Tenda & Tidur", berat: 900, jumlah: 1, prioritas: "wajib", dikemas: true },
  { nama: "Matras lipat", kategori: "Tenda & Tidur", berat: 400, jumlah: 1, prioritas: "penting", dikemas: false },
  { nama: "Jaket gunung", kategori: "Pakaian", berat: 600, jumlah: 1, prioritas: "wajib", dikemas: true },
  { nama: "Kaos cadangan", kategori: "Pakaian", berat: 200, jumlah: 2, prioritas: "penting", dikemas: false },
  { nama: "Headlamp", kategori: "Keselamatan", berat: 90, jumlah: 1, prioritas: "wajib", dikemas: true },
  { nama: "Kotak P3K", kategori: "Keselamatan", berat: 300, jumlah: 1, prioritas: "wajib", dikemas: false },
  { nama: "Power bank", kategori: "Peralatan", berat: 250, jumlah: 1, prioritas: "penting", dikemas: false },
  { nama: "Kompor portable", kategori: "Peralatan", berat: 350, jumlah: 1, prioritas: "penting", dikemas: false },
  { nama: "Nesting set", kategori: "Peralatan", berat: 400, jumlah: 1, prioritas: "penting", dikemas: false },
  { nama: "Air minum 1,5 liter", kategori: "Makanan & Minuman", berat: 1500, jumlah: 2, prioritas: "wajib", dikemas: false },
  { nama: "Mi instan", kategori: "Makanan & Minuman", berat: 80, jumlah: 4, prioritas: "penting", dikemas: false },
  { nama: "Kamera mirrorless", kategori: "Lainnya", berat: 500, jumlah: 1, prioritas: "opsional", dikemas: false },
  { nama: "Buku bacaan", kategori: "Lainnya", berat: 300, jumlah: 1, prioritas: "opsional", dikemas: false },
];

try {
  await connectDB();
  await Item.deleteMany({});
  const hasil = await Item.insertMany(dataAwal);
  console.log(`Seed selesai: ${hasil.length} item dimasukkan.`);
} catch (err) {
  console.error("Seed gagal:", err.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
