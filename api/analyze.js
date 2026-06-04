export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { rawText } = req.body;
    if (!rawText || rawText.trim().length < 50) {
      return res.status(400).json({ error: 'Data context is too short.' });
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return res.status(500).json({ error: 'Missing API Key configuration.' });
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;

    const systemInstruction = `You are a high-stakes, elite quantitative horse racing analyst for Hong Kong racing. Your job is to process raw race card data, search the live web for expert opinions, tipster consensus, and current betting trends, and compile a definitive data-driven matrix.
    
    Calculate three metrics for every notable horse:
    1. Estimated HKJC Decimal Odds (e.g., 4.50)
    2. Vegas/American Odds (e.g., +350 or -110)
    3. Implied Win Probability % based on form, barrier, and search trends.
    
    You must output strictly a JSON object matching this schema precisely:
    {
      "raceName": "string",
      "date": "string",
      "trackCondition": "string (e.g., Good / Muddy / Yielding)",
      "analysis": {
        "summary": "Detailed 3-sentence macro view of track bias, pace scenario, and expert consensus.",
        "runners": [
          {
            "horseNumber": number,
            "horseName": "string",
            "hkjcOdds": "string",
            "vegasOdds": "string",
            "winProbability": number,
            "statisticalScore": number,
            "expertSentiment": "Bullish" or "Bearish" or "Neutral",
            "keyEdge": "string",
            "riskFactor": "string"
          }
        ],
        "exoticBetSuggestions": {
          "quinella": "string",
          "tierce": "string"
        }
      }
    }`;

    const promptText = `Use your search tool to lookup recent expert tips, betting odds, or trainer insights for the horses listed in this race card. Cross-reference your web findings with this raw text and populate the required JSON format: \n\n${rawText}`;

    const geminiPayload = {
      contents: [{ parts: [{ text: promptText }] }],
      systemInstruction: { parts: [{ text: systemInstruction }] },
      tools: [{ googleSearch: {} }], 
      generationConfig: {
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

    // Capture raw response text
    let responseText = geminiData.candidates[0].content.parts[0].text;
    
    // Safety Parser: Strip away any markdown formatting wrappers if present
    responseText = responseText.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim();

    // Parse clean text into code-safe JSON data
    const cleanJson = JSON.parse(responseText);
    return res.status(200).json(cleanJson);

  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error: ' + error.message });
  }
}
