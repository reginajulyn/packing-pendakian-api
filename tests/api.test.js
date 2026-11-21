// tests/api.test.js
// Pengujian otomatis semua endpoint memakai node:test (bawaan Node.js, tanpa dependensi tambahan).
//
// PENTING: tes ini TIDAK memerlukan MongoDB. Method model Mongoose (create, find, findById, ...)
// diganti dengan penyimpanan tiruan di memori, sedangkan validasi skema Mongoose, controller,
// route, dan status code tetap yang asli. Pengujian dengan database sungguhan dilakukan lewat Postman.
//
// Jalankan: npm test

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import Item from "../models/Item.js";
import app from "../app.js";

// ---------- Penyimpanan tiruan di memori ----------
const store = new Map();
let dbMati = false;
const cekDb = () => {
  if (dbMati) throw new Error("Database tidak dapat dijangkau (simulasi)");
};

const cocok = (filter) => (doc) =>
  Object.entries(filter).every(([kunci, nilai]) => {
    if (kunci === "_id" && nilai?.$ne !== undefined) return String(doc._id) !== String(nilai.$ne);
    if (nilai && typeof nilai === "object" && "$regex" in nilai) return new RegExp(nilai.$regex, nilai.$options).test(doc[kunci]);
    return doc[kunci] === nilai;
  });

Item.create = async (data) => {
  cekDb();
  const doc = new Item(data);
  await doc.validate();
  doc.createdAt = doc.updatedAt = new Date();
  store.set(String(doc._id), doc);
  return doc;
};
Item.prototype.save = async function () {
  cekDb();
  await this.validate();
  this.updatedAt = new Date();
  store.set(String(this._id), this);
  return this;
};
Item.prototype.deleteOne = async function () {
  cekDb();
  store.delete(String(this._id));
  return { deletedCount: 1 };
};
// Seperti MongoDB sungguhan, setiap pembacaan mengembalikan salinan baru sehingga perubahan
// yang gagal divalidasi (dan tidak disimpan) tidak mengotori data yang tersimpan.
const salin = (doc) => Item.hydrate(doc.toObject());
Item.findById = async (id) => {
  cekDb();
  const doc = store.get(String(id));
  return doc ? salin(doc) : null;
};
Item.exists = async (filter) => {
  cekDb();
  return [...store.values()].some(cocok(filter)) ? { _id: "ada" } : null;
};
Item.deleteMany = async (filter) => {
  cekDb();
  const target = [...store.values()].filter(cocok(filter));
  target.forEach((d) => store.delete(String(d._id)));
  return { deletedCount: target.length };
};
Item.find = (filter = {}) => ({
  urutan: null,
  lean() { this.isLean = true; return this; },
  sort(o) { this.urutan = o; return this; },
  then(resolve, reject) {
    try {
      cekDb();
      let hasil = [...store.values()].filter(cocok(filter));
      if (this.urutan) {
        const [[bidang, arah]] = Object.entries(this.urutan);
        hasil.sort((a, b) => (a[bidang] > b[bidang] ? 1 : a[bidang] < b[bidang] ? -1 : 0) * arah);
      }
      resolve(hasil.map((d) => (this.isLean ? d.toObject() : salin(d))));
    } catch (e) {
      reject(e);
    }
  },
});

// ---------- Helper HTTP ----------
let server;
let base;
before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());
beforeEach(() => {
  store.clear();
  dbMati = false;
});

async function api(method, path, body, rawBody) {
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  return { status: res.status, json: await res.json() };
}

const tenda = { nama: "Tenda dome", kategori: "Tenda & Tidur", berat: 1800, jumlah: 1, prioritas: "wajib" };
const buat = async (data) => (await api("POST", "/api/items", data)).json.data;

// ---------- Tes ----------
describe("Dasar", () => {
  it("GET / mengembalikan 200", async () => {
    const r = await api("GET", "/");
    assert.equal(r.status, 200);
    assert.equal(r.json.success, true);
  });

  it("route tidak dikenal mengembalikan 404", async () => {
    const r = await api("GET", "/api/tidak-ada");
    assert.equal(r.status, 404);
    assert.equal(r.json.success, false);
  });

  it("JSON rusak mengembalikan 400", async () => {
    const r = await api("POST", "/api/items", undefined, "{nama: rusak");
    assert.equal(r.status, 400);
  });

  it("database tidak terjangkau mengembalikan 500", async () => {
    dbMati = true;
    assert.equal((await api("GET", "/api/items")).status, 500);
    assert.equal((await api("POST", "/api/items", tenda)).status, 500);
    assert.equal((await api("GET", "/api/items/ringkasan")).status, 500);
  });
});

describe("CREATE  POST /api/items", () => {
  it("201 dan nilai default terisi, totalBerat dihitung", async () => {
    const r = await api("POST", "/api/items", { nama: "Matras", kategori: "tenda & tidur", berat: 400 });
    assert.equal(r.status, 201);
    assert.equal(r.json.data.jumlah, 1);
    assert.equal(r.json.data.prioritas, "penting");
    assert.equal(r.json.data.dikemas, false);
    assert.equal(r.json.data.totalBerat, 400);
    assert.equal(r.json.data.kategori, "Tenda & Tidur"); // dinormalkan
    assert.ok(r.json.data._id);
  });

  it("totalBerat = berat x jumlah", async () => {
    const r = await api("POST", "/api/items", { ...tenda, nama: "Kaos", berat: 200, jumlah: 3 });
    assert.equal(r.json.data.totalBerat, 600);
  });

  it("400 jika field wajib kosong, dengan daftar errors", async () => {
    const r = await api("POST", "/api/items", {});
    assert.equal(r.status, 400);
    assert.ok(r.json.errors.length >= 3);
  });

  it("400 untuk kategori, berat, jumlah, dan prioritas yang tidak valid", async () => {
    for (const buruk of [
      { kategori: "Mobil" },
      { berat: -5 },
      { berat: 2.5 },
      { berat: "abc" },
      { jumlah: 0 },
      { prioritas: "darurat" },
    ]) {
      const r = await api("POST", "/api/items", { ...tenda, nama: "X", ...buruk });
      assert.equal(r.status, 400, JSON.stringify(buruk));
    }
  });

  it("409 jika nama sudah ada (tidak peka huruf besar/kecil)", async () => {
    await buat(tenda);
    const r = await api("POST", "/api/items", { ...tenda, nama: "TENDA DOME" });
    assert.equal(r.status, 409);
  });

  it("field di luar skema diabaikan", async () => {
    const r = await api("POST", "/api/items", { ...tenda, admin: true, _id: "000000000000000000000000" });
    assert.equal(r.status, 201);
    assert.equal(r.json.data.admin, undefined);
    assert.notEqual(r.json.data._id, "000000000000000000000000");
  });
});

describe("READ  GET /api/items", () => {
  beforeEach(async () => {
    await buat(tenda);
    await buat({ nama: "Jaket", kategori: "Pakaian", berat: 600, prioritas: "wajib", dikemas: true });
    await buat({ nama: "Kamera", kategori: "Lainnya", berat: 500, prioritas: "opsional" });
  });

  it("200 dan count benar", async () => {
    const r = await api("GET", "/api/items");
    assert.equal(r.status, 200);
    assert.equal(r.json.count, 3);
    assert.equal(r.json.data.length, 3);
  });

  it("filter kategori, prioritas, dikemas, dan pencarian nama", async () => {
    assert.equal((await api("GET", "/api/items?kategori=pakaian")).json.count, 1);
    assert.equal((await api("GET", "/api/items?prioritas=wajib")).json.count, 2);
    assert.equal((await api("GET", "/api/items?dikemas=true")).json.count, 1);
    assert.equal((await api("GET", "/api/items?cari=KAM")).json.count, 1);
  });

  it("kombinasi filter bekerja", async () => {
    assert.equal((await api("GET", "/api/items?prioritas=wajib&dikemas=false")).json.count, 1);
  });

  it("pengurutan menaik dan menurun", async () => {
    const naik = (await api("GET", "/api/items?sort=berat")).json.data.map((i) => i.berat);
    const turun = (await api("GET", "/api/items?sort=-berat")).json.data.map((i) => i.berat);
    assert.deepEqual(naik, [500, 600, 1800]);
    assert.deepEqual(turun, [1800, 600, 500]);
  });

  it("400 untuk filter dan sort yang tidak valid", async () => {
    for (const q of ["kategori=Mobil", "prioritas=x", "dikemas=mungkin", "sort=harga"]) {
      assert.equal((await api("GET", `/api/items?${q}`)).status, 400, q);
    }
  });

  it("karakter regex pada pencarian tidak merusak server", async () => {
    const r = await api("GET", "/api/items?cari=(((");
    assert.equal(r.status, 200);
    assert.equal(r.json.count, 0);
  });
});

describe("READ  GET /api/items/:id", () => {
  it("200 jika ada", async () => {
    const item = await buat(tenda);
    const r = await api("GET", `/api/items/${item._id}`);
    assert.equal(r.status, 200);
    assert.equal(r.json.data.nama, "Tenda dome");
  });

  it("404 jika ID valid tetapi tidak ada", async () => {
    assert.equal((await api("GET", "/api/items/64b7f0f0f0f0f0f0f0f0f0f0")).status, 404);
  });

  it("400 jika format ID salah", async () => {
    assert.equal((await api("GET", "/api/items/abc")).status, 400);
  });
});

describe("READ  ringkasan dan saran", () => {
  beforeEach(async () => {
    await buat({ nama: "Tenda", kategori: "Tenda & Tidur", berat: 1800, prioritas: "wajib", dikemas: true });
    await buat({ nama: "Air", kategori: "Makanan & Minuman", berat: 1500, jumlah: 2, prioritas: "wajib" });
    await buat({ nama: "Matras", kategori: "Tenda & Tidur", berat: 400, prioritas: "penting" });
    await buat({ nama: "Kamera", kategori: "Lainnya", berat: 500, prioritas: "opsional" });
    await buat({ nama: "Buku", kategori: "Lainnya", berat: 300, prioritas: "opsional" });
  });

  it("ringkasan menghitung total, dikemas, persen, dan per kategori", async () => {
    const r = await api("GET", "/api/items/ringkasan?batas=5");
    assert.equal(r.status, 200);
    const d = r.json.data;
    assert.equal(d.totalGram, 1800 + 3000 + 400 + 500 + 300);
    assert.equal(d.dikemasGram, 1800);
    assert.equal(d.itemDikemas, 1);
    assert.equal(d.batasGram, 5000);
    assert.equal(d.persenPemakaian, 120);
    assert.equal(d.melebihiBatas, true);
    assert.equal(d.selisihGram, 1000);
    assert.deepEqual(d.perKategori.Lainnya, { jumlahItem: 2, totalGram: 800 });
  });

  it("ringkasan memakai batas bawaan 9 kg jika tanpa parameter", async () => {
    const d = (await api("GET", "/api/items/ringkasan")).json.data;
    assert.equal(d.batasGram, 9000);
    assert.equal(d.melebihiBatas, false);
  });

  it("400 jika batas tidak valid", async () => {
    for (const b of ["abc", "0", "-1", "500"]) {
      assert.equal((await api("GET", `/api/items/ringkasan?batas=${b}`)).status, 400, b);
      assert.equal((await api("GET", `/api/items/saran?batas=${b}`)).status, 400, b);
    }
  });

  it("saran: item opsional dikeluarkan lebih dulu, yang terberat dulu", async () => {
    // total 6000 g, batas 5,8 kg -> cukup keluarkan Kamera (500 g) -> 5500 g
    const r = await api("GET", "/api/items/saran?batas=5.8");
    assert.equal(r.status, 200);
    const d = r.json.data;
    assert.equal(d.perluDikurangi, true);
    assert.deepEqual(d.saran.map((i) => i.nama), ["Kamera"]);
    assert.equal(d.perkiraanBebanGram, 5500);
    assert.equal(d.tercapai, true);
  });

  it("saran: lanjut ke item penting setelah opsional habis, dan tidak pernah item wajib", async () => {
    const dua = (await api("GET", "/api/items/saran?batas=5.2")).json.data;
    assert.deepEqual(dua.saran.map((i) => i.nama), ["Kamera", "Buku"]);
    const tiga = (await api("GET", "/api/items/saran?batas=5")).json.data;
    assert.deepEqual(tiga.saran.map((i) => i.nama), ["Kamera", "Buku", "Matras"]);
    assert.equal(tiga.saran.some((i) => i.prioritas === "wajib"), false);
  });

  it("saran: beban pas di batas dianggap masih aman", async () => {
    const d = (await api("GET", "/api/items/saran?batas=6")).json.data;
    assert.equal(d.perluDikurangi, false);
  });

  it("saran: tercapai=false jika batas mustahil dicapai tanpa membuang item wajib", async () => {
    const d = (await api("GET", "/api/items/saran?batas=1")).json.data;
    assert.equal(d.tercapai, false);
    assert.equal(d.saran.some((i) => i.prioritas === "wajib"), false);
  });

  it("saran: tidak perlu dikurangi jika masih dalam batas", async () => {
    const d = (await api("GET", "/api/items/saran?batas=50")).json.data;
    assert.equal(d.perluDikurangi, false);
    assert.deepEqual(d.saran, []);
  });
});

describe("UPDATE  PUT /api/items/:id", () => {
  it("200 dan mengganti seluruh data (default untuk field yang tidak dikirim)", async () => {
    const item = await buat({ ...tenda, jumlah: 3, dikemas: true });
    const r = await api("PUT", `/api/items/${item._id}`, { nama: "Tenda baru", kategori: "Tenda & Tidur", berat: 1500 });
    assert.equal(r.status, 200);
    assert.equal(r.json.data.nama, "Tenda baru");
    assert.equal(r.json.data.jumlah, 1);
    assert.equal(r.json.data.dikemas, false);
    assert.equal(r.json.data.prioritas, "penting");
  });

  it("400 jika field wajib tidak dikirim", async () => {
    const item = await buat(tenda);
    assert.equal((await api("PUT", `/api/items/${item._id}`, { nama: "Saja" })).status, 400);
  });

  it("404 dan 400 dan 409", async () => {
    assert.equal((await api("PUT", "/api/items/64b7f0f0f0f0f0f0f0f0f0f0", tenda)).status, 404);
    assert.equal((await api("PUT", "/api/items/xyz", tenda)).status, 400);
    const a = await buat(tenda);
    await buat({ ...tenda, nama: "Lain" });
    assert.equal((await api("PUT", `/api/items/${a._id}`, { ...tenda, nama: "lain" })).status, 409);
  });

  it("PUT yang gagal validasi tidak mengubah data yang tersimpan", async () => {
    const item = await buat(tenda);
    assert.equal((await api("PUT", `/api/items/${item._id}`, { nama: "Hanya nama" })).status, 400);
    const sesudah = (await api("GET", `/api/items/${item._id}`)).json.data;
    assert.equal(sesudah.nama, "Tenda dome");
    assert.equal(sesudah.berat, 1800);
    assert.equal((await api("PATCH", `/api/items/${item._id}/kemas`)).status, 200);
  });

  it("boleh menyimpan dengan nama miliknya sendiri", async () => {
    const a = await buat(tenda);
    assert.equal((await api("PUT", `/api/items/${a._id}`, { ...tenda, berat: 1700 })).status, 200);
  });
});

describe("UPDATE  PATCH /api/items/:id", () => {
  it("200 dan hanya field yang dikirim yang berubah", async () => {
    const item = await buat(tenda);
    const r = await api("PATCH", `/api/items/${item._id}`, { berat: 1600 });
    assert.equal(r.status, 200);
    assert.equal(r.json.data.berat, 1600);
    assert.equal(r.json.data.nama, "Tenda dome");
  });

  it("400 jika body kosong atau nilai tidak valid, 404 jika tidak ada, 409 jika nama kembar", async () => {
    const a = await buat(tenda);
    await buat({ ...tenda, nama: "Lain" });
    assert.equal((await api("PATCH", `/api/items/${a._id}`, {})).status, 400);
    assert.equal((await api("PATCH", `/api/items/${a._id}`, { berat: 0 })).status, 400);
    assert.equal((await api("PATCH", "/api/items/64b7f0f0f0f0f0f0f0f0f0f0", { berat: 5 })).status, 404);
    assert.equal((await api("PATCH", `/api/items/${a._id}`, { nama: "Lain" })).status, 409);
  });
});

describe("UPDATE  PATCH /api/items/:id/kemas", () => {
  it("menukar status dikemas bolak-balik", async () => {
    const item = await buat(tenda);
    const satu = await api("PATCH", `/api/items/${item._id}/kemas`);
    const dua = await api("PATCH", `/api/items/${item._id}/kemas`);
    assert.equal(satu.json.data.dikemas, true);
    assert.equal(dua.json.data.dikemas, false);
    assert.equal((await api("PATCH", "/api/items/64b7f0f0f0f0f0f0f0f0f0f0/kemas")).status, 404);
  });
});

describe("DELETE", () => {
  it("DELETE /api/items/:id mengembalikan 200 lalu item hilang (404)", async () => {
    const item = await buat(tenda);
    assert.equal((await api("DELETE", `/api/items/${item._id}`)).status, 200);
    assert.equal((await api("GET", `/api/items/${item._id}`)).status, 404);
    assert.equal((await api("DELETE", `/api/items/${item._id}`)).status, 404);
    assert.equal((await api("DELETE", "/api/items/abc")).status, 400);
  });

  it("DELETE /api/items/opsional/belum-dikemas hanya menghapus opsional yang belum dikemas", async () => {
    await buat({ ...tenda, nama: "A", prioritas: "opsional" });
    await buat({ ...tenda, nama: "B", prioritas: "opsional", dikemas: true });
    await buat({ ...tenda, nama: "C", prioritas: "wajib" });
    const r = await api("DELETE", "/api/items/opsional/belum-dikemas");
    assert.equal(r.status, 200);
    assert.equal(r.json.data.deletedCount, 1);
    assert.equal((await api("GET", "/api/items")).json.count, 2);
    assert.equal((await api("DELETE", "/api/items/opsional/belum-dikemas")).status, 404);
  });
});
