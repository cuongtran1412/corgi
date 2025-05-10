const { OpenAI } = require("openai");
const axios = require("axios");
const FormData = require("form-data");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Only POST requests allowed" });
  }

  const {
    text = "",
    designStyle = "",
    colorMood = "",
    detailLevel = ""
  } = req.body;

  if (!text || !designStyle || !colorMood || !detailLevel) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  const prompt = buildPrompt({ text, designStyle, colorMood, detailLevel });

  try {
    // Generate image with DALL·E
    const image = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      size: "1024x1024",
    });

    const imageUrl = image.data[0].url;

    // Upload to Cloudinary
    const cloudinaryUpload = await uploadToCloudinary(imageUrl);

    res.status(200).json({ imageUrl: cloudinaryUpload, prompt });

  } catch (error) {
    console.error("❌ Error:", error);
    res.status(500).json({ error: error.message });
  }
};

// 🧠 Prompt builder từ preset
function buildPrompt({ text, designStyle, colorMood, detailLevel }) {
  return `
A seamless, repeating pattern of ${text}, in ${designStyle} style, with ${colorMood} tones.
The illustration is ${detailLevel}, flat vector style, bold outlines, high contrast.
Designed specifically for real fabric printing – no gradients, no shadows, no 3D, no lighting effects.
No props or background. White or transparent background only.
`;
}

// ☁️ Upload image từ URL lên Cloudinary
async function uploadToCloudinary(imageUrl) {
  const cloudinaryUrl = "https://api.cloudinary.com/v1_1/dv3wx2mvi/image/upload";
  const formData = new FormData();
  formData.append("file", imageUrl);
  formData.append("upload_preset", "ml_default"); // thay preset này nếu mày dùng preset riêng

  const response = await axios.post(cloudinaryUrl, formData, {
    headers: formData.getHeaders(),
  });

  return response.data.secure_url;
}
