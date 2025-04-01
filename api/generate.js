const { OpenAI } = require("openai");

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

  const { apparel, breed, name, design } = req.body;

  try {
    const finalPrompt = `A full-body studio photo of a ${breed} wearing a ${apparel} with an all-over print ${design} pattern. The pattern is flat, clearly printable, and suitable for real fabric printing, avoiding 3D textures, gradients, or light effects. The word '${name}' is printed in large, bold capital letters at the center of the chest, clearly visible. The print covers the whole ${apparel} surface including hood, sleeves, and front. Use soft, neutral lighting and gray studio background. Do not include props, shadows, or extra subjects. Only one dog wearing the ${apparel} should appear.`;

    const image = await openai.images.generate({
      model: "dall-e-3",
      prompt: finalPrompt,
      size: "1024x1024",
    });

    const imageUrl = image.data[0].url;
    res.status(200).json({ imageUrl, prompt: finalPrompt });
  } catch (error) {
    console.error("❌ Error:", error);
    res.status(500).json({ error: error.message });
  }
};
