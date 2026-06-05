export default async function handler(req, res) {
  // Enforce precise HTTP POST methods
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action, date, race, rawText } = req.body;
    const geminiApiKey = process.env.GEMINI_API_KEY;
    
    if (!geminiApiKey) {
      return res.status(500).json({ error: 'System Configuration Error: Missing GEMINI_API_KEY environment variable on server.' });
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;

    // ==========================================
    // ACTION WORKFLOW 1: DYNAMIC TIMELINE SCHEDULE FETCHING
    // ==========================================
    if (action === 'fetch_races') {
      if (!date) return res.status(400).json({ error: 'Target calculation parameter error: Date value missing.' });
      
      const scheduleSystemInstruction = `You are an elite horse racing schedule coordinator. Search the live web for the official Hong Kong Jockey Club (HKJC) racing schedule and card listings on the specified date. Identify exactly how many races are scheduled for that specific race meeting and extract their official post times. State all times clearly in Hong Kong Time (HKT), e.g., "1:00 PM HKT" or "6:45 PM HKT".
      
      CRITICAL OUTPUT FORMAT CONTROL: You MUST start your response directly with the opening brace { and end precisely with the closing brace }. Do not include conversational sentences, commentary, or markdown code blocks like \`\`\`json.
      
      Output strictly a valid JSON object matching this schema precisely:
      {
        "races": [
          { "name": "Race 1", "time": "1:00 PM HKT" },
          { "name": "Race 2", "time": "1:30 PM HKT" }
        ]
      }`;

      const schedulePrompt = `Search the live internet using your search tool for the official HKJC race meeting calendar, race card listings, and official post times on this exact date: ${date}. Output the structured race arrays immediately.`;

      const schedulePayload = {
        contents: [{ parts: [{ text: schedulePrompt }] }],
        systemInstruction: { parts: [{ text: scheduleSystemInstruction }] },
        tools: [{ googleSearch: {} }], // Enable internet grounding search
        generationConfig: { temperature: 0.1 }
      };

      const apiResponse = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(schedulePayload)
      });
      
      const apiData = await apiResponse.json();
      
      // Bubble raw API status codes up directly to activate frontend rate limit shields
      if (!apiResponse.ok) {
        return res.status(apiResponse.status).json({ 
          error: apiData.error?.message || 'Google live-search grounding engine timed out or threw a rate exception.' 
        });
      }
      
      let rawTextResult = apiData.candidates[0].content.parts[0].text;
      
      // Deep Scan Extractor Shield
      const startJsonIdx = rawTextResult.indexOf('{');
      const endJsonIdx = rawTextResult.lastIndexOf('}');
      if (startJsonIdx === -1 || endJsonIdx === -1 || endJsonIdx <= startJsonIdx) {
        return res.status(422).json({ error: `Grounding Interface Delay: No structured data returned. Server explanation: "${rawTextResult}"` });
      }
      
      rawTextResult = rawTextResult.substring(startJsonIdx, endJsonIdx + 1);
      return res.status(200).json(JSON.parse(rawTextResult));
    }

    // ==========================================
    // ACTION WORKFLOW 2: ADVANCED QUANT MATRIX PARSING
    // ==========================================
    let payloadPrompt = '';
    let loadLiveCrawlTools = false;

    if (action === 'analyze_race') {
      // Auto-Pilot Mode: Fire up live web scraping tools
      loadLiveCrawlTools = true;
      payloadPrompt = `Use your search tool to deep crawl the live web for the official HKJC race card listings, field metrics, runner statistics, expert tipster consensus panels, performance records, and current betting trends for ${race} on the race day of ${date}. Compile and format all data points into the requested schema configuration based entirely on your analytical findings. Ensure top5Guaranteed isolates the absolute highest-safety consensus plays, and top5Upsets maps realistic high-payout speculative calculations.`;
    } else {
      // Manual Overdrive Mode: Completely disable live search tools to ensure instantaneous execution
      loadLiveCrawlTools = false;
      if (!rawText || rawText.trim().length < 50) {
        return res.status(400).json({ error: 'Processing Fault: Manual text payload context window empty or too short.' });
      }
      payloadPrompt = `You are given a raw copy-pasted data text dump from an official HKJC betting portal interface. Extract, parse, and structure all runner data from this provided context block into the requested data layout immediately. Do not browse the web; rely exclusively on this text payload: \n\n${rawText}`;
    }

    const quantSystemInstruction = `You are a high-stakes, elite quantitative horse racing handicapper and data analyst for Hong Kong racing circuits. Your task is to process race vectors, synthesize betting intelligence fields, and compile a maximum-yield sports betting layout matrix.

    CRITICAL DISPERSION DIRECTIVE: You MUST populate EVERY single parameter in the JSON mapping template for EVERY horse found in the racing field. Generic, universal, or matching repeating default metrics across the field are strictly FORBIDDEN. 
    If current explicit market parameters or win percentages are missing for a runner, you MUST execute a highly granular mathematical estimation based on class tiers, barriers, and form lines to generate distinctly distributed data footprints:
    1. "hkjcOdds": Must map to a varied, distinct decimal odd string (e.g., "2.45", "6.10", "18.5", "41.0"). Never output matching lines for all horses.
    2. "winProbability": Must map to an individualized unique integer greater than 0 representing real win equity (e.g., 31, 14, 8, 2). The cumulative sum of the field must approximate 100%.
    3. "statisticalScore": Must represent an individualized performance power-rating calculation scalar scale from 1 to 100.
    4. "expertSentiment": Must evaluate selectively to "Bullish", "Bearish", or "Neutral" based on standard performance indicators.
    5. "oddsValue": Must evaluate dynamically to "Good" if value line analytics back the implied equity, or "Bad" if heavily overpriced or overhyped.
    6. "keyEdge" & "riskFactor": Provide highly distinct, concise analytical commentary lines mapping their tactical situation.

    CRITICAL FORMAT CONTROL: Start your response directly with the opening brace { and end precisely with the closing brace }. Do not include conversational prefaces, annotations, or code blocks.

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

    const quantPayload = {
      contents: [{ parts: [{ text: payloadPrompt }] }],
      systemInstruction: { parts: [{ text: quantSystemInstruction }] },
      generationConfig: { temperature: 0.15 }
    };

    // Apply smart-switching for internet crawl tools based on mode selection
    if (loadLiveCrawlTools) {
      quantPayload.tools = [{ googleSearch: {} }];
    }

    const quantResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(quantPayload)
    });

    const quantData = await quantResponse.json();
    
    if (!quantResponse.ok) {
      return res.status(quantResponse.status).json({ error: quantData.error?.message || 'The backend matrix inference engine encountered a server boundary exception.' });
    }

    let coreResponseText = quantData.candidates[0].content.parts[0].text;
    
    // Defensive Slicing Logic
    const startMatrixIdx = coreResponseText.indexOf('{');
    const endMatrixIdx = coreResponseText.lastIndexOf('}');
    if (startMatrixIdx === -1 || endMatrixIdx === -1 || endMatrixIdx <= startMatrixIdx) {
      return res.status(422).json({ error: `Data Stream Defect: Server response parsing crashed. Raw log: "${coreResponseText}"` });
    }

    coreResponseText = coreResponseText.substring(startMatrixIdx, endMatrixIdx + 1);
    return res.status(200).json(JSON.parse(coreResponseText));

  } catch (error) {
    return res.status(500).json({ error: 'Fatal System Exception Logged: ' + error.message });
  }
}
