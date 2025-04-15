const sharp = require("sharp");
const fetch = require("node-fetch");

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { imageUrl } = req.body;

  try {
    // 1. Fetch ảnh từ Dall·E URL
    const imageRes = await fetch(imageUrl);
    const buffer = await imageRes.buffer();

    // 2. Resize & optimize nếu cần
    const optimizedBuffer = await sharp(buffer)
      .resize({ width: 1024 })
      .toFormat("jpeg")
      .toBuffer();

    // 3. Upload lên Shopify Files API
    const shopifyRes = await fetch(`https://${process.env.SHOPIFY_STORE}/admin/api/2024-01/files.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_TOKEN
      },
      body: JSON.stringify({
        file: {
          attachment: optimizedBuffer.toString('base64'),
          filename: `dog-ai-${Date.now()}.jpg`,
          mime_type: "image/jpeg"
        }
      })
    });

    const uploaded = await shopifyRes.json();
    const shopifyImageUrl = uploaded?.file?.url;

    return res.status(200).json({ shopifyImageUrl });
  } catch (err) {
    console.error("Upload error:", err);
    return res.status(500).json({ error: err.message });
  }
}
