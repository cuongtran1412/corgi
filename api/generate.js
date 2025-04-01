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
    const prompt = `A full-body, high-quality studio photograph of a single Pembroke Welsh Corgi sitting and facing forward, wearing a hoodie with a seamless all-over print pattern. The theme is "${subject}" in a ${style} style, using a ${color} color palette, with a ${mood} mood and ${layout} layout. The background should be neutral light gray with soft, even lighting. The word \"${text}\" is printed clearly in bold, lime-green capital letters on the chest. Only show one corgi, no extra mockups, no props, and no additional objects.`;

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
