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

    // ENGINE ACTION 1: FETCH SCHEDULED RACES + TIMES FOR A DATE
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
      
      const startIdx = txt.indexOf('{');
      const endIdx = txt.lastIndexOf('}');
      if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
        return res.status(422).json({ error: `Live Search delayed. Fallback to Manual Overdrive Paste. Report: "${txt}"` });
      }
      
      txt = txt.substring(startIdx, endIdx + 1);
      try {
        return res.status(200).json(JSON.parse(txt));
      } catch(e) {
        return res.status(422).json({ error: "Schedule formatting error from server response metrics." });
      }
    }

    // ENGINE ACTION 2: CONFIGURING PAYLOAD ROUTING FOR ANALYSIS MODES
    let promptText = '';
    let enableLiveWebSearch = false;

    if (action === 'analyze_race') {
      enableLiveWebSearch = true;
      promptText = `Use your search tool to look up the official HKJC race card, runner details, recent expert tips, betting odds, public consensus, or trainer insights for ${race} on the race day of ${date}. Compile and populate the required JSON format based entirely on your live web findings. Ensure you fill top5Guaranteed with the highest safety/consensus plays and top5Upsets with high-payout calculated risks.`;
    } else {
      enableLiveWebSearch = false;
      if (!rawText || rawText.trim().length < 50) {
        return res.status(400).json({ error: 'Manual input data payload is empty or too short.' });
      }
      promptText = `You are given a raw copy-pasted text dump from an HKJC race page. Extract the data directly from this text context and populate the required JSON format immediately. Do not attempt to browse the internet. Rely strictly on this text: \n\n${rawText}`;
    }

    const systemInstruction = `You are a high-stakes, elite quantitative horse racing analyst for Hong Kong racing. Your job is to process race data, calculate premium betting lines, and compile an aggressive, maximum-yield betting intelligence dashboard.

    CRITICAL REQUIREMENT: You MUST populate EVERY single field in the JSON schema for EVERY runner found in the field. NEVER leave a field blank, null, generic, or missing. 
    
    If exact current live web odds or consensus metrics are not explicitly available for a runner, you are FORBIDDEN from outputting generic or placeholder metrics. You MUST execute an algorithmic estimation using your deep structural racing analytics knowledge to generate realistic, distinct data footprints:
    1. "hkjcOdds": Must be a realistic decimal string representing their performance tier (e.g., "3.45", "7.20", "14.0"). NEVER leave them as a single repeating default value for the field.
    2. "winProbability": Must be a clear calculated integer greater than 0 representing their win equity (e.g., 24, 15, 6). The total sum of all runners' win probabilities should approximate 100%.
    3. "statisticalScore": Must be an individualized performance power-rating score from 1 to 100 based on class and form.
    4. "expertSentiment": Must evaluate to "Bullish", "Bearish", or "Neutral" based on typical track profile parameters.
    5. "oddsValue": Must explicitly evaluate to "Good" if the implied probability justifies the price, or "Bad" if overhyped.
    6. "keyEdge" & "riskFactor": Must contain distinct, concise analytical sentences mapping their tactical situation.

    CRITICAL: Start your response directly with the opening brace { and end with the closing brace }. Do not include conversational text.
    
    You must output strictly a JSON object matching this schema precisely:
    {
      "raceName": "string",
      "date": "string",
      "trackCondition": "string",
      "analysis": {
        "summary": "string",
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
            "recommendedBet": "string",
            "vegasOdds": "string",
            "winProbability": number,
            "executionStrategy": "string"
          }
        ],
        "top5Upsets": [
          {
            "horseNumber": number,
            "horseName": "string",
            "recommendedBet": "string",
            "vegasOdds": "string",
            "winProbability": number,
            "upsetTrigger": "string"
          }
        ],
        "exoticBetSuggestions": {
          "quinella": "string",
          "tierce": "string"
        }
      }
    }`;

    const geminiPayload = {
      contents: [{ parts: [{ text: promptText }] }],
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: { temperature: 0.2 }
    };

    if (enableLiveWebSearch) {
      geminiPayload.tools = [{ googleSearch: {} }];
    }

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
    
    const startIdx = responseText.indexOf('{');
    const endIdx = responseText.lastIndexOf('}');
    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
      return res.status(422).json({ error: `System alert. Data stream empty or cut off. Search reported: "${responseText}"` });
    }

    responseText = responseText.substring(startIdx, endIdx + 1);
    try {
      const cleanJson = JSON.parse(responseText);
      return res.status(200).json(cleanJson);
    } catch(e) {
      return res.status(422).json({ error: "The data returned was incomplete. Try executing the query again." });
    }

  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error: ' + error.message });
  }
}
