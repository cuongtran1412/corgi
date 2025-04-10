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

  const {
    apparel = "hoodie",
    dogBreed = "dog",
    name = "",
    text = "simple repeating"
  } = req.body;

  let apparelDescription = apparel;
  if (apparel === "pajama") {
    apparelDescription = "a full-body dog pajama suit with zipper";
  } else if (apparel === "t shirt") {
    apparelDescription = "dog shirt sleeveless ";
  }

  try {
    const namePrompt = name.trim()
      ? `The word '${name}' is printed in large, bold capital letters at the center of the chest of the ${apparelDescription}, clearly visible.`
      : "";

    const prompt = `A full-body of a ${dogBreed} sitting and facing forward wearing ${apparelDescription} with an all-over print ${text} pattern. The pattern is flat, clearly printable, and suitable for real fabric printing, avoiding 3D textures, gradients, or light effects. ${namePrompt} The print covers the entire surface of the ${apparelDescription}. Use soft, neutral lighting and a white studio background. No duplicate hoodies. No floating items. No extra visuals. Do not include any mockups, props, overlays, or UI. Only one dog wearing the ${apparelDescription} should appear.`;

    const image = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      size: "1024x1024",
    });

    const imageUrl = image.data[0].url;
    res.status(200).json({ imageUrl, prompt });
  } catch (error) {
    console.error("❌ Error:", error);
    res.status(500).json({ error: error.message });
  }
};
