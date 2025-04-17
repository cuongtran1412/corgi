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
    apparel = "hoodie",
    dogBreed = "dog",
    text = "simple repeating"
  } = req.body;

  // 🔧 Mô tả chính xác kiểu áo để AI hiểu đúng
  let apparelDescription = apparel;
  if (apparel === "pajama") {
    apparelDescription = "a full-body dog pajama suit. The pajama has no zippers, buttons, or any fasteners. Avoid showing visible zippers or buttons of any kind.";
  } else if (apparel === "t shirt") {
    apparelDescription = "a dog t-shirt";
  } else if (apparel === "hoodie") {
    apparelDescription = "a dog hoodie without strings or pockets, fully printed with hood up";
  }

  try {
    // 🧠 Prompt chính để sinh ảnh in vải
    const prompt = `A ${dogBreed}, sitting and facing forward, wearing ${apparelDescription} with an all-over ${text} pattern. 
The pattern is flat, seamless, and designed for real fabric printing – no gradients, shadows, or 3D effects. 
The print covers the entire garment. 
Use soft neutral lighting and a white studio background. 
No duplicate garments, floating items, accessories, or props. 
Only one dog in frame, no humans or mockup elements.`;

    // 🔹 Step 1: Generate image with DALL·E
    const image = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      size: "1024x1024",
    });

    const imageUrl = image.data[0].url;

    // 🔹 Step 2: Upload to Cloudinary
    const cloudinaryUpload = await uploadToCloudinary(imageUrl);

    // 🔹 Step 3: Return Cloudinary URL
    res.status(200).json({ imageUrl: cloudinaryUpload, prompt });

  } catch (error) {
    console.error("❌ Error:", error);
    res.status(500).json({ error: error.message });
  }
};

// 🔧 Helper: Upload DALL·E image to Cloudinary
async function uploadToCloudinary(imageUrl) {
  const cloudinaryUrl = "https://api.cloudinary.com/v1_1/dv3wx2mvi/image/upload";
  const formData = new FormData();
  formData.append("file", imageUrl);
  formData.append("upload_preset", "ml_default"); // nhớ preset này tồn tại trên Cloudinary

  const response = await axios.post(cloudinaryUrl, formData, {
    headers: formData.getHeaders(),
  });

  return response.data.secure_url;
}
