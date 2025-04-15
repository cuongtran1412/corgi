const sharp = require("sharp");
const fetch = require("node-fetch");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://pawdiprints.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ message: "Only POST requests allowed" });

  const { imageUrl } = req.body;
  if (!imageUrl) return res.status(400).json({ message: "imageUrl is required" });

  try {
    const imageRes = await fetch(imageUrl);
    const arrayBuffer = await imageRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const optimizedBuffer = await sharp(buffer)
      .resize({ width: 1024 })
      .jpeg({ quality: 80 })
      .toBuffer();

    const shopifyRes = await fetch(`https://${process.env.SHOPIFY_STORE}/admin/api/2024-01/files.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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

    const raw = await shopifyRes.text();
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
