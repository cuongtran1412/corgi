const { OpenAI } = require("openai");
const axios = require("axios");
const FormData = require("form-data");
const sharp = require("sharp");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ message: "Only POST requests allowed" });

  const { text = "" } = req.body;

  if (!text) {
    return res.status(400).json({ error: "Missing required field: text." });
  }

  const prompt = buildPrompt(text);

  try {
    // 1. Generate DALL·E image
    const image = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      size: "1024x1792",
    });

    const imageUrl = image.data[0].url;

    // 2. Download image
    const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
    const fullImage = Buffer.from(response.data);

    // 3. Crop from 1024x1792 → 1024x1536 (centered)
    const croppedBuffer = await sharp(fullImage)
      .extract({ left: 0, top: 128, width: 1024, height: 1536 })
      .toBuffer();

    // 4. Upload to Cloudinary
    const uploadedUrl = await uploadToCloudinary(croppedBuffer);

    res.status(200).json({ imageUrl: uploadedUrl, prompt });
  } catch (error) {
    console.error("❌ Error:", error?.message || error);
    res.status(500).json({ error: "Failed to generate or upload image." });
  }
};

// 🧠 Prompt builder
function buildPrompt(text) {
  return `
A seamless repeating pattern of tiny ${text}, distributed with natural variation.  
Flat vector illustration, bold lines, high contrast.  
No shading, gradients, or props. For fabric printing.
`;
}

// ☁️ Upload buffer lên Cloudinary
async function uploadToCloudinary(imageBuffer) {
  const cloudinaryUrl = "https://api.cloudinary.com/v1_1/dv3wx2mvi/image/upload";
  const formData = new FormData();
  formData.append("file", imageBuffer, { filename: "pattern-1024x1536.png" });
  formData.append("upload_preset", "ml_default");

  const response = await axios.post(cloudinaryUrl, formData, {
    headers: formData.getHeaders(),
  });

  return response.data.secure_url;
}
