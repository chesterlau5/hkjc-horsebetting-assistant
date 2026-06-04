export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { rawText } = req.body;
    if (!rawText || rawText.trim().length < 50) {
      return res.status(400).json({ error: 'Data context is too short or empty.' });
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return res.status(500).json({ error: 'Server configuration error: Missing API Key.' });
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;

    const systemInstruction = `You are an expert, objective horse racing statistical analyst specializing in Hong Kong Jockey Club data. Analyze the provided race card data layout to isolate key statistical advantages. Never guarantee outcomes or make specific absolute predictions. Evaluate the field purely based on historical edges. You must structure your entire output strictly as a JSON object matching this schema:
    {
      "raceName": "string",
      "date": "string",
      "analysis": {
        "summary": "2-3 sentence summary of the key statistical trends and factors of this race.",
        "topContenders": [
          { "horseNumber": number, "horseName": "string", "keyStats": "string", "statisticalEdge": "High" }
        ],
        "valueHorses": [
          { "horseNumber": number, "horseName": "string", "keyStats": "string", "statisticalEdge": "Medium" }
        ],
        "factorsConsidered": ["string"]
      }
    }`;

    const geminiPayload = {
      contents: [{ parts: [{ text: `Analyze this race card data and return the required JSON evaluation format:\n\n${rawText}` }] }],
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2
      }
    };

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiPayload)
    });

    const geminiData = await geminiResponse.json();
    if (!geminiResponse.ok) {
      return res.status(500).json({ error: geminiData.error?.message || 'Gemini processing failed.' });
    }

    return res.status(200).json(JSON.parse(geminiData.candidates[0].content.parts[0].text));

  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error: ' + error.message });
  }
}
