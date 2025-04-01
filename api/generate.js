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

  const { style, color, layout, background, mood, subject, text } = req.body;

  try {
    // 1. Generate pattern description
    const patternDescription = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are a professional textile surface designer. Generate a seamless all-over repeating pattern for printing on clothing based on the user request.",
        },
        {
          role: "user",
          content: `Create a repeating all-over print pattern for textile printing on a hoodie. The theme is "${subject}" in a ${style} style. Use a ${color} color palette. The mood should feel ${mood}. Avoid drawing text, animals, or logos. Focus on seamless pattern layout optimized for fabric.`,
        },
      ],
      max_tokens: 600,
    });

    const pattern = patternDescription.choices[0].message.content;

    // 2. Final prompt to DALL·E 3
    const finalPrompt = `A high-quality, full-body studio photograph of a single happy Pembroke Welsh Corgi sitting and facing forward, wearing a hoodie. The hoodie features a seamless all-over repeating pattern: ${pattern}. The pattern fully covers the hood, sleeves, and torso with no empty spaces, and is dense and continuous.

The word “${text}” is printed clearly across the chest of the hoodie in bold, bright lime-green capital letters.

The background must be a plain, neutral light gray studio backdrop with no objects or patterns. Do not show any mockups, floating hoodies, templates, charts, or any extra views. Only show the Corgi wearing the hoodie. Use soft, realistic lighting, natural fabric folds, and photorealistic texture.`;

    // 3. Generate image
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
