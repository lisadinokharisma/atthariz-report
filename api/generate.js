export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method === "GET") {
    return res.status(200).json({ status: "ok", hasApiKey: !!process.env.ANTHROPIC_API_KEY });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: "API key tidak ditemukan." });

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch (e) {
    return res.status(400).json({ error: "Body tidak valid." });
  }

  const formData = body.formData || body;
  if (!formData || !formData.expertise) {
    return res.status(400).json({ error: "Data form tidak lengkap." });
  }

  const prompt = `Balas HANYA dengan JSON valid satu baris. DILARANG ada newline di dalam string value.

DATA: Nama=${formData.name||"Klien"}, Keahlian=${formData.expertise||""}, Konten=${formData.recentContent||""}, Produk=${formData.paidOffer||""}, FAQ=${formData.commonQuestion||""}, Keberatan=${formData.priceAndObjection||""}, TopContent=${formData.topContent||""}, Format=${formData.contentFormat||""} ${formData.postFreq||3}x/minggu

OUTPUT JSON (setiap string value WAJIB singkat, maks 15 kata, TANPA newline):
{"executiveSummary":{"currentReality":"...","strategicShift":"...","expectedOutcome":"..."},"contentCorner":{"oversaturated":"...","gap":"...","uniqueAngle":"...","threeContentPillars":["...","...","..."],"whatToCut":"..."},"valueEngine":{"valueGap":"...","fiveGiveaways":["...","...","...","...","..."],"shareableResource":"...","thirtyDayCalendar":"..."},"offerReArchitecture":{"buyerFriction":"...","reframedOffer":"...","structuralShift":"...","presentationLanguage":"..."},"shareabilityAndCompounding":{"missingTriggers":"...","repurposingChain":"...","neglectedChannel":"...","weeklySystem":"...","ninetyDayMilestone":"..."}}`;

  try {
    const apiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-6",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await apiResponse.json();

    if (!apiResponse.ok) {
      return res.status(500).json({ error: "API Error: " + (data.error?.message || apiResponse.status) });
    }

    let raw = data.content.map((i) => i.text || "").join("").trim();

    // Bersihkan markdown
    raw = raw.replace(/```json/g, "").replace(/```/g, "").trim();

    // KUNCI: hapus semua newline dan carriage return dari seluruh response
    // Ini aman karena JSON valid tidak butuh newline untuk parse
    raw = raw.replace(/\r\n/g, " ").replace(/\n/g, " ").replace(/\r/g, " ");

    // Cari JSON object
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");

    if (start === -1 || end === -1) {
      return res.status(422).json({ error: "No JSON found. Raw: " + raw.substring(0, 100) });
    }

    const jsonText = raw.substring(start, end + 1);

    try {
      JSON.parse(jsonText);
      return res.status(200).json({ result: jsonText });
    } catch (e) {
      return res.status(422).json({
        error: "Parse gagal: " + e.message,
        position: e.message.match(/position (\d+)/)?.[1],
        context: jsonText.substring(
          Math.max(0, parseInt(e.message.match(/position (\d+)/)?.[1] || 0) - 30),
          parseInt(e.message.match(/position (\d+)/)?.[1] || 0) + 30
        )
      });
    }

  } catch (err) {
    return res.status(500).json({ error: "Server error: " + err.message });
  }
}
