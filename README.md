# Packing Pendakian API

REST API untuk merencanakan perlengkapan (packing) pendakian: mencatat item, menandai yang sudah dikemas, menghitung total beban tas, dan memberi saran item yang bisa dikurangi saat tas terlalu berat.

Final Project **Study Club Backend Basic** (KSM Veterantech UPNVJ 2026), dikembangkan dari Tugas 1 (aplikasi CRUD terminal).

- **Pembuat:** Regina Juliyanti Manalu
- **Teknologi:** Node.js, ExpressJS 5, MongoDB, Mongoose 9

## Cara menjalankan

Prasyarat: Node.js 18 atau lebih baru, dan MongoDB (lokal atau [MongoDB Atlas](https://www.mongodb.com/atlas)).

```bash
# 1. Clone repositori dan masuk ke foldernya
git clone https://github.com/reginajulyn/packing-pendakian-api.git
cd packing-pendakian-api

# 2. Pasang dependensi
npm install

# 3. Buat file .env dari contoh, lalu isi MONGODB_URI
cp .env.example .env        # Windows (CMD): copy .env.example .env

# 4. (Opsional) isi database dengan 14 data contoh. PERHATIAN: menghapus semua item lama
npm run seed

# 5. Jalankan server
npm start                   # atau: npm run dev (restart otomatis saat file berubah)
```

Server berjalan di `http://localhost:3000`. Isi `.env`:

| Variabel         | Keterangan                  | Contoh                                        |
| ---------------- | --------------------------- | --------------------------------------------- |
| `PORT`           | Port server                 | `3000`                                        |
| `MONGODB_URI`    | Alamat koneksi MongoDB      | `mongodb://127.0.0.1:27017/packing_pendakian` |
| `BATAS_BERAT_KG` | Batas beban tas bawaan (kg) | `9`                                           |

## Struktur folder

```
packing-pendakian-api/
├── config/
│   └── db.js                  # koneksi MongoDB (Mongoose)
├── models/
│   └── Item.js                # skema dan model Item
├── controllers/
│   └── itemController.js      # logika tiap endpoint (async/await + status code)
├── routes/
│   └── itemRoutes.js          # pemetaan URL + HTTP method ke controller
├── utils/
│   └── beban.js               # perhitungan ringkasan dan saran beban
├── scripts/
│   └── seed.js                # data contoh
├── tests/
│   └── api.test.js            # pengujian otomatis (npm test)
├── postman/
│   └── Packing-Pendakian-API.postman_collection.json
├── app.js                     # konfigurasi Express (middleware, route, error handler)
├── index.js                   # titik masuk: koneksi DB lalu menjalankan server
├── .env.example
└── package.json
```

## Model data (Item)

| Field                    | Tipe    | Aturan                                                                                        |
| ------------------------ | ------- | --------------------------------------------------------------------------------------------- |
| `nama`                   | String  | wajib, unik (tidak peka huruf besar/kecil), maks 100 karakter                                 |
| `kategori`               | String  | wajib: `Tenda & Tidur`, `Pakaian`, `Makanan & Minuman`, `Peralatan`, `Keselamatan`, `Lainnya` |
| `berat`                  | Number  | wajib, bilangan bulat 1 sampai 50000 (gram per satuan)                                        |
| `jumlah`                 | Number  | bawaan `1`, bilangan bulat 1 sampai 99                                                        |
| `prioritas`              | String  | bawaan `penting`: `wajib`, `penting`, `opsional`                                              |
| `dikemas`                | Boolean | bawaan `false`                                                                                |
| `totalBerat`             | Number  | dihitung otomatis: `berat x jumlah` (tidak disimpan)                                          |
| `createdAt`, `updatedAt` | Date    | diisi otomatis                                                                                |

## Daftar endpoint

Base URL: `http://localhost:3000`

| Method     | Endpoint                            | Fungsi                                                     | Status sukses |
| ---------- | ----------------------------------- | ---------------------------------------------------------- | ------------- |
| GET        | `/`                                 | Cek server berjalan                                        | 200           |
| **POST**   | `/api/items`                        | **Create** item baru                                       | 201           |
| **GET**    | `/api/items`                        | **Read** semua item (filter dan sort, lihat di bawah)      | 200           |
| **GET**    | `/api/items/:id`                    | **Read** satu item berdasarkan ID                          | 200           |
| GET        | `/api/items/ringkasan`              | Ringkasan beban tas (total, dikemas, persen, per kategori) | 200           |
| GET        | `/api/items/saran`                  | Saran item yang dikeluarkan jika tas melebihi batas        | 200           |
| **PUT**    | `/api/items/:id`                    | **Update** seluruh data item                               | 200           |
| **PATCH**  | `/api/items/:id`                    | **Update** sebagian field                                  | 200           |
| PATCH      | `/api/items/:id/kemas`              | Tandai dikemas atau batalkan (toggle)                      | 200           |
| **DELETE** | `/api/items/:id`                    | **Delete** satu item                                       | 200           |
| DELETE     | `/api/items/opsional/belum-dikemas` | Hapus semua item opsional yang belum dikemas               | 200           |

**Query pada `GET /api/items`:** `kategori`, `prioritas`, `dikemas` (`true`/`false`), `cari` (kata kunci nama), `sort` (`nama`, `kategori`, `berat`, `createdAt`; awali `-` untuk menurun). Contoh: `/api/items?kategori=Peralatan&dikemas=false&sort=-berat`

**Query pada `ringkasan` dan `saran`:** `batas` (kg, opsional). Jika tidak diisi, dipakai `BATAS_BERAT_KG` dari `.env`.

### Contoh request

`POST /api/items`

```json
{
  "nama": "Tenda dome 3 orang",
  "kategori": "Tenda & Tidur",
  "berat": 2200,
  "jumlah": 1,
  "prioritas": "wajib"
}
```

Respons `201 Created`:

```json
{
  "success": true,
  "message": "Item berhasil ditambahkan",
  "data": {
    "_id": "6740a1b2c3d4e5f6a7b8c9d0",
    "nama": "Tenda dome 3 orang",
    "kategori": "Tenda & Tidur",
    "berat": 2200,
    "jumlah": 1,
    "prioritas": "wajib",
    "dikemas": false,
    "createdAt": "2026-11-21T10:00:00.000Z",
    "updatedAt": "2026-11-21T10:00:00.000Z",
    "totalBerat": 2200
  }
}
```

### Format respons dan status code

Semua respons berbentuk JSON dengan `success` dan `message`. Respons daftar menambah `count`, dan respons gagal validasi menambah `errors`.

| Status | Arti                  | Contoh kasus                                                         |
| ------ | --------------------- | -------------------------------------------------------------------- |
| 200    | OK                    | data berhasil dibaca, diubah, atau dihapus                           |
| 201    | Created               | item berhasil dibuat                                                 |
| 400    | Bad Request           | data tidak valid, format ID salah, JSON rusak, parameter query salah |
| 404    | Not Found             | item dengan ID tersebut tidak ada, atau route tidak dikenal          |
| 409    | Conflict              | nama item sudah ada                                                  |
| 500    | Internal Server Error | kesalahan tak terduga di server (misalnya database tidak terjangkau) |

## Pengujian

- **Postman:** impor `postman/Packing-Pendakian-API.postman_collection.json`, pastikan server berjalan, lalu jalankan seluruh koleksi (Run collection). Setiap request sudah berisi tes otomatis untuk status code dan isi respons. Variabel `baseUrl` bawaan: `http://localhost:3000`. Jalankan `npm run seed` terlebih dahulu agar endpoint ringkasan dan saran menampilkan data yang bermakna.
- **Otomatis:** `npm test` menjalankan 37 tes untuk semua endpoint. Tes ini memakai penyimpanan tiruan di memori sehingga tidak memerlukan MongoDB. Pengujian dengan database sungguhan dilakukan lewat Postman.
