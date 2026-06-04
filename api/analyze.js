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

    const systemInstruction = `You are a high-stakes, elite quantitative horse racing analyst for Hong Kong racing. Your job is to process raw race card data, search the live web for expert opinions, tipster consensus, and current betting trends, and compile an aggressive, maximum-yield betting intelligence dashboard.
    
    Calculate metrics for every horse, including a clear Value Rating ("Good" if the runner has an edge or high probability relative to price, or "Bad" if overhyped/poor value).
    
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
            "oddsValue": "Good" or "Bad",
            "keyEdge": "string",
            "riskFactor": "string"
          }
        ],
        "top5Guaranteed": [
          {
            "horseNumber": number,
            "horseName": "string",
            "recommendedBet": "string (e.g., Straight Win, Place Banker, Quinella Key)",
            "vegasOdds": "string",
            "winProbability": number,
            "executionStrategy": "string (Brief exact instructions on how to play it)"
          }
        ],
        "top5Upsets": [
          {
            "horseNumber": number,
            "horseName": "string",
            "recommendedBet": "string (e.g., Longshot Place, Tierce Alt Longshot)",
            "vegasOdds": "string",
            "winProbability": number,
            "upsetTrigger": "string (Why this horse can smash the odds)"
          }
        ],
        "exoticBetSuggestions": {
          "quinella": "string",
          "tierce": "string"
        }
      }
    }`;

    const promptText = `Use your search tool to lookup recent expert tips, betting odds, public consensus, or trainer insights for the horses listed in this race card. Cross-reference your web findings with this raw text and populate the required JSON format. Ensure you fill the top5Guaranteed with the highest safety/consensus plays and top5Upsets with high-payout calculated risks: \n\n${rawText}`;

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

    let responseText = geminiData.candidates[0].content.parts[0].text;
    responseText = responseText.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim();

    const cleanJson = JSON.parse(responseText);
    return res.status(200).json(cleanJson);

  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error: ' + error.message });
  }
}
