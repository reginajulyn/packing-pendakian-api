// app.js
// Konfigurasi aplikasi Express (middleware, route, penanganan 404 dan error).
// Dipisah dari index.js supaya mudah diuji tanpa menjalankan server.

import express from "express";
import cors from "cors";
import itemRoutes from "./routes/itemRoutes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Packing Pendakian API berjalan",
    endpoints: "/api/items",
  });
});

app.use("/api/items", itemRoutes);

// 404 untuk route yang tidak dikenal
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.originalUrl} tidak ditemukan` });
});

// Penanganan error global (JSON rusak, error tak terduga)
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, message: "Body request bukan JSON yang valid" });
  }
  console.error("[ERROR]", err);
  res.status(500).json({ success: false, message: "Terjadi kesalahan pada server" });
});

export default app;
