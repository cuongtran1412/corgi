const { OpenAI } = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Only POST requests allowed' });
  }

  const { prompt } = req.body;

  if (!prompt || prompt.trim() === '') {
    return res.status(400).json({ message: 'Missing prompt in request body' });
  }

  try {
    // Generate text using ChatGPT
    const chat = await openai.chat.completions.create({
      model: 'gpt-4-0125-preview', // Update if you're using latest model
      messages: [
        { role: 'system', content: 'Describe a hoodie pattern based on user request.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 100,
    });

    const pattern = chat.choices[0].message.content;

    // Generate image with DALL·E
    const image = await openai.images.generate({
      model: 'dall-e-3',
      prompt: `A photograph of a Pembroke Welsh Corgi wearing a hoodie with this design: ${pattern}. Clearly show the dog facing forward.`,
      n: 1,
      size: '1024x1024'
    });

    const imageUrl = image.data[0].url;
    res.status(200).json({ imageUrl });

  } catch (error) {
    console.error('❌ Error in API:', error);
    res.status(500).json({ error: error.message });
  }
};
