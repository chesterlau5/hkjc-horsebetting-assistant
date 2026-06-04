export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action, date, race, rawText } = req.body;
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return res.status(500).json({ error: 'Missing API Key configuration.' });
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;

    // STEP 1 ENGINE: FETCH SCHEDULED RACES + TIMES FOR A DATE
    if (action === 'fetch_races') {
      if (!date) return res.status(400).json({ error: 'Date is required.' });
      
      const systemInstruction = `You are a horse racing schedule coordinator. Search the live web for the Hong Kong Jockey Club (HKJC) racing schedule on the specified date. Identify exactly how many races are scheduled for that specific race meeting and find their official scheduled post times (state time in HKT clearly, e.g., 1:00 PM HKT or 6:45 PM HKT).
      CRITICAL: Start your response directly with the opening brace { and end with the closing brace }. Do not include conversational text.
      Output strictly a JSON object matching this schema precisely:
      {
        "races": [
          { "name": "Race 1", "time": "1:00 PM HKT" }
        ]
      }`;

      const promptText = `Search the live internet for the official HKJC race meeting schedule and race times on this date: ${date}. Return a clean list of all scheduled races along with their respective post times.`;

      const geminiPayload = {
        contents: [{ parts: [{ text: promptText }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        tools: [{ googleSearch: {} }],
        generationConfig: { temperature: 0.1 }
      };

      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiPayload)
      });
      
      const data = await response.json();
      if (!response.ok) return res.status(500).json({ error: 'Failed to look up calendar.' });
      
      let txt = data.candidates[0].content.parts[0].text;
      
      // SAFE SHIELD CHECK 1
      const startIdx = txt.indexOf('{');
      const endIdx = txt.lastIndexOf('}');
      if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
        return res.status(422).json({ error: `The AI couldn't locate a schedule for this date. Live Search reported: "${txt}"` });
      }
      
      txt = txt.substring(startIdx, endIdx + 1);
      try {
        return res.status(200).json(JSON.parse(txt));
      } catch(e) {
        return res.status(422).json({ error: "Schedule text formatting error from server response metrics." });
      }
    }

    // STEP 2 ENGINE: LIVE SEARCH AND QUANT ANALYZE A TARGETED RACE CARD
    let promptText = '';
    if (action === 'analyze_race') {
      promptText = `Use your search tool to look up the official HKJC race card, runner details, recent expert tips, betting odds, public consensus, or trainer insights for ${race} on the race day of ${date}. Compile and populate the required JSON format based entirely on your live web findings. Ensure you fill top5Guaranteed with the highest safety/consensus plays from that specific race and top5Upsets with high-payout calculated risks from that specific race.`;
    } else {
      if (!rawText || rawText.trim().length < 50) {
        return res.status(400).json({ error: 'Data context is too short.' });
      }
      promptText = `Use your search tool to lookup recent expert tips, betting odds, public consensus, or trainer insights for the horses listed in this race card. Cross-reference your web findings with this raw text and populate the required JSON format: \n\n${rawText}`;
    }

    const systemInstruction = `You are a high-stakes, elite quantitative horse racing analyst for Hong Kong racing. Your job is to process race data, search the live web for expert opinions, tipster consensus, and current betting trends, and compile an aggressive, maximum-yield betting intelligence dashboard.
    Calculate metrics for every horse, including a clear Value Rating ("Good" if the runner has an edge or high probability relative to price, or "Bad" if overhyped/poor value).
    CRITICAL: Start your response directly with the opening brace { and end with the closing brace }. Do not include conversational text.
    You must output strictly a JSON object matching this schema precisely:
    {
      "raceName": "string",
      "date": "string",
      "trackCondition": "string",
      "analysis": {
        "summary": "string",
        "runners": [],
        "top5Guaranteed": [],
        "top5Upsets": [],
        "exoticBetSuggestions": {}
      }
    }`;

    const geminiPayload = {
      contents: [{ parts: [{ text: promptText }] }],
      systemInstruction: { parts: [{ text: systemInstruction }] },
      tools: [{ googleSearch: {} }],
      generationConfig: { temperature: 0.2 }
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
    
    // SAFE SHIELD CHECK 2
    const startIdx = responseText.indexOf('{');
    const endIdx = responseText.lastIndexOf('}');
    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
      return res.status(422).json({ error: `The AI couldn't locate race details for this specific choice. Live Search reported: "${responseText}"` });
    }

    responseText = responseText.substring(startIdx, endIdx + 1);
    try {
      const cleanJson = JSON.parse(responseText);
      return res.status(200).json(cleanJson);
    } catch(e) {
      return res.status(422).json({ error: "The data returned was incomplete or cut off mid-stream. Try executing the query again." });
    }

  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error: ' + error.message });
  }
}
