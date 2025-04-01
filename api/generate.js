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
    // Step 1: Generate pattern description using GPT
    const chat = await openai.chat.completions.create({
      model: 'gpt-4-turbo', // you can change to gpt-4 if needed
      messages: [
        {
          role: 'system',
          content: 'You are a prompt engineer for an AI image generator. Describe the visual pattern for a hoodie based on user inputs.'
        },
        {
          role: 'user',
          content: `
Create a hoodie design based on the following:
- Style: ${style}
- Palette Style: ${color}
- Layout: ${layout}
- Background Setting: ${background}
- Mood: ${mood}
- Subject: ${subject}
If any text is required, the phrase is: "${text || '[no text]'}".
Describe it clearly as a printable pattern.
          `.trim()
        }
      ],
      max_tokens: 150,
    });

    const pattern = chat.choices[0].message.content;

    // Step 2: Generate DALL·E image prompt
    const imagePrompt = `
A digital photograph of a Pembroke Welsh Corgi sitting and facing forward, wearing a hoodie with an all-over print pattern.
The hoodie design is: ${pattern}.
The hoodie should cover the dog completely and clearly display the pattern across the chest, sleeves, and hood.
${text ? `The hoodie should also include the text: "${text}" in bold on the chest.` : ''}
    `.trim();

    // Step 3: Generate image using DALL·E
    const image = await openai.images.generate({
      model: 'dall-e-3',
      prompt: imagePrompt,
      size: '1024x1024' // You can reduce it if needed
    });

    const imageUrl = image.data[0].url;
    res.status(200).json({ imageUrl });

  } catch (error) {
    console.error('❌ Backend error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
};
