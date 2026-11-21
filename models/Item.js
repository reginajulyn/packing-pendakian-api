// models/Item.js
// Skema dan model Mongoose untuk satu perlengkapan pendakian.

import mongoose from "mongoose";

export const KATEGORI = ["Tenda & Tidur", "Pakaian", "Makanan & Minuman", "Peralatan", "Keselamatan", "Lainnya"];
export const PRIORITAS = ["wajib", "penting", "opsional"];

const itemSchema = new mongoose.Schema(
  {
    nama: {
      type: String,
      required: [true, "Nama item wajib diisi"],
      trim: true,
      maxlength: [100, "Nama item maksimal 100 karakter"],
    },
    kategori: {
      type: String,
      required: [true, "Kategori wajib diisi"],
      enum: { values: KATEGORI, message: `Kategori harus salah satu dari: ${KATEGORI.join(", ")}` },
    },
    // Berat per satuan dalam gram.
    berat: {
      type: Number,
      required: [true, "Berat (gram) wajib diisi"],
      min: [1, "Berat minimal 1 gram"],
      max: [50000, "Berat maksimal 50000 gram"],
      validate: { validator: Number.isInteger, message: "Berat harus bilangan bulat (gram)" },
    },
    jumlah: {
      type: Number,
      default: 1,
      min: [1, "Jumlah minimal 1"],
      max: [99, "Jumlah maksimal 99"],
      validate: { validator: Number.isInteger, message: "Jumlah harus bilangan bulat" },
    },
    prioritas: {
      type: String,
      default: "penting",
      enum: { values: PRIORITAS, message: `Prioritas harus salah satu dari: ${PRIORITAS.join(", ")}` },
    },
    dikemas: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Total berat = berat per satuan x jumlah (tidak disimpan, dihitung saat dibaca).
itemSchema.virtual("totalBerat").get(function () {
  return this.berat * this.jumlah;
});

itemSchema.set("toJSON", { virtuals: true, versionKey: false, transform: (_doc, ret) => { delete ret.id; return ret; } });

export default mongoose.model("Item", itemSchema);
