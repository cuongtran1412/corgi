const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

module.exports = async (req, res) => {
  const { prompt } = req.body;

  try {
    // Generate description using ChatGPT
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: 'Describe a creative and clear visual design pattern for a hoodie based on user request.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 100,
    });

    const patternDescription = completion.choices[0].message.content;

    // Generate image using DALL·E
    const image = await openai.images.generate({
      model: 'dall-e-3',
      prompt: `A photograph of a Pembroke Welsh Corgi wearing a hoodie with this pattern: ${patternDescription}. Clearly show the dog facing forward.`,
      size: '1024x1024'
    });

    const imageUrl = image.data[0].url;

    res.json({ imageUrl });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
