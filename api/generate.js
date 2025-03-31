const { OpenAI } = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

module.exports = async (req, res) => {
  // ✅ THÊM header CORS cho mọi response
  res.setHeader('Access-Control-Allow-Origin', '*'); // hoặc thay bằng domain cụ thể
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // ✅ Nếu trình duyệt gửi preflight (OPTIONS), trả về 200 ngay
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Only POST requests allowed' });
  }

  const { prompt } = req.body;

  try {
    const chat = await openai.chat.completions.create({
      model: 'gpt-4-0125-preview',
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
