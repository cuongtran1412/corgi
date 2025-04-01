const { OpenAI } = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Only POST requests allowed' });

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  }

  const { style, color, layout, background, mood, subject, text } = body;

  if (!style || !color || !layout || !background || !mood || !subject) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Step 1: Generate pattern description from preset options
    const chat = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a professional textile designer for fashion. Based on the following inputs, describe a vibrant, high-quality, seamless all-over print pattern suitable for hoodie printing.'
        },
        {
          role: 'user',
          content: `
Generate a textile design pattern with the following characteristics:
- Design Style: ${style}
- Palette Style: ${color}
- Pattern Layout: ${layout}
- Background Setting: ${background}
- Mood: ${mood}
- Main Subject: ${subject}
Avoid mentioning clothing or animals. Focus on describing the visual pattern using detailed artistic terms.
          `.trim()
        }
      ],
      max_tokens: 250,
    });

    const pattern = chat.choices[0].message.content;

    // Step 2: Create image of corgi wearing hoodie with that pattern
    const imagePrompt = `
A high-quality studio portrait of a Pembroke Welsh Corgi sitting and smiling, facing forward.
The dog is wearing a hoodie that features a seamless, all-over print pattern: ${pattern}.
The hoodie includes the text "${text || ''}" printed clearly on the chest in bold, stylish font.
The pattern should fully wrap around the chest, arms, and hood.
No additional dogs, no cartoon overlays, no design printed over the dog's fur.
Photo should have realistic lighting, neutral studio background, and fabric texture visible on the hoodie.
    `.trim();

    const image = await openai.images.generate({
      model: 'dall-e-3',
      prompt: imagePrompt,
      size: '1024x1024'
    });

    const imageUrl = image.data[0].url;
    res.status(200).json({ imageUrl });

  } catch (error) {
    console.error('❌ Error in generate.js:', error);
    res.status(500).json({ error: error.message || 'Image generation failed' });
  }
};
