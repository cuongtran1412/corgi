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
    // Step 1: Fetch and optimize image
    const imageRes = await fetch(imageUrl, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    if (!imageRes.ok) throw new Error("Failed to fetch image");

    const buffer = Buffer.from(await imageRes.arrayBuffer());
    const optimizedBuffer = await sharp(buffer)
      .resize({ width: 1024 })
      .jpeg({ quality: 80 })
      .toBuffer();

    const fileName = `dog-ai-${Date.now()}.jpg`;

    // Step 2: Ask Shopify for staged upload URL
    const stagedUploadMutation = `
      mutation generateStagedUpload($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets {
            url
            resourceUrl
            parameters {
              name
              value
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const stagedUploadRes = await fetch(`https://${process.env.SHOPIFY_STORE}/admin/api/2024-01/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN
      },
      body: JSON.stringify({
        query: stagedUploadMutation,
        variables: {
          input: [
            {
              filename: fileName,
              mimeType: "image/jpeg",
              resource: "FILE",
              fileSize: optimizedBuffer.length.toString()
            }
          ]
        }
      })
    });

    const { data, errors } = await stagedUploadRes.json();
    if (errors || data.stagedUploadsCreate.userErrors.length > 0) {
      throw new Error("Shopify staged upload error: " + JSON.stringify(errors || data.stagedUploadsCreate.userErrors));
    }

    const target = data.stagedUploadsCreate.stagedTargets[0];
    const uploadURL = new URL(target.url);
    const resourceUrl = target.resourceUrl;

    // Step 3: Upload to GCS using raw HTTPS stream
    const form = new FormData();
    target.parameters.forEach(param => {
      form.append(param.name, param.value);
    });
    form.append("file", optimizedBuffer, {
      filename: fileName,
      contentType: "image/jpeg"
    });

    const uploadHeaders = {
      ...form.getHeaders(),
      "X-Goog-Content-SHA256": "UNSIGNED-PAYLOAD"
    };

    const gcsUpload = () =>
      new Promise((resolve, reject) => {
        const req = https.request({
          method: "POST",
          hostname: uploadURL.hostname,
          path: uploadURL.pathname + uploadURL.search,
          headers: uploadHeaders
        }, (res) => {
          let raw = "";
          res.on("data", chunk => raw += chunk);
          res.on("end", () => {
            if (res.statusCode === 204 || res.statusCode === 201) {
              resolve();
            } else {
              console.error("❌ GCS upload failed:", res.statusCode, raw);
              reject(new Error("Upload to GCS failed"));
            }
          });
        });

        req.on("error", reject);
        form.pipe(req);
      });

    await gcsUpload();

    // Step 4: Finalize in Shopify
    const finalizeMutation = `
      mutation fileCreate($files: [FileCreateInput!]!) {
        fileCreate(files: $files) {
          files {
            url
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const finalizeRes = await fetch(`https://${process.env.SHOPIFY_STORE}/admin/api/2024-01/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN
      },
      body: JSON.stringify({
        query: finalizeMutation,
        variables: {
          files: [{ originalSource: resourceUrl, alt: "AI-generated dog image" }]
        }
      })
    });

    const finalizeData = await finalizeRes.json();
    const shopifyImageUrl = finalizeData?.data?.fileCreate?.files?.[0]?.url;

    if (!shopifyImageUrl) throw new Error("❌ Finalize failed: No URL returned");

    return res.status(200).json({ shopifyImageUrl });
  } catch (err) {
    console.error("❌ Final error:", err);
    return res.status(500).json({ error: err.message });
  }
};
