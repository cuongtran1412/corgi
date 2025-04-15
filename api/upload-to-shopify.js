const fetch = require("node-fetch");
const sharp = require("sharp");
const https = require("https");
const FormData = require("form-data");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://pawdiprints.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ message: "Only POST requests allowed" });

  const { imageUrl } = req.body;
  if (!imageUrl) return res.status(400).json({ message: "imageUrl is required" });

  try {
    const imageRes = await fetch(imageUrl, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    if (!imageRes.ok) throw new Error("Failed to fetch image");

    const buffer = Buffer.from(await imageRes.arrayBuffer());
    const optimizedBuffer = await sharp(buffer).resize({ width: 1024 }).jpeg({ quality: 80 }).toBuffer();

    // Step 1: Get staged upload target from Shopify
    const filename = `dog-ai-${Date.now()}.jpg`;
    const stagedUploadRes = await fetch(`https://${process.env.SHOPIFY_STORE}/admin/api/2024-01/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN
      },
      body: JSON.stringify({
        query: `
          mutation generateStagedUpload($input: [StagedUploadInput!]!) {
            stagedUploadsCreate(input: $input) {
              stagedTargets {
                url
                resourceUrl
                parameters { name value }
              }
              userErrors { field message }
            }
          }
        `,
        variables: {
          input: [{
            filename,
            mimeType: "image/jpeg",
            resource: "FILE",
            fileSize: optimizedBuffer.length.toString()
          }]
        }
      })
    });

    const stagedData = await stagedUploadRes.json();
    const target = stagedData.data.stagedUploadsCreate.stagedTargets[0];
    const uploadURL = new URL(target.url);
    const params = target.parameters;

    // Step 2: Upload to Shopify's GCS
    const form = new FormData();
    params.forEach(p => form.append(p.name, p.value));
    form.append("file", optimizedBuffer, { filename, contentType: "image/jpeg" });

    await new Promise((resolve, reject) => {
      const req = https.request({
        method: "POST",
        hostname: uploadURL.hostname,
        path: uploadURL.pathname + uploadURL.search,
        headers: {
          ...form.getHeaders(),
          "X-Goog-Content-SHA256": "UNSIGNED-PAYLOAD"
        }
      }, res => {
        let raw = "";
        res.on("data", chunk => (raw += chunk));
        res.on("end", () => {
          if (res.statusCode === 204 || res.statusCode === 201) {
            resolve();
          } else {
            console.error("❌ GCS upload failed:", res.statusCode, raw);
            reject(new Error("GCS upload failed"));
          }
        });
      });

      req.on("error", err => reject(err));
      form.pipe(req);
    });

    // Step 3: Finalize file on Shopify
    const finalizeRes = await fetch(`https://${process.env.SHOPIFY_STORE}/admin/api/2024-01/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN
      },
      body: JSON.stringify({
        query: `
          mutation fileCreate($files: [FileCreateInput!]!) {
            fileCreate(files: $files) {
              files { url }
              userErrors { field message }
            }
          }
        `,
        variables: {
          files: [{
            originalSource: target.resourceUrl,
            alt: "AI-generated dog image"
          }]
        }
      })
    });

    const finalData = await finalizeRes.json();
    const shopifyImageUrl = finalData.data.fileCreate.files[0]?.url;
    if (!shopifyImageUrl) throw new Error("fileCreate failed");

    return res.status(200).json({ shopifyImageUrl });

  } catch (err) {
    console.error("❌ Final error:", err);
    return res.status(500).json({ error: err.message });
  }
};
