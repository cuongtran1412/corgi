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
    const patternDescription = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are a professional surface pattern designer. Based on the user's idea, describe a seamless all-over pattern for hoodie textile printing. Return a vivid, coherent pattern idea that can be visualized."
        },
        {
          role: "user",
          content: `Create a seamless all-over repeating pattern for hoodie printing. Theme: "${subject}". Style: ${style}. Color palette: ${color}. Mood: ${mood}. Background: ${background}. Avoid using text or animals. The pattern should be fabric-friendly, balanced, and visually rich.`
        },
      ],
      max_tokens: 300,
    });

    const pattern = patternDescription.choices[0].message.content;

    const finalPrompt = `A full-body, high-quality studio photo of a happy Pembroke Welsh Corgi sitting and facing forward, wearing a hoodie. The hoodie features a seamless all-over repeating pattern: ${pattern}. The word "${text}" is printed clearly across the chest of the hoodie in bold, bright lime-green capital letters. The hoodie looks soft and realistic, with natural fabric folds and texture, covering the hood, sleeves, and torso. Use soft, even lighting and a neutral light gray studio background.`;

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
