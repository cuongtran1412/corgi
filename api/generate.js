const { OpenAI } = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

module.exports = async (req, res) => {
  // CORS headers for cross-origin requests (Shopify frontend)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Only POST requests allowed' });

  // Parse JSON body
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
    // Use GPT-3.5 to expand prompt based on selected options
    const chat = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a prompt builder for an AI image generator. Your job is to write a creative and visual prompt based on user-selected style, color, layout, background, mood, subject, and optional text.'
        },
        {
          role: 'user',
          content: `
Style: ${style}
Color: ${color}
Layout: ${layout}
Background: ${background}
Mood: ${mood}
Subject: ${subject}
Text on design: ${text || 'None'}

Generate a clear, creative, and vivid prompt for an AI to generate a hoodie design featuring the subject in the selected style. Mention the text if provided.
          `.trim()
        }
      ],
      max_tokens: 150,
    });

    const prompt = chat.choices[0].message.content;

    console.log('🧠 Final prompt:', prompt);

    const image = await openai.images.generate({
      model: 'dall-e-3',
      prompt: prompt,
      size: '1024x1024' // Use frontend CSS to display smaller (e.g. 256x256)
    });

    const imageUrl = image.data[0].url;
    res.status(200).json({ imageUrl });

  } catch (error) {
    console.error('❌ API error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
};
