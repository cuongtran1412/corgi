const sharp = require("sharp");

module.exports = async (req, res) => {
  // Chặn method khác ngoài POST
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { imageUrl } = req.body;
  if (!imageUrl) {
    return res.status(400).json({ error: "Missing imageUrl in request body" });
  }

  try {
    // Dùng dynamic import vì node-fetch là ESM
    const fetch = (await import("node-fetch")).default;

    // Tải ảnh từ Dall·E
    const imageRes = await fetch(imageUrl);
    const buffer = await imageRes.buffer();

    // Resize/optimize
    const optimizedBuffer = await sharp(buffer)
      .resize({ width: 1024 })
      .jpeg({ quality: 80 })
      .toBuffer();

    // Upload lên Shopify Files API
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

    const result = await shopifyRes.json();
    const shopifyImageUrl = result?.file?.url;

    if (!shopifyImageUrl) {
      return res.status(500).json({ error: "Shopify upload failed", details: result });
    }

    return res.status(200).json({ shopifyImageUrl });

  } catch (err) {
    console.error("❌ Upload error:", err);
    return res.status(500).json({ error: err.message });
  }
};
