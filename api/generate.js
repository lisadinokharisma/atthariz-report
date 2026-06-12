export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    return res.status(200).json({
      status: "ok",
      hasApiKey: !!process.env.ANTHROPIC_API_KEY,
    });
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
  } catch (e) {
    return res.status(400).json({ error: "Body tidak valid: " + e.message });
  }

  const formData = body.formData || body;
  if (!formData || !formData.expertise) {
    return res.status(400).json({ error: "Data form tidak lengkap." });
  }

  const prompt = `Kamu adalah mesin JSON. ATURAN KETAT:
1. Balas HANYA JSON valid, tanpa teks lain
2. Setiap value MAKSIMAL 1-2 kalimat pendek (under 30 kata)
3. JANGAN gunakan newline/enter di dalam value string
4. Array isi singkat, tiap item maks 5-8 kata

DATA KLIEN:
Nama: ${formData.name || "Klien"}
Keahlian: ${formData.expertise || ""}
Konten: ${formData.recentContent || ""}
Produk: ${formData.paidOffer || ""}
FAQ: ${formData.commonQuestion || ""}
Keberatan: ${formData.priceAndObjection || ""}
Top content: ${formData.topContent || ""}
Format: ${formData.contentFormat || ""}, ${formData.postFreq || "3"}/minggu

JSON RESPONSE:
{
  "executiveSummary": {
    "currentReality": "1 kalimat status brand",
    "strategicShift": "dari A ke B",
    "expectedOutcome": "hasil terukur 90 hari"
  },
  "contentCorner": {
    "oversaturated": "topik jenuh",
    "gap": "celah pasar",
    "uniqueAngle": "sudut unik",
    "threeContentPillars": ["pilar1", "pilar2", "pilar3"],
    "whatToCut": "yang dihentikan dan alasan"
  },
  "valueEngine": {
    "valueGap": "value gap singkat",
    "fiveGiveaways": ["aset1", "aset2", "aset3", "aset4", "aset5"],
    "shareableResource": "judul dan format resource viral",
    "thirtyDayCalendar": "minggu1: X, minggu2: Y, minggu3: Z, minggu4: W"
  },
  "offerReArchitecture": {
    "buyerFriction": "keraguan utama",
    "reframedOffer": "positioning baru",
    "structuralShift": "1 perubahan konkret",
    "presentationLanguage": "opening dan closing pitch"
  },
  "shareabilityAndCompounding": {
    "missingTriggers": "3 pemicu yang hilang",
    "repurposingChain": "1 konten jadi 5 aset",
    "neglectedChannel": "platform dan alasan",
    "weeklySystem": "sistem mingguan",
    "ninetyDayMilestone": "hari30: X, hari60: Y, hari90: Z"
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
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await apiResponse.json();

    if (!apiResponse.ok) {
      return res.status(200).json({
        result: JSON.stringify({
          executiveSummary: { currentReality: "API ERROR: " + (data.error?.message || apiResponse.status), strategicShift: "-", expectedOutcome: "-" },
          contentCorner: { oversaturated: "-", gap: "-", uniqueAngle: "-", threeContentPillars: ["-","-","-"], whatToCut: "-" },
          valueEngine: { valueGap: "-", fiveGiveaways: ["-","-","-","-","-"], shareableResource: "-", thirtyDayCalendar: "-" },
          offerReArchitecture: { buyerFriction: "-", reframedOffer: "-", structuralShift: "-", presentationLanguage: "-" },
          shareabilityAndCompounding: { missingTriggers: "-", repurposingChain: "-", neglectedChannel: "-", weeklySystem: "-", ninetyDayMilestone: "-" }
        }),
      });
    }

    let raw = "";
    if (data.content && Array.isArray(data.content)) {
      raw = data.content.map((i) => i.text || "").join("");
    }
    raw = raw.trim();

    // Bersihkan markdown fences
    raw = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    // Cari JSON
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(200).json({
        result: JSON.stringify({
          executiveSummary: { currentReality: "NO JSON FOUND. Raw: " + raw.substring(0, 100), strategicShift: "-", expectedOutcome: "-" },
          contentCorner: { oversaturated: "-", gap: "-", uniqueAngle: "-", threeContentPillars: ["-","-","-"], whatToCut: "-" },
          valueEngine: { valueGap: "-", fiveGiveaways: ["-","-","-","-","-"], shareableResource: "-", thirtyDayCalendar: "-" },
          offerReArchitecture: { buyerFriction: "-", reframedOffer: "-", structuralShift: "-", presentationLanguage: "-" },
          shareabilityAndCompounding: { missingTriggers: "-", repurposingChain: "-", neglectedChannel: "-", weeklySystem: "-", ninetyDayMilestone: "-" }
        }),
      });
    }

    let jsonText = jsonMatch[0];

    // JSON REPAIR: fix common issues
    // 1. Ganti newlines di dalam string values
    jsonText = jsonText.replace(/(?<=: ")([\s\S]*?)(?=")/g, (match) => {
      return match.replace(/\n/g, " ").replace(/\r/g, "");
    });

    // 2. Kalau JSON terpotong, coba tutup brackets
    try {
      JSON.parse(jsonText);
      return res.status(200).json({ result: jsonText });
    } catch (e) {
      // Coba repair: tutup string dan brackets yang belum tertutup
      let repaired = jsonText;

      // Hitung buka/tutup brackets
      const openBraces = (repaired.match(/\{/g) || []).length;
      const closeBraces = (repaired.match(/\}/g) || []).length;
      const openBrackets = (repaired.match(/\[/g) || []).length;
      const closeBrackets = (repaired.match(/\]/g) || []).length;

      // Tutup string yang terbuka kalau karakter terakhir bukan " atau } atau ]
      const lastChar = repaired.trim().slice(-1);
      if (lastChar !== '"' && lastChar !== '}' && lastChar !== ']') {
        repaired += '"';
      }

      // Tutup brackets
      for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += "]";
      for (let i = 0; i < openBraces - closeBraces; i++) repaired += "}";

      try {
        JSON.parse(repaired);
        return res.status(200).json({ result: repaired });
      } catch (e2) {
        // Last resort: tampilkan debug
        return res.status(200).json({
          result: JSON.stringify({
            executiveSummary: { currentReality: "PARSE ERROR: " + e.message, strategicShift: "Last 100 chars: " + jsonText.slice(-100), expectedOutcome: "stop_reason: " + (data.stop_reason || "unknown") },
            contentCorner: { oversaturated: "-", gap: "-", uniqueAngle: "-", threeContentPillars: ["-","-","-"], whatToCut: "-" },
            valueEngine: { valueGap: "-", fiveGiveaways: ["-","-","-","-","-"], shareableResource: "-", thirtyDayCalendar: "-" },
            offerReArchitecture: { buyerFriction: "-", reframedOffer: "-", structuralShift: "-", presentationLanguage: "-" },
            shareabilityAndCompounding: { missingTriggers: "-", repurposingChain: "-", neglectedChannel: "-", weeklySystem: "-", ninetyDayMilestone: "-" }
          }),
        });
      }
    }

  } catch (err) {
    return res.status(200).json({
      result: JSON.stringify({
        executiveSummary: { currentReality: "SERVER ERROR: " + err.message, strategicShift: "-", expectedOutcome: "-" },
        contentCorner: { oversaturated: "-", gap: "-", uniqueAngle: "-", threeContentPillars: ["-","-","-"], whatToCut: "-" },
        valueEngine: { valueGap: "-", fiveGiveaways: ["-","-","-","-","-"], shareableResource: "-", thirtyDayCalendar: "-" },
        offerReArchitecture: { buyerFriction: "-", reframedOffer: "-", structuralShift: "-", presentationLanguage: "-" },
        shareabilityAndCompounding: { missingTriggers: "-", repurposingChain: "-", neglectedChannel: "-", weeklySystem: "-", ninetyDayMilestone: "-" }
      }),
    });
  }
}
