const fetch = require('node-fetch');

module.exports = async (req, res) => {
  const { imageUrl, fileName = 'ai-image.png' } = req.body;

  if (!imageUrl) {
    return res.status(400).json({ error: 'Missing imageUrl' });
  }

  try {
    // Lấy ảnh từ DALL·E link
    const imageResponse = await fetch(imageUrl);
    const buffer = await imageResponse.buffer();
    const base64Image = buffer.toString('base64');

    // Tạo mutation GraphQL để upload file vào Shopify
    const mutation = `
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

    const shopifyResponse = await fetch(`https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2023-07/graphql.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: mutation,
        variables: {
          files: [
            {
              originalSource: `data:image/png;base64,${base64Image}`,
              contentType: 'IMAGE',
              filename: fileName,
            },
          ],
        },
      }),
    });

    const result = await shopifyResponse.json();
    const uploadedUrl = result.data?.fileCreate?.files?.[0]?.url;

    if (!uploadedUrl) {
      return res.status(500).json({ error: 'Failed to upload image', details: result });
    }

    return res.status(200).json({ shopifyImageUrl: uploadedUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
};
