// ============================================================
// VERCEL — api/generate.js
// ============================================================

export const config = {
  maxDuration: 60,
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

  // Prompt dengan instruksi super ketat — tidak boleh ada teks di luar JSON
  const prompt = `Kamu adalah JSON generator. Output kamu HARUS berupa raw JSON saja.
DILARANG KERAS: teks pembuka, teks penutup, penjelasan, markdown, backtick, komentar.
MULAI response langsung dengan karakter { dan AKHIRI dengan }.

DATA KLIEN:
Nama: ${formData.name || "Klien"}
Keahlian: ${formData.expertise}
Konten terakhir: ${formData.recentContent}
Produk/jasa+harga: ${formData.paidOffer}
Pertanyaan umum: ${formData.commonQuestion}
Keberatan harga: ${formData.priceAndObjection}
Top content: ${formData.topContent}
Format+frekuensi: ${formData.contentFormat}, ${formData.postFreq}/minggu

OUTPUT (raw JSON, tidak ada apapun selain ini):
{
  "executiveSummary": { "currentReality": "isi di sini", "strategicShift": "isi di sini", "expectedOutcome": "isi di sini" },
  "contentCorner": { "oversaturated": "isi di sini", "gap": "isi di sini", "uniqueAngle": "isi di sini", "threeContentPillars": ["isi","isi","isi"], "whatToCut": "isi di sini" },
  "valueEngine": { "valueGap": "isi di sini", "fiveGiveaways": ["isi","isi","isi","isi","isi"], "shareableResource": "isi di sini", "thirtyDayCalendar": "isi di sini" },
  "offerReArchitecture": { "buyerFriction": "isi di sini", "reframedOffer": "isi di sini", "structuralShift": "isi di sini", "presentationLanguage": "isi di sini" },
  "shareabilityAndCompounding": { "missingTriggers": "isi di sini", "repurposingChain": "isi di sini", "neglectedChannel": "isi di sini", "weeklySystem": "isi di sini", "ninetyDayMilestone": "isi di sini" }
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
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1200,
        messages: [
          {
            role: "user",
            content: prompt
          },
          {
            // Paksa model mulai dengan { — teknik "assistant prefill"
            role: "assistant",
            content: "{"
          }
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || "API Error" });
    }

    // Ambil text, tambahkan { di depan karena kita pakai prefill
    let raw = data.content.map((i) => i.text || "").join("").trim();
    let text = "{" + raw;

    // Bersihkan markdown kalau ada
    text = text.replace(/```json|```/g, "").trim();

    // Ekstrak JSON murni — ambil dari { pertama sampai } terakhir
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No JSON found in response:", text.substring(0, 200));
      return res.status(422).json({ error: "Format response tidak valid. Coba lagi." });
    }
    text = jsonMatch[0];

    // Validasi JSON bisa di-parse
    try {
      JSON.parse(text);
    } catch (e) {
      console.error("JSON parse error:", e.message, "| Text:", text.substring(0, 200));
      return res.status(422).json({ error: "Format response tidak valid. Coba lagi." });
    }

    return res.status(200).json({ result: text });

  } catch (err) {
    return res.status(500).json({ error: `Server error: ${err.message}` });
  }
}
