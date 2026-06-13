export const config = { maxDuration: 60 };

async function sendLeadEmail(formData) {
  const GMAIL_USER = process.env.GMAIL_USER;
  const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
  const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || "attharizkproject@gmail.com";
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) return;
  try {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.default.createTransport({
      service: "gmail",
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    });
    await transporter.sendMail({
      from: `"Atthariz Lead" <${GMAIL_USER}>`,
      to: NOTIFY_EMAIL,
      subject: `🔔 Lead Baru: ${formData.name || "Anonymous"} — ${new Date().toLocaleDateString("id-ID")}`,
      text: `LEAD BARU\n\nNama: ${formData.name||"-"}\nWA: ${formData.whatsapp||"-"}\nEmail: ${formData.email||"-"}\n\nKeahlian: ${formData.expertise||"-"}\nProduk: ${formData.paidOffer||"-"}\nFormat: ${formData.contentFormat||"-"} ${formData.postFreq||"-"}x/minggu\nWaktu: ${new Date().toLocaleString("id-ID",{timeZone:"Asia/Jakarta"})} WIB`,
    });
  } catch(e) { /* silent fail */ }
}

function isSubscriber(token) {
  const validTokens = (process.env.SUBSCRIBER_TOKENS || "").split(",").map(t => t.trim()).filter(Boolean);
  return validTokens.includes(token);
}

function cleanJSON(raw) {
  raw = raw.replace(/```json/g,"").replace(/```/g,"").trim();
  raw = raw.replace(/\r\n/g," ").replace(/\n/g," ").replace(/\r/g," ");
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  const jsonText = raw.substring(start, end + 1);
  try { JSON.parse(jsonText); return jsonText; } catch(e) { return null; }
}

async function callClaude(apiKey, prompt) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-opus-4-6",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "API Error " + response.status);
  return data.content.map(i => i.text || "").join("");
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method === "GET") return res.status(200).json({ status: "ok", hasApiKey: !!process.env.ANTHROPIC_API_KEY });
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const KEY = process.env.ANTHROPIC_API_KEY;
  if (!KEY) return res.status(500).json({ error: "API key tidak ditemukan." });

  let body;
  try { body = typeof req.body === "string" ? JSON.parse(req.body) : req.body; }
  catch(e) { return res.status(400).json({ error: "Body tidak valid." }); }

  const formData = body.formData || body;
  if (!formData?.expertise) return res.status(400).json({ error: "Data form tidak lengkap." });

  const subscriberToken = formData.subscriberToken || "";
  const isPro = isSubscriber(subscriberToken);

  sendLeadEmail({...formData, isPro}).catch(()=>{});

  const ctx = `Nama=${formData.name||"Klien"} | WA=${formData.whatsapp||"-"} | Email=${formData.email||"-"}
Keahlian & Target: ${formData.expertise||""}
Konten Terakhir: ${formData.recentContent||""}
Produk+Harga: ${formData.paidOffer||""}
FAQ Calon Klien: ${formData.commonQuestion||""}
Keberatan Harga: ${formData.priceAndObjection||""}
Top Content: ${formData.topContent||""}
Format: ${formData.contentFormat||""} ${formData.postFreq||3}x/minggu`;

  // PROMPT 1: Core strategy (McKinsey + Hormozi framing)
  const prompt1 = `Kamu adalah konsultan BCG + McKinsey dengan mindset Alex Hormozi. Output HANYA JSON valid satu baris. DILARANG newline di dalam string value. Semua string max 20 kata. Array item max 8 kata.

FRAMEWORK WAJIB:
- McKinsey: setiap insight harus ada SO WHAT-nya (implikasi bisnis konkret, bukan observasi)
- BCG: sertakan angka benchmark niche yang realistis
- Hormozi: framing pain-first, bukan aspirational. Buat orang takut TIDAK bergerak.

DATA KLIEN:
${ctx}

JSON (isi semua field, spesifik ke klien, WAJIB pain-first dan ada angka):
{"executiveSummary":{"currentReality":"observasi situasi brand sekarang yg menyakitkan","soWhat":"implikasi bisnis jika tidak berubah dalam 30 hari — pakai angka","strategicShift":"pergeseran spesifik dari posisi A ke B","expectedOutcome":"target terukur hari ke-90 dengan angka (follower/revenue/klien)","urgencyFrame":"kenapa kompetitor akan ambil posisimu jika kamu diam 60 hari lagi"},"contentCorner":{"oversaturated":"topik jenuh di niche ini dengan estimasi % kreator yg melakukannya","gap":"celah spesifik yg belum diisi kompetitor","uniqueAngle":"positioning unik yg tidak bisa di-copy kompetitor dalam 3 bulan","competitorBlindspot":"apa yg kompetitor tidak lakukan padahal harusnya dilakukan","threeContentPillars":["pilar1 + kenapa","pilar2 + kenapa","pilar3 + kenapa"],"whatToCut":"yg harus dihentikan minggu ini + alasan bisnis konkret"},"valueEngine":{"valueGap":"gap antara apa yg audiens mau bayar vs yg kamu tawarkan sekarang","fiveGiveaways":["aset1 format spesifik","aset2 format spesifik","aset3 format spesifik","aset4 format spesifik","aset5 format spesifik"],"shareableResource":"1 resource viral — judul + format + alasan psikologis kenapa dishare","grandSlamOffer":"penawaran irresistible ala Hormozi: bundle value + garansi + urgency"},"offerReArchitecture":{"buyerFriction":"keraguan spesifik pembeli + akar psikologisnya","reframedOffer":"penawaran direkonstruksi dengan bahasa outcomes bukan fitur","structuralShift":"1 perubahan konkret yg langsung naikan perceived value","presentationLanguage":"opening pitch 1 kalimat yg bikin orang stop scroll","closingTrigger":"closing 1 kalimat yg bikin susah bilang tidak — pakai loss aversion"}}`;

  // PROMPT 2: Compounding + Calendar (full detail)
  const prompt2 = `Kamu adalah content strategist dan growth hacker. Output HANYA JSON valid satu baris. DILARANG newline di dalam string value. String max 20 kata. Array item max 10 kata.

DATA KLIEN:
${ctx}

JSON (isi SEMUA field detail, spesifik ke klien):
{"compoundingSystem":{"hookExamples":["hook kontroversial 1 yg bikin stop scroll — spesifik ke niche klien","hook kontroversial 2 yg bikin stop scroll","hook kontroversial 3 yg bikin stop scroll"],"patternInterruptExamples":["pattern interrupt 1 — buka dengan fakta mengejutkan","pattern interrupt 2 — buka dengan pertanyaan yg menyakitkan","pattern interrupt 3 — buka dengan statistik yg counterintuitive"],"curiosityLoopExamples":["curiosity loop 1 — bikin orang penasaran di slide pertama","curiosity loop 2 — open loop yg baru terjawab di akhir","curiosity loop 3 — teaser yg bikin orang komen nanya"],"repurposingChain":"1 video 10 menit jadi: carousel 5 slide + thread Twitter + caption IG + clip 30 detik + artikel blog","neglectedChannel":"platform spesifik yg underutilized di niche ini + alasan growth-nya 3x lebih cepat","weeklySystem":"Senin: X, Selasa: Y, Rabu: Z, Kamis: W, Jumat: V — sistem realistis"},"growthCalendar":{"week1":{"theme":"tema minggu 1 + tujuan strategis","posts":[{"day":"Senin","type":"format konten","hook":"hook spesifik siap pakai","platform":"platform utama"},{"day":"Rabu","type":"format konten","hook":"hook spesifik siap pakai","platform":"platform utama"},{"day":"Jumat","type":"format konten","hook":"hook spesifik siap pakai","platform":"platform utama"}]},"week2":{"theme":"tema minggu 2 + tujuan strategis","posts":[{"day":"Selasa","type":"format konten","hook":"hook spesifik siap pakai","platform":"platform utama"},{"day":"Kamis","type":"format konten","hook":"hook spesifik siap pakai","platform":"platform utama"},{"day":"Sabtu","type":"format konten","hook":"hook spesifik siap pakai","platform":"platform utama"}]},"week3":{"theme":"tema minggu 3 + tujuan strategis","posts":[{"day":"Senin","type":"format konten","hook":"hook spesifik siap pakai","platform":"platform utama"},{"day":"Rabu","type":"format konten","hook":"hook spesifik siap pakai","platform":"platform utama"},{"day":"Jumat","type":"format konten","hook":"hook spesifik siap pakai","platform":"platform utama"}]},"week4":{"theme":"tema minggu 4 + tujuan strategis","posts":[{"day":"Selasa","type":"format konten","hook":"hook spesifik siap pakai","platform":"platform utama"},{"day":"Kamis","type":"format konten","hook":"hook spesifik siap pakai","platform":"platform utama"},{"day":"Sabtu","type":"format konten","hook":"hook spesifik siap pakai","platform":"platform utama"}]},"day30Checkpoint":"target konkret hari ke-30: follower +X, engagement rate Y%, leads Z orang","kpiToTrack":["kpi1 + target angka","kpi2 + target angka","kpi3 + target angka"]},"cliffhanger":{"whatYouAreMissing":"insight paling berharga yg tidak ada di laporan ini — spesifik ke niche klien","teaser":"1 kalimat yg bikin orang penasaran dan ingin tahu lanjutannya","urgency":"alasan konkret kenapa insight bulan ke-2 lebih krusial — pakai angka atau kompetitor frame"}}`;

  try {
    // Jalankan kedua call secara paralel
    const [raw1, raw2] = await Promise.all([
      callClaude(KEY, prompt1),
      callClaude(KEY, prompt2),
    ]);

    const json1 = cleanJSON(raw1);
    const json2 = cleanJSON(raw2);

    if (!json1 || !json2) {
      return res.status(422).json({ error: "Format tidak valid. Coba lagi." });
    }

    // Merge dua JSON
    const parsed1 = JSON.parse(json1);
    const parsed2 = JSON.parse(json2);
    const merged = { ...parsed1, ...parsed2 };

    return res.status(200).json({ result: JSON.stringify(merged), isPro });

  } catch(err) {
    return res.status(500).json({ error: "Server error: " + err.message });
  }
}
