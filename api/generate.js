const { OpenAI } = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Only POST requests allowed' });
  }

  // ✅ Parse body
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  }

  const { prompt } = body;

  if (!prompt || prompt.trim() === '') {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  try {
    const chat = await openai.chat.completions.create({
      model: 'gpt-4-0125-preview', // hoặc gpt-3.5-turbo nếu chưa có quyền
      messages: [
        { role: 'system', content: 'Describe a hoodie pattern based on user request.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 100,
    });

    const pattern = chat.choices[0].message.content;

    const image = await openai.images.generate({
      model: 'dall-e-3',
      prompt: `A Corgi wearing a hoodie with this pattern: ${pattern}`,
      size: '1024x1024'
    });

    const imageUrl = image.data[0].url;
    res.status(200).json({ imageUrl });

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: error.message });
  }
};
