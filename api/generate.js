const { OpenAI } = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

module.exports = async (req, res) => {
  // ✅ CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*'); // Hoặc thay * bằng domain Shopify thật
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end(); // Preflight
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Only POST requests allowed' });
  }

  // ✅ Parse body JSON nếu cần
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
    console.log('👉 Start GPT-3.5 generation');
    const chat = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo', // ✅ Dùng model nhẹ để test nhanh
      messages: [
        { role: 'system', content: 'Describe a hoodie pattern based on user request.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 100,
    });

    const pattern = chat.choices[0].message.content;
    console.log('✅ GPT Done:', pattern);

    console.log('👉 Start DALL·E image generation');
    const image = await openai.images.generate({
      model: 'dall-e-3',
      prompt: `A Pembroke Welsh Corgi wearing a hoodie with this pattern: ${pattern}`,
      size: '1024x1024',
    });

    const imageUrl = image.data[0].url;
    console.log('✅ DALL·E Done, image URL:', imageUrl);

    res.status(200).json({ imageUrl });

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
};
