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
    text = "unicorns and rainbows",
  } = req.body;

  try {
    // ✅ Prompt để tạo pattern rõ ràng, dùng được cho in ấn
    const prompt = `A seamless, repeating pattern of ${text}, designed for real fabric printing.
Flat vector style, bold outlines, vibrant colors, high contrast.
No gradients, no 3D effects, no lighting, no shadows.
No props or background, just the pattern on white background.
Ideal for sublimation printing.`;

    // 🧠 Gen pattern với DALL·E 3
    const image = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      size: "1024x1024",
    });

    const imageUrl = image.data[0].url;

    // ☁️ Upload lên Cloudinary
    const cloudinaryUpload = await uploadToCloudinary(imageUrl);

    res.status(200).json({ imageUrl: cloudinaryUpload, prompt });

  } catch (error) {
    console.error("❌ Error:", error);
    res.status(500).json({ error: error.message });
  }
};

// 🔧 Upload image từ URL lên Cloudinary
async function uploadToCloudinary(imageUrl) {
  const cloudinaryUrl = "https://api.cloudinary.com/v1_1/dv3wx2mvi/image/upload";
  const formData = new FormData();
  formData.append("file", imageUrl);
  formData.append("upload_preset", "ml_default"); // thay bằng preset của mày

  const response = await axios.post(cloudinaryUrl, formData, {
    headers: formData.getHeaders(),
  });

  return response.data.secure_url;
}
