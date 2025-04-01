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
    const shortPrompt = `A full-body, high-quality studio photograph of a single Pembroke Welsh Corgi sitting and facing forward, wearing a hoodie with a colorful seamless all-over print of ${color} ${style} ${subject} elements in a ${mood} mood. The pattern is dense and evenly covers the hoodie, including the hood, sleeves, and torso. The word \"${text}\" is printed in bold, bright lime-green capital letters across the chest. Use soft studio lighting, natural fabric folds, and a neutral gray background. Do not include any extra garments, mockups, or props. Only show the Corgi wearing the hoodie.`;

    const image = await openai.images.generate({
      model: "dall-e-3",
      prompt: shortPrompt,
      size: "1024x1024",
    });

    const imageUrl = image.data[0].url;
    res.status(200).json({ imageUrl, prompt: shortPrompt });
  } catch (error) {
    console.error("❌ Error:", error);
    res.status(500).json({ error: error.message });
  }
};
