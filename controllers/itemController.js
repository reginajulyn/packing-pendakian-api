// controllers/itemController.js
// Logika setiap endpoint. Semua handler memakai async/await dan mengembalikan
// HTTP status code yang sesuai: 200, 201, 400, 404, 409, dan 500.

import mongoose from "mongoose";
import Item, { KATEGORI, PRIORITAS } from "../models/Item.js";
import { hitungRingkasan, hitungSaran } from "../utils/beban.js";

// ---------- Helper ----------
const kirim = (res, status, message, data = undefined, tambahan = {}) =>
  res.status(status).json({ success: status < 400, message, ...tambahan, ...(data !== undefined && { data }) });

const FIELD_BOLEH = ["nama", "kategori", "berat", "jumlah", "prioritas", "dikemas"];
// Hanya field yang diizinkan yang diambil. Kategori dan prioritas dinormalkan agar tidak peka huruf besar/kecil.
const ambilField = (body) => {
  const sumber = body && typeof body === "object" ? body : {};
  const data = Object.fromEntries(FIELD_BOLEH.filter((f) => sumber[f] !== undefined).map((f) => [f, sumber[f]]));
  if (typeof data.kategori === "string") {
    data.kategori = KATEGORI.find((k) => k.toLowerCase() === data.kategori.trim().toLowerCase()) ?? data.kategori;
  }
  if (typeof data.prioritas === "string") data.prioritas = data.prioritas.trim().toLowerCase();
  return data;
};

const escapeRegex = (teks) => teks.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const namaSudahAda = async (nama, kecualiId = null) => {
  if (typeof nama !== "string" || !nama.trim()) return false;
  const filter = { nama: { $regex: `^${escapeRegex(nama.trim())}$`, $options: "i" } };
  if (kecualiId) filter._id = { $ne: kecualiId };
  return Boolean(await Item.exists(filter));
};

const batasDariRequest = (req) => {
  const mentah = req.query.batas ?? process.env.BATAS_BERAT_KG ?? 9;
  const kg = Number(mentah);
  if (!Number.isFinite(kg) || kg <= 0 || kg > 100) return null;
  return Math.round(kg * 1000);
};

function tanganiError(res, err) {
  if (err?.name === "ValidationError") {
    const errors = Object.values(err.errors).map((e) => e.message);
    return kirim(res, 400, "Data tidak valid", undefined, { errors });
  }
  if (err?.name === "CastError") return kirim(res, 400, `Nilai tidak valid untuk field "${err.path}"`);
  if (err?.code === 11000) return kirim(res, 409, "Data duplikat");
  console.error("[ERROR]", err);
  return kirim(res, 500, "Terjadi kesalahan pada server");
}

// Mengembalikan dokumen, atau mengirim 400/404 dan mengembalikan null.
async function ambilItemAtau404(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    kirim(res, 400, `ID "${id}" tidak valid`);
    return null;
  }
  const item = await Item.findById(id);
  if (!item) {
    kirim(res, 404, `Item dengan ID ${id} tidak ditemukan`);
    return null;
  }
  return item;
}

// ---------- CREATE ----------

// POST /api/items
export const buatItem = async (req, res) => {
  try {
    const data = ambilField(req.body);
    if (await namaSudahAda(data.nama)) return kirim(res, 409, `Item "${data.nama.trim()}" sudah ada di daftar`);
    const item = await Item.create(data);
    return kirim(res, 201, "Item berhasil ditambahkan", item);
  } catch (err) {
    return tanganiError(res, err);
  }
};

// ---------- READ ----------

// GET /api/items?kategori=&prioritas=&dikemas=&cari=&sort=
export const ambilSemuaItem = async (req, res) => {
  try {
    const { kategori, prioritas, dikemas, cari, sort = "createdAt" } = req.query;
    const filter = {};

    if (kategori !== undefined) {
      const cocok = KATEGORI.find((k) => k.toLowerCase() === String(kategori).toLowerCase());
      if (!cocok) return kirim(res, 400, `Kategori tidak valid. Pilihan: ${KATEGORI.join(", ")}`);
      filter.kategori = cocok;
    }
    if (prioritas !== undefined) {
      const cocok = PRIORITAS.find((p) => p === String(prioritas).toLowerCase());
      if (!cocok) return kirim(res, 400, `Prioritas tidak valid. Pilihan: ${PRIORITAS.join(", ")}`);
      filter.prioritas = cocok;
    }
    if (dikemas !== undefined) {
      if (!["true", "false"].includes(String(dikemas).toLowerCase())) return kirim(res, 400, 'Parameter dikemas harus "true" atau "false"');
      filter.dikemas = String(dikemas).toLowerCase() === "true";
    }
    if (cari !== undefined && String(cari).trim()) {
      filter.nama = { $regex: escapeRegex(String(cari).trim()), $options: "i" };
    }

    const arah = String(sort).startsWith("-") ? -1 : 1;
    const bidang = String(sort).replace(/^-/, "");
    if (!["nama", "kategori", "berat", "createdAt"].includes(bidang)) {
      return kirim(res, 400, "Parameter sort harus salah satu dari: nama, kategori, berat, createdAt (awali dengan - untuk menurun)");
    }

    const items = await Item.find(filter).sort({ [bidang]: arah });
    return kirim(res, 200, `Ditemukan ${items.length} item`, items, { count: items.length });
  } catch (err) {
    return tanganiError(res, err);
  }
};

// GET /api/items/:id
export const ambilItemById = async (req, res) => {
  try {
    const item = await ambilItemAtau404(req, res);
    if (!item) return;
    return kirim(res, 200, "Item ditemukan", item);
  } catch (err) {
    return tanganiError(res, err);
  }
};

// GET /api/items/ringkasan?batas=<kg>
export const ambilRingkasan = async (req, res) => {
  try {
    const batasGram = batasDariRequest(req);
    if (batasGram === null) return kirim(res, 400, "Parameter batas harus angka lebih dari 0 dan maksimal 100 (kg)");
    const items = await Item.find().lean();
    return kirim(res, 200, "Ringkasan beban tas", hitungRingkasan(items, batasGram));
  } catch (err) {
    return tanganiError(res, err);
  }
};

// GET /api/items/saran?batas=<kg>
export const ambilSaran = async (req, res) => {
  try {
    const batasGram = batasDariRequest(req);
    if (batasGram === null) return kirim(res, 400, "Parameter batas harus angka lebih dari 0 dan maksimal 100 (kg)");
    const items = await Item.find().lean();
    const hasil = hitungSaran(items, batasGram);
    const pesan = !hasil.perluDikurangi
      ? "Beban masih dalam batas, tidak perlu mengurangi apa pun"
      : hasil.tercapai
        ? `Keluarkan ${hasil.saran.length} item agar beban masuk batas`
        : "Walau semua item non-wajib dikeluarkan, beban masih melebihi batas";
    return kirim(res, 200, pesan, hasil);
  } catch (err) {
    return tanganiError(res, err);
  }
};

// ---------- UPDATE ----------

// PUT /api/items/:id  (ganti seluruh data; nama, kategori, berat wajib)
export const gantiItem = async (req, res) => {
  try {
    const item = await ambilItemAtau404(req, res);
    if (!item) return;

    const data = ambilField(req.body);
    if (await namaSudahAda(data.nama, item._id)) return kirim(res, 409, `Item "${data.nama.trim()}" sudah ada di daftar`);

    item.set({
      nama: data.nama,
      kategori: data.kategori,
      berat: data.berat,
      jumlah: data.jumlah ?? 1,
      prioritas: data.prioritas ?? "penting",
      dikemas: data.dikemas ?? false,
    });
    await item.save();
    return kirim(res, 200, "Item berhasil diperbarui", item);
  } catch (err) {
    return tanganiError(res, err);
  }
};

// PATCH /api/items/:id  (ubah sebagian field)
export const ubahItem = async (req, res) => {
  try {
    const item = await ambilItemAtau404(req, res);
    if (!item) return;

    const data = ambilField(req.body);
    if (Object.keys(data).length === 0) return kirim(res, 400, `Tidak ada field yang diubah. Field yang boleh: ${FIELD_BOLEH.join(", ")}`);
    if (await namaSudahAda(data.nama, item._id)) return kirim(res, 409, `Item "${data.nama.trim()}" sudah ada di daftar`);

    item.set(data);
    await item.save();
    return kirim(res, 200, "Item berhasil diubah", item);
  } catch (err) {
    return tanganiError(res, err);
  }
};

// PATCH /api/items/:id/kemas  (tandai dikemas / batalkan)
export const ubahStatusKemas = async (req, res) => {
  try {
    const item = await ambilItemAtau404(req, res);
    if (!item) return;
    item.dikemas = !item.dikemas;
    await item.save();
    return kirim(res, 200, item.dikemas ? `"${item.nama}" ditandai sudah dikemas` : `"${item.nama}" dikeluarkan dari tas`, item);
  } catch (err) {
    return tanganiError(res, err);
  }
};

// ---------- DELETE ----------

// DELETE /api/items/:id
export const hapusItem = async (req, res) => {
  try {
    const item = await ambilItemAtau404(req, res);
    if (!item) return;
    await item.deleteOne();
    return kirim(res, 200, `Item "${item.nama}" berhasil dihapus`, item);
  } catch (err) {
    return tanganiError(res, err);
  }
};

// DELETE /api/items/opsional/belum-dikemas
export const hapusOpsionalBelumDikemas = async (_req, res) => {
  try {
    const hasil = await Item.deleteMany({ prioritas: "opsional", dikemas: false });
    if (hasil.deletedCount === 0) return kirim(res, 404, "Tidak ada item opsional yang belum dikemas");
    return kirim(res, 200, `${hasil.deletedCount} item opsional yang belum dikemas dihapus`, { deletedCount: hasil.deletedCount });
  } catch (err) {
    return tanganiError(res, err);
  }
};
