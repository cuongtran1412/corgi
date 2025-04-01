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
      model: 'gpt-4-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a visual pattern generator for clothing. Describe unique design patterns based on user inputs for hoodie printing.'
        },
        {
          role: 'user',
          content: `
Design a visual pattern based on:
- Style: ${style}
- Color Palette: ${color}
- Pattern Layout: ${layout}
- Background Theme: ${background}
- Mood: ${mood}
- Main Subject: ${subject}
Text on hoodie (if any): ${text || '[none]'}
Keep it visual and suitable for printing on fabric.
          `.trim()
        }
      ],
      max_tokens: 150,
    });

    const pattern = chat.choices[0].message.content;

    // Step 2: Generate image prompt
    const imagePrompt = `
A studio photo of a Pembroke Welsh Corgi sitting and facing forward, wearing a hoodie with a design that features: ${pattern}.
The hoodie should include the text "${text || ''}" clearly and centrally on the chest in bold font.
The pattern should wrap around the chest, sleeves, and hood (all-over print).
Do not include any other characters or designs on the hoodie.
Neutral white background, soft lighting, realistic style.
    `.trim();

    // Step 3: Generate image using DALL·E
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
