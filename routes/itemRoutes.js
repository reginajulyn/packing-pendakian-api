// routes/itemRoutes.js
// Pemetaan URL dan HTTP method ke fungsi controller.
// Route yang statis (ringkasan, saran, opsional/...) harus dideklarasikan sebelum "/:id".

import { Router } from "express";
import {
  buatItem, ambilSemuaItem, ambilItemById, ambilRingkasan, ambilSaran,
  gantiItem, ubahItem, ubahStatusKemas, hapusItem, hapusOpsionalBelumDikemas,
} from "../controllers/itemController.js";

const router = Router();

router.get("/ringkasan", ambilRingkasan);
router.get("/saran", ambilSaran);
router.delete("/opsional/belum-dikemas", hapusOpsionalBelumDikemas);

router.route("/").get(ambilSemuaItem).post(buatItem);
router.route("/:id").get(ambilItemById).put(gantiItem).patch(ubahItem).delete(hapusItem);
router.patch("/:id/kemas", ubahStatusKemas);

export default router;
