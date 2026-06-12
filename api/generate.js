// ============================================================
// ALTERNATIF 2: Deploy ke Vercel (timeout 60 detik free)
// Simpan file ini sebagai /api/generate.js di project Vercel
// ============================================================

export const config = {
  maxDuration: 60, // Vercel free = 60 detik
};

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ status: "ok", hasApiKey: !!process.env.ANTHROPIC_API_KEY });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "API key tidak ditemukan." });
  }

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: "Request body tidak valid." });
  }

  const { formData } = body;
  if (!formData) return res.status(400).json({ error: "Data form tidak ditemukan." });

  const prompt = `Buat laporan personal brand strategy dalam JSON. Jawab ringkas tapi spesifik.

DATA:
Nama: ${formData.name || "Klien"}
Keahlian: ${formData.expertise}
Konten terakhir: ${formData.recentContent}
Produk/jasa+harga: ${formData.paidOffer}
Pertanyaan umum: ${formData.commonQuestion}
Keberatan harga: ${formData.priceAndObjection}
Top content: ${formData.topContent}
Format+frekuensi: ${formData.contentFormat}, ${formData.postFreq}/minggu

Balas HANYA JSON ini:
{
  "executiveSummary": { "currentReality": "...", "strategicShift": "...", "expectedOutcome": "..." },
  "contentCorner": { "oversaturated": "...", "gap": "...", "uniqueAngle": "...", "threeContentPillars": ["...","...","..."], "whatToCut": "..." },
  "valueEngine": { "valueGap": "...", "fiveGiveaways": ["...","...","...","...","..."], "shareableResource": "...", "thirtyDayCalendar": "..." },
  "offerReArchitecture": { "buyerFriction": "...", "reframedOffer": "...", "structuralShift": "...", "presentationLanguage": "..." },
  "shareabilityAndCompounding": { "missingTriggers": "...", "repurposingChain": "...", "neglectedChannel": "...", "weeklySystem": "...", "ninetyDayMilestone": "..." }
}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6", // Vercel bisa pakai Sonnet karena timeout lebih lama
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || "API Error" });
    }

    let text = data.content.map((i) => i.text || "").join("").replace(/```json|```/g, "").trim();

    try { JSON.parse(text); } catch {
      return res.status(422).json({ error: "Format response tidak valid. Coba lagi." });
    }

    return res.status(200).json({ result: text });

  } catch (err) {
    return res.status(500).json({ error: `Server error: ${err.message}` });
  }
}
