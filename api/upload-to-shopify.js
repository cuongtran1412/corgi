const fetch = require("node-fetch");
const sharp = require("sharp");
const https = require("https");
const { FormData } = require("formdata-node");
const { Readable } = require("stream");
const { Blob } = require("buffer");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://pawdiprints.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ message: "Only POST requests allowed" });

  const { imageUrl } = req.body;
  if (!imageUrl) return res.status(400).json({ message: "imageUrl is required" });

  try {
    const imageRes = await fetch(imageUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!imageRes.ok) throw new Error("Failed to fetch image");

    const arrayBuffer = await imageRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const optimizedBuffer = await sharp(buffer)
      .resize({ width: 1024 })
      .jpeg({ quality: 80 })
      .toBuffer();

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
              filename: `dog-ai-${Date.now()}.jpg`,
              mimeType: "image/jpeg",
              resource: "FILE",
              fileSize: optimizedBuffer.length.toString()
            }
          ]
        }
      })
    });

    const { data, errors } = await stagedUploadRes.json();
    if (errors) throw new Error(JSON.stringify(errors));

    const target = data.stagedUploadsCreate.stagedTargets[0];
    const uploadURL = new URL(target.url);
    const params = target.parameters;

    const form = new FormData();
    for (const p of params) {
      form.append(p.name, p.value);
    }

    const blob = new Blob([optimizedBuffer], { type: "image/jpeg" });
    form.append("file", blob, `dog-ai-${Date.now()}.jpg`);

    const boundary = form._boundary;
    const requestOptions = {
      method: "POST",
      hostname: uploadURL.hostname,
      path: uploadURL.pathname + uploadURL.search,
      headers: {
        ...form.headers,
        "X-Goog-Content-SHA256": "UNSIGNED-PAYLOAD"
        // KHÔNG GỬI Content-Length
      }
    };

    await new Promise((resolve, reject) => {
      const req = https.request(requestOptions, (res2) => {
        let body = "";
        res2.on("data", chunk => body += chunk);
        res2.on("end", () => {
          if (res2.statusCode !== 204 && res2.statusCode !== 201) {
            console.error("❌ GCS upload failed:", res2.statusCode, body);
            return reject(new Error("Upload to GCS failed"));
          }
          resolve();
        });
      });

      req.on("error", reject);
      Readable.from(form).pipe(req);
    });

    // Register file
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
          files: [{ originalSource: target.resourceUrl, alt: "AI-generated dog image" }]
        }
      })
    });

    const finalizeData = await finalizeRes.json();
    const shopifyImageUrl = finalizeData?.data?.fileCreate?.files?.[0]?.url;
    if (!shopifyImageUrl) throw new Error("Shopify fileCreate failed");

    return res.status(200).json({ shopifyImageUrl });

  } catch (err) {
    console.error("❌ Final error:", err);
    return res.status(500).json({ error: err.message });
  }
};
