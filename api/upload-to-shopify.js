const fetch = require("node-fetch");
const sharp = require("sharp");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://pawdiprints.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ message: "Only POST requests allowed" });

  const { imageUrl } = req.body;
  if (!imageUrl) return res.status(400).json({ message: "imageUrl is required" });

  try {
    // Fetch original DALL·E image
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

    // Step 1: Request staged upload
    const mutation = `
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
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_TOKEN
      },
      body: JSON.stringify({
        query: mutation,
        variables: {
          input: [
            {
              filename: `dog-ai-${Date.now()}.jpg`,
              mimeType: "image/jpeg",
              resource: "FILE",
              fileSize: optimizedBuffer.length
            }
          ]
        }
      })
    });

    const { data, errors } = await stagedUploadRes.json();
    if (errors) throw new Error(JSON.stringify(errors));

    const target = data.stagedUploadsCreate.stagedTargets[0];
    const uploadURL = target.url;
    const uploadParams = target.parameters.reduce((acc, param) => {
      acc[param.name] = param.value;
      return acc;
    }, {});

    // Step 2: Upload binary to S3 URL
    const FormData = require('form-data');
    const form = new FormData();
    for (const key in uploadParams) {
      form.append(key, uploadParams[key]);
    }
    form.append('file', optimizedBuffer, {
      filename: `dog-ai-${Date.now()}.jpg`,
      contentType: 'image/jpeg'
    });

    const uploadRes = await fetch(uploadURL, {
      method: 'POST',
      body: form
    });

    if (!uploadRes.ok) throw new Error("Upload to S3 failed");

    // Step 3: Create file in Shopify
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
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_TOKEN
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
