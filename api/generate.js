export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    return res.status(200).json({
      status: "ok",
      hasApiKey: !!process.env.ANTHROPIC_API_KEY,
      keyPreview: process.env.ANTHROPIC_API_KEY
        ? process.env.ANTHROPIC_API_KEY.substring(0, 10) + "..."
        : "MISSING",
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "API key tidak ditemukan di environment." });
  }

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch (e) {
    return res.status(400).json({ error: "Body tidak valid: " + e.message });
  }

  const formData = body.formData || body;
  if (!formData || !formData.expertise) {
    return res.status(400).json({
      error: "Data form tidak lengkap.",
      received: JSON.stringify(body).substring(0, 200),
    });
  }

  const prompt = `Kamu adalah mesin JSON. Balas HANYA dengan JSON valid, tanpa teks lain.

DATA KLIEN:
Nama: ${formData.name || "Klien"}
Keahlian: ${formData.expertise || ""}
Konten terakhir: ${formData.recentContent || ""}
Produk/jasa+harga: ${formData.paidOffer || ""}
Pertanyaan umum: ${formData.commonQuestion || ""}
Keberatan harga: ${formData.priceAndObjection || ""}
Top content: ${formData.topContent || ""}
Format+frekuensi: ${formData.contentFormat || ""}, ${formData.postFreq || "3"}/minggu

Balas HANYA JSON berikut (isi setiap field dengan analisis spesifik untuk klien ini):
{
  "executiveSummary": {
    "currentReality": "status brand saat ini",
    "strategicShift": "pergeseran dari A ke B",
    "expectedOutcome": "hasil terukur hari ke-90"
  },
  "contentCorner": {
    "oversaturated": "topik jenuh",
    "gap": "celah pasar",
    "uniqueAngle": "sudut unik",
    "threeContentPillars": ["pilar 1", "pilar 2", "pilar 3"],
    "whatToCut": "yang harus dihentikan"
  },
  "valueEngine": {
    "valueGap": "value gap",
    "fiveGiveaways": ["aset 1", "aset 2", "aset 3", "aset 4", "aset 5"],
    "shareableResource": "resource viral",
    "thirtyDayCalendar": "kalender 30 hari"
  },
  "offerReArchitecture": {
    "buyerFriction": "keraguan pembeli",
    "reframedOffer": "penawaran baru",
    "structuralShift": "perubahan struktur",
    "presentationLanguage": "pitch siap pakai"
  },
  "shareabilityAndCompounding": {
    "missingTriggers": "pemicu yang hilang",
    "repurposingChain": "1 konten jadi 5+",
    "neglectedChannel": "platform diabaikan",
    "weeklySystem": "sistem mingguan",
    "ninetyDayMilestone": "milestone 30/60/90"
  }
}`;

  try {
    const apiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await apiResponse.json();

    // Kalau API error, kirim detail lengkap
    if (!apiResponse.ok) {
      return res.status(200).json({
        result: JSON.stringify({
          executiveSummary: {
            currentReality: "API ERROR: " + (data.error?.message || JSON.stringify(data)),
            strategicShift: "Status: " + apiResponse.status,
            expectedOutcome: "Coba lagi dalam 1 menit"
          },
          contentCorner: { oversaturated: "-", gap: "-", uniqueAngle: "-", threeContentPillars: ["-","-","-"], whatToCut: "-" },
          valueEngine: { valueGap: "-", fiveGiveaways: ["-","-","-","-","-"], shareableResource: "-", thirtyDayCalendar: "-" },
          offerReArchitecture: { buyerFriction: "-", reframedOffer: "-", structuralShift: "-", presentationLanguage: "-" },
          shareabilityAndCompounding: { missingTriggers: "-", repurposingChain: "-", neglectedChannel: "-", weeklySystem: "-", ninetyDayMilestone: "-" }
        }),
      });
    }

    // Ambil teks dari response
    let raw = "";
    if (data.content && Array.isArray(data.content)) {
      raw = data.content.map((i) => i.text || "").join("");
    }
    raw = raw.trim();

    // Bersihkan markdown
    raw = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    // Cari JSON di dalam response
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // Tidak ada JSON — tampilkan apa yang Claude keluarkan
      return res.status(200).json({
        result: JSON.stringify({
          executiveSummary: {
            currentReality: "DEBUG NO JSON: " + raw.substring(0, 150),
            strategicShift: "Raw length: " + raw.length,
            expectedOutcome: "Content blocks: " + (data.content ? data.content.length : 0)
          },
          contentCorner: { oversaturated: "-", gap: "-", uniqueAngle: "-", threeContentPillars: ["-","-","-"], whatToCut: "-" },
          valueEngine: { valueGap: "-", fiveGiveaways: ["-","-","-","-","-"], shareableResource: "-", thirtyDayCalendar: "-" },
          offerReArchitecture: { buyerFriction: "-", reframedOffer: "-", structuralShift: "-", presentationLanguage: "-" },
          shareabilityAndCompounding: { missingTriggers: "-", repurposingChain: "-", neglectedChannel: "-", weeklySystem: "-", ninetyDayMilestone: "-" }
        }),
      });
    }

    const jsonText = jsonMatch[0];

    // Coba parse
    try {
      JSON.parse(jsonText);
      return res.status(200).json({ result: jsonText });
    } catch (e) {
      // JSON ditemukan tapi tidak valid
      return res.status(200).json({
        result: JSON.stringify({
          executiveSummary: {
            currentReality: "DEBUG PARSE ERROR: " + e.message,
            strategicShift: "First 150 chars: " + jsonText.substring(0, 150),
            expectedOutcome: "Coba lagi"
          },
          contentCorner: { oversaturated: "-", gap: "-", uniqueAngle: "-", threeContentPillars: ["-","-","-"], whatToCut: "-" },
          valueEngine: { valueGap: "-", fiveGiveaways: ["-","-","-","-","-"], shareableResource: "-", thirtyDayCalendar: "-" },
          offerReArchitecture: { buyerFriction: "-", reframedOffer: "-", structuralShift: "-", presentationLanguage: "-" },
          shareabilityAndCompounding: { missingTriggers: "-", repurposingChain: "-", neglectedChannel: "-", weeklySystem: "-", ninetyDayMilestone: "-" }
        }),
      });
    }

  } catch (err) {
    return res.status(200).json({
      result: JSON.stringify({
        executiveSummary: {
          currentReality: "SERVER ERROR: " + err.message,
          strategicShift: err.name || "Unknown",
          expectedOutcome: "Coba lagi"
        },
        contentCorner: { oversaturated: "-", gap: "-", uniqueAngle: "-", threeContentPillars: ["-","-","-"], whatToCut: "-" },
        valueEngine: { valueGap: "-", fiveGiveaways: ["-","-","-","-","-"], shareableResource: "-", thirtyDayCalendar: "-" },
        offerReArchitecture: { buyerFriction: "-", reframedOffer: "-", structuralShift: "-", presentationLanguage: "-" },
        shareabilityAndCompounding: { missingTriggers: "-", repurposingChain: "-", neglectedChannel: "-", weeklySystem: "-", ninetyDayMilestone: "-" }
      }),
    });
  }
}
