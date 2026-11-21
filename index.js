// index.js
// Titik masuk: memuat .env, menyambung ke MongoDB, lalu menjalankan server.

import "dotenv/config";
import app from "./app.js";
import { connectDB } from "./config/db.js";

const PORT = process.env.PORT || 3000;

try {
  await connectDB();
  app.listen(PORT, () => console.log(`Server berjalan di http://localhost:${PORT}`));
} catch (err) {
  console.error(`Gagal menyambung ke MongoDB: ${err.message}`);
  process.exit(1);
}
