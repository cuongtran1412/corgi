const sharp = require("sharp");

module.exports = async (req, res) => {
  const fetch = (await import('node-fetch')).default;

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ message: "Method Not Allowed" });

  const { imageUrl } = req.body;

  try {
    const imageRes = await fetch(imageUrl);
    const arrayBuffer = await imageRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const optimizedBuffer = await sharp(buffer)
      .resize({ width: 1024 })
      .toFormat("jpeg")
      .toBuffer();

    const shopifyRes = await fetch(
      `https://${process.env.SHOPIFY_STORE}/admin/api/2024-01/files.json`,
      {
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
      }
    );

    const text = await shopifyRes.text();
    if (!shopifyRes.ok) {
      console.error("❌ Shopify upload failed:", text);
      return res.status(500).json({ error: 'Upload to Shopify failed', details: text });
    }

    const uploaded = JSON.parse(text);
    const shopifyImageUrl = uploaded?.file?.url;

    res.status(200).json({ shopifyImageUrl });
  } catch (err) {
    console.error("❌ Upload error:", err);
    res.status(500).json({ error: err.message });
  }
};
