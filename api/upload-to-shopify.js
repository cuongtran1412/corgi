import sharp from "sharp";
import fetch from "node-fetch";

export const config = {
  api: {
    bodyParser: true,
  },
};

export default async function handler(req, res) {
  // Cho phép preflight request (CORS OPTIONS)
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { imageUrl } = req.body;

  if (!imageUrl) return res.status(400).json({ error: "Missing imageUrl" });

  try {
    const response = await fetch(imageUrl);
    const buffer = await response.buffer();

    const optimizedBuffer = await sharp(buffer)
      .resize({ width: 1024 })
      .jpeg({ quality: 80 })
      .toBuffer();

    const base64Image = optimizedBuffer.toString("base64");

    const shopifyRes = await fetch(`https://${process.env.SHOPIFY_STORE}/admin/api/2024-01/files.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_TOKEN
      },
      body: JSON.stringify({
        file: {
          attachment: base64Image,
          filename: `dog-ai-${Date.now()}.jpg`,
          mime_type: "image/jpeg"
        }
      })
    });

    const shopifyData = await shopifyRes.json();
    const shopifyImageUrl = shopifyData?.file?.url;

    if (!shopifyImageUrl) {
      return res.status(500).json({ error: "Upload failed", details: shopifyData });
    }

    res.status(200).json({ shopifyImageUrl });
  } catch (err) {
    console.error("❌ Upload error:", err);
    res.status(500).json({ error: err.message });
  }
}
