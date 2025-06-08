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

  const { text = "", designStyle = "", colorMood = "", detailLevel = "" } = req.body;

  if (!text || !designStyle || !colorMood || !detailLevel) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  const prompt = buildPrompt({ text, designStyle, colorMood, detailLevel });

  try {
    // 1. Generate image with DALL·E
    const image = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      size: "1024x1024",
    });

    const imageUrl = image.data[0].url;

    // 2. Download & mirror tile to fix seam
    const tileBuffer = await mirrorTileImage(imageUrl);

    // 3. Upload to Cloudinary
    const cloudinaryUpload = await uploadToCloudinary(tileBuffer);

    res.status(200).json({ imageUrl: cloudinaryUpload, prompt });
  } catch (error) {
    console.error("❌ Error:", error);
    res.status(500).json({ error: error.message });
  }
};

// 🧠 Prompt builder
function buildPrompt({ text, designStyle, colorMood, detailLevel }) {
  return `
A seamless, repeating pattern of ${text}, in ${designStyle} style, with ${colorMood} tones.
The illustration is ${detailLevel}, flat vector style, bold outlines, high contrast.
Designed specifically for real fabric printing – no gradients, no shadows, no 3D, no lighting effects.
No props or background. White or transparent background only.
`;
}

// 🪞 Mirror tile để tránh seam
async function mirrorTileImage(imageUrl) {
  const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
  const img = Buffer.from(response.data);

  const tile = await sharp(img)
    .resize(512, 512) // tile nhỏ để lát vào 1024x1024
    .toBuffer();

  const tileH = await sharp(tile).flop().toBuffer();
  const tileV = await sharp(tile).flip().toBuffer();
  const tileHV = await sharp(tile).flip().flop().toBuffer();

  const finalTile = await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: tile, top: 0, left: 0 },
      { input: tileH, top: 0, left: 512 },
      { input: tileV, top: 512, left: 0 },
      { input: tileHV, top: 512, left: 512 },
    ])
    .png()
    .toBuffer();

  return finalTile;
}

// ☁️ Upload buffer lên Cloudinary
async function uploadToCloudinary(imageBuffer) {
  const cloudinaryUrl = "https://api.cloudinary.com/v1_1/dv3wx2mvi/image/upload";
  const formData = new FormData();
  formData.append("file", imageBuffer, { filename: "pattern.png" });
  formData.append("upload_preset", "ml_default"); // sửa nếu mày có preset riêng

  const response = await axios.post(cloudinaryUrl, formData, {
    headers: formData.getHeaders(),
  });

  return response.data.secure_url;
}
