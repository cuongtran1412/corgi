
const sharp = require("sharp");

export default async function handler(req, res) {
  / ✅ Cho phép CORS
  res.setHeader("Access-Control-Allow-Origin", "https://pawdiprints.com"); // hoặc domain cụ thể
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // ✅ Bắt OPTIONS
  if (req.method === "OPTIONS") return res.status(200).end();

  // ✅ Bắt POST
  if (req.method !== "POST") return res.status(405).json({ message: "Only POST requests allowed" });
  // ✅ LOG kiểm tra thật sự có vào handler không
  console.log("🐶 Upload API HIT at:", new Date().toISOString());
  const { imageUrl } = req.body;
  if (!imageUrl) return res.status(400).json({ message: "imageUrl is required" });

  try {
    // 1. Fetch ảnh từ Dall·E
    const imageRes = await fetch(imageUrl);
    const arrayBuffer = await imageRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 2. Dùng Sharp resize & convert JPEG
    const optimizedBuffer = await sharp(buffer)
      .resize({ width: 1024 })
      .jpeg({ quality: 80 })
      .toBuffer();

    // 3. Upload lên Shopify
    const shopifyRes = await fetch(`https://${process.env.SHOPIFY_STORE}/admin/api/2024-01/files.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_TOKEN
      },
      body: JSON.stringify({
        file: {
          attachment: optimizedBuffer.toString("base64"),
          filename: `dog-ai-${Date.now()}.jpg`,
          mime_type: "image/jpeg"
        }
      })
    });

    const raw = await shopifyRes.text(); // Đọc raw response
    if (!shopifyRes.ok) {
      console.error("❌ Shopify upload failed:", shopifyRes.status, raw);
      return res.status(shopifyRes.status).json({ error: raw });
    }

    const uploaded = JSON.parse(raw);
    const shopifyImageUrl = uploaded?.file?.url;

    return res.status(200).json({ shopifyImageUrl });
  } catch (err) {
    console.error("❌ Upload error:", err);
    return res.status(500).json({ error: err.message });
  }
}
