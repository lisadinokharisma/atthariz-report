exports.handler = async function (event, context) {
  console.log("=== FUNCTION CALLED ===");
  console.log("Method:", event.httpMethod);
  console.log("API Key exists:", !!process.env.ANTHROPIC_API_KEY);

  // Test endpoint — buka di browser
  if (event.httpMethod === "GET") {
    const hasKey = !!process.env.ANTHROPIC_API_KEY;
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "ok",
        message: hasKey ? "API Key OK" : "ERROR: API Key MISSING",
        hasApiKey: hasKey,
      }),
    };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed. Use POST." }) };
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    console.error("ERROR: API key tidak ditemukan");
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "API key tidak ditemukan di environment variables." }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Request body tidak valid." }) };
  }

  const { formData } = body;
  if (!formData) {
    return { statusCode: 400, body: JSON.stringify({ error: "Data form tidak ditemukan." }) };
  }

  const prompt = `Analisis data klien dan buat laporan strategi personal brand dalam format JSON SAJA. Tidak ada teks lain.

KLIEN:
Nama: ${formData.name || "Klien"}
Keahlian: ${formData.expertise}
Konten terakhir: ${formData.recentContent}
Produk/jasa: ${formData.paidOffer}
Pertanyaan umum klien: ${formData.commonQuestion}
Harga & keberatan: ${formData.priceAndObjection}
Top content: ${formData.topContent}
Format konten: ${formData.contentFormat}
Posting/minggu: ${formData.postFreq}

JSON RESPONSE (ringkas, spesifik, actionable):
{
  "executiveSummary": {
    "currentReality": "Satu kalimat jujur status brand saat ini",
    "strategicShift": "Pergeseran konkret dari posisi A ke B",
    "expectedOutcome": "Hasil terukur di hari ke-90"
  },
  "contentCorner": {
    "oversaturated": "Topik/area jenuh di niche ini",
    "gap": "Celah pasar spesifik yang bisa dikuasai",
    "uniqueAngle": "Sudut konten unik milikmu",
    "threeContentPillars": ["Pilar 1 ringkas", "Pilar 2 ringkas", "Pilar 3 ringkas"],
    "whatToCut": "Topik/format yang harus dihentikan + alasan"
  },
  "valueEngine": {
    "valueGap": "Apa yang audiens bayar ke orang lain tapi bisa gratis dari kamu",
    "fiveGiveaways": ["Aset 1", "Aset 2", "Aset 3", "Aset 4", "Aset 5"],
    "shareableResource": "Satu resource yang akan viral — judul + format + alasan",
    "thirtyDayCalendar": "Kalender ringkas 30 hari"
  },
  "offerReArchitecture": {
    "buyerFriction": "Risiko & keraguan pembeli utama",
    "reframedOffer": "Penawaran dengan positioning baru",
    "structuralShift": "Satu perubahan konkret (garansi, bonus, NDA, dll)",
    "presentationLanguage": "Opening dan closing pitch siap pakai"
  },
  "shareabilityAndCompounding": {
    "missingTriggers": "3 pemicu shareability yang hilang",
    "repurposingChain": "1 konten → 5+ aset (spesifik untuk formatmu)",
    "neglectedChannel": "1 platform diabaikan + alasan relevan",
    "weeklySystem": "Sistem mingguan realistis",
    "ninetyDayMilestone": "Target konkret hari 30/60/90"
  }
}`;

  try {
    console.log("=== CALLING ANTHROPIC API ===");
    
    // AbortController untuk timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 detik timeout
    
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1200,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    console.log("API Response Status:", response.status);
    const data = await response.json();

    if (!response.ok) {
      console.error("API Error:", data);
      const msg = data.error?.message || JSON.stringify(data);
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: `API Error: ${msg}. Coba lagi dalam 1-2 menit.` }),
      };
    }

    let text = data.content.map((i) => i.text || "").join("");
    text = text.replace(/```json|```/g, "").trim();
    
    // Validate JSON bisa di-parse
    try {
      JSON.parse(text);
    } catch (e) {
      console.error("JSON validation error:", e.message);
      return {
        statusCode: 422,
        body: JSON.stringify({ error: "Response format tidak valid. Coba lagi." }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ result: text }),
    };

  } catch (err) {
    console.error("ERROR:", err.name, err.message);
    
    if (err.name === "AbortError") {
      return {
        statusCode: 504,
        body: JSON.stringify({ 
          error: "Request timeout. API sedang sibuk atau slow network. Coba lagi dalam 1-2 menit atau check koneksi internet." 
        }),
      };
    }
    
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Server error: ${err.message}` }),
    };
  }
};
