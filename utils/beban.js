// utils/beban.js
// Fungsi murni untuk menghitung beban tas (tanpa akses database, mudah diuji).

export const totalBerat = (item) => item.berat * item.jumlah;
const jumlahGram = (items) => items.reduce((sum, i) => sum + totalBerat(i), 0);

export function hitungRingkasan(items, batasGram) {
  const total = jumlahGram(items);
  const dikemas = jumlahGram(items.filter((i) => i.dikemas));

  const perKategori = {};
  for (const i of items) {
    perKategori[i.kategori] ??= { jumlahItem: 0, totalGram: 0 };
    perKategori[i.kategori].jumlahItem += 1;
    perKategori[i.kategori].totalGram += totalBerat(i);
  }

  return {
    jumlahItem: items.length,
    itemDikemas: items.filter((i) => i.dikemas).length,
    totalGram: total,
    dikemasGram: dikemas,
    belumDikemasGram: total - dikemas,
    batasGram,
    persenPemakaian: Math.round((total / batasGram) * 100),
    melebihiBatas: total > batasGram,
    selisihGram: Math.abs(total - batasGram),
    perKategori,
  };
}

// Saran pengurangan beban: item "wajib" tidak pernah disarankan dibuang.
// Urutan: opsional dulu, lalu penting; dalam prioritas yang sama, yang terberat didahulukan.
export function hitungSaran(items, batasGram) {
  const total = jumlahGram(items);
  if (total <= batasGram) {
    return { perluDikurangi: false, tercapai: true, saran: [], perkiraanBebanGram: total, batasGram };
  }

  const urutan = { opsional: 0, penting: 1 };
  const kandidat = items
    .filter((i) => i.prioritas !== "wajib")
    .sort((a, b) => urutan[a.prioritas] - urutan[b.prioritas] || totalBerat(b) - totalBerat(a));

  let sisa = total;
  const saran = [];
  for (const item of kandidat) {
    if (sisa <= batasGram) break;
    saran.push(item);
    sisa -= totalBerat(item);
  }

  return { perluDikurangi: true, tercapai: sisa <= batasGram, saran, perkiraanBebanGram: sisa, batasGram };
}
