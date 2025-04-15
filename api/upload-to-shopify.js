const fetch = require("node-fetch");
const sharp = require("sharp");
const { request } = require("undici");
const { FormData } = require("formdata-node");
const { fileFromBuffer } = require("formdata-node/file-from-buffer");
const { FormDataEncoder } = require("form-data-encoder");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://pawdiprints.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ message: "Only POST requests allowed" });

  const { imageUrl } = req.body;
  if (!imageUrl) return res.status(400).json({ message: "imageUrl is required" });

  try {
    // Step 1: Download and optimize image
    const imageRes = await fetch(imageUrl, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    if (!imageRes.ok) throw new Error("Failed to fetch image");

    const arrayBuffer = await imageRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const optimizedBuffer = await sharp(buffer)
      .resize({ width: 1024 })
      .jpeg({ quality: 80 })
      .toBuffer();

    // Step 2: Get staged upload target
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
    const uploadURL = target.url;
    const parameters = target.parameters;

    // Step 3: Upload to GCS using undici + formdata-node
    const form = new FormData();
    parameters.forEach(param => {
      form.append(param.name, param.value);
    });
    form.append("file", await fileFromBuffer(optimizedBuffer, `dog-ai-${Date.now()}.jpg`, "image/jpeg"));

    const encoder = new FormDataEncoder(form);
    const uploadRes = await request(uploadURL, {
      method: "POST",
      headers: {
        ...encoder.headers,
        "X-Goog-Content-SHA256": "UNSIGNED-PAYLOAD"
      },
      body: encoder.encode()
    });

    const status = uploadRes.statusCode;
    const bodyText = await uploadRes.body.text();

    if (status !== 204 && status !== 201) {
      console.error("❌ GCS upload failed:", status, bodyText);
      throw new Error("Upload to GCS failed");
    }

    // Step 4: Register file in Shopify
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
          files: [
            {
              originalSource: target.resourceUrl,
              alt: "AI-generated dog image"
            }
          ]
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
