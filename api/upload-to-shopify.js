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
    // Fetch ảnh AI DALL·E với User-Agent giả lập trình duyệt
    const imageRes = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    if (!imageRes.ok) {
      console.error("❌ Failed to fetch image:", imageRes.status);
      return res.status(500).json({ error: "Failed to fetch image from DALL·E" });
    }

    const arrayBuffer = await imageRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log("✅ Original image buffer size:", buffer.length);
    if (buffer.length === 0) {
      console.error("❌ Empty image buffer received");
      return res.status(500).json({ error: "Image buffer is empty" });
    }

    const optimizedBuffer = await sharp(buffer)
      .resize({ width: 1024 }) // resize nếu ảnh lớn
      .jpeg({ quality: 80 })   // nén nhẹ
      .toBuffer();

    console.log("✅ Optimized image buffer size:", optimizedBuffer.length);
    const base64Image = optimizedBuffer.toString("base64");

    const shopifyRes = await fetch(`https://${process.env.SHOPIFY_STORE}/admin/api/2024-01/files.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN
      },
      body: JSON.stringify({
        file: {
          attachment: base64Image,
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
    const files = uploaded?.files;
    if (!files || files.length === 0) {
      console.error("❌ No file returned from Shopify", uploaded);
      return res.status(500).json({ error: "No file returned from Shopify" });
    }

    const shopifyImageUrl = files[0].url;
    console.log("✅ Upload success:", shopifyImageUrl);

    return res.status(200).json({ shopifyImageUrl });

  } catch (err) {
    console.error("❌ Upload error:", err);
    return res.status(500).json({ error: err.message });
  }
};
