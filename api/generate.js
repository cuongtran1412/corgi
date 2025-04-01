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

  const { apparel, dogBreed, text, name } = req.body;

  try {
    let finalPrompt = `A full-body studio photo of a ${dogBreed} wearing a ${apparel} with an all-over print ${text} pattern.`;

    if (name && name.trim() !== "") {
      finalPrompt += ` The word '${name}' is printed in large, bold capital letters across the center of the chest of the ${apparel}, clearly visible.`;
    }

    finalPrompt += " Use soft lighting, neutral gray background. Do not include any props, multiple garments, or extra subjects. Only the dog wearing the hoodie should appear.";

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
