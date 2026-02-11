const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Predict optimal departure time using Gemini AI
 * Analyzes traffic patterns and suggests best time to start delivery
 */
async function predictBestDepartureTime(locations, routes, userDepartureTime = '08:00') {
  try {
    if (!process.env.GEMINI_API_KEY) {
      console.warn('Gemini API key not configured');
      return {
        success: false,
        message: 'AI traffic prediction unavailable',
        bestTime: userDepartureTime,
        userSelectedTime: userDepartureTime,
        trafficRating: 'unknown'
      };
    }

    // Use Gemini 2.5 flash for best optimization results
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    // Build location summary for AI analysis
    const locationSummary = locations.map((loc, idx) => 
      `${idx + 1}. ${loc.name} (${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)})`
    ).join('\n');

    // Build route summary
    const routeSummary = routes.map((route, idx) => {
      const stopCount = route.stops?.length || 0;
      const distance = route.distance?.toFixed(2) || 0;
      return `Route ${idx + 1}: ${stopCount} stops, ${distance} km`;
    }).join('\n');

    const prompt = `You are a logistics AI expert analyzing delivery routes for traffic optimization.

DELIVERY LOCATIONS:
${locationSummary}

PLANNED ROUTES:
${routeSummary}

USER'S SELECTED DEPARTURE TIME: ${userDepartureTime}

TASK: Critically evaluate the user's selected departure time (${userDepartureTime}) and recommend the optimal departure time.

Consider:
1. Morning rush hour (7-9 AM): Heavy traffic in urban areas
2. Midday (11 AM - 2 PM): Moderate traffic, good for deliveries
3. Evening rush hour (4-7 PM): Heavy traffic, avoid if possible
4. Late evening (8 PM+): Light traffic but may have business hour restrictions

Compare these departure times:
- 6:00 AM (Early morning)
- 8:00 AM (Morning rush)
- 11:00 AM (Midday)
- 4:00 PM (Afternoon)
- 8:00 PM (Evening)

IMPORTANT: If the user's selected time (${userDepartureTime}) is already optimal or near-optimal, acknowledge it positively. If it's suboptimal, explain why and suggest a better time.

Respond in this EXACT JSON format (no markdown, no code blocks):
{
  "bestTime": "HH:MM AM/PM",
  "userSelectedTime": "${userDepartureTime}",
  "isUserTimeOptimal": boolean,
  "alternativeTime": "HH:MM AM/PM",
  "estimatedSavingsMinutes": number,
  "trafficRating": "light|moderate|heavy",
  "reasoning": "Brief explanation comparing user's time to optimal time",
  "avoidTimes": ["HH:MM AM/PM", "HH:MM AM/PM"],
  "confidence": "high|medium|low"
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse AI response
    let aiData;
    try {
      // Remove markdown code blocks if present
      const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      aiData = JSON.parse(cleanText);
    } catch (parseError) {
      console.error('Failed to parse AI response:', text);
      throw new Error('Invalid AI response format');
    }

    return {
      success: true,
      ...aiData
    };

  } catch (error) {
    console.error('Gemini AI prediction error:', error.message);
    return {
      success: false,
      message: error.message,
      bestTime: '8:00 AM',
      trafficRating: 'unknown',
      estimatedSavingsMinutes: 0,
      reasoning: 'AI prediction unavailable, using default time',
      confidence: 'low'
    };
  }
}

/**
 * Analyze traffic incident impact using Gemini AI
 * Uses FIXED delay penalties instead of multipliers for realistic results
 */
async function analyzeIncidentImpact(incidentType, affectedRoute, allRoutes) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return {
        success: false,
        delayMinutes: 60,
        fixedDelayMinutes: 60,
        severity: 'MODERATE',
        recommendation: 'Consider alternative route'
      };
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `You are a traffic incident analyzer for delivery logistics.

INCIDENT TYPE: ${incidentType}
AFFECTED ROUTE: Route ${affectedRoute + 1}
TOTAL ROUTES: ${allRoutes.length}

CRITICAL: Use FIXED delay penalties, NOT multipliers. A highway accident adds a fixed delay (e.g., 4-5 hours), it does NOT multiply the entire journey.

Common incident types and REALISTIC FIXED delays:
- ACCIDENT: 240-300 min (4-5 hours) fixed delay - Major highway blockage
- ROAD_CLOSURE: 180-240 min (3-4 hours) fixed delay - Complete road closure
- CONSTRUCTION: 30-60 min fixed delay - Lane reduction
- HEAVY_TRAFFIC: 45-90 min fixed delay - Rush hour congestion
- WEATHER: 60-120 min fixed delay - Severe weather conditions

Analyze the impact and provide recommendations.

Respond in this EXACT JSON format (no markdown):
{
  "fixedDelayMinutes": number (30-300 range, the FIXED time penalty to add),
  "delayMinutes": number (same as fixedDelayMinutes),
  "severity": "LOW|MODERATE|HIGH|CRITICAL",
  "delayLabel": "+ X hr Y min" (formatted delay string),
  "recommendation": "Brief action recommendation (mention 'Major accident' or 'Road closure' etc.)",
  "shouldReroute": boolean,
  "estimatedRecoveryTime": "X-Y hours",
  "trafficCondition": "Light Congestion|Moderate Congestion|Heavy Congestion|Severe Congestion"
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    let aiData;
    try {
      const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      aiData = JSON.parse(cleanText);
    } catch (parseError) {
      console.error('Failed to parse incident analysis:', text);
      throw new Error('Invalid AI response format');
    }

    // Ensure fixed delay is realistic (30 min to 5 hours)
    if (aiData.fixedDelayMinutes > 300) {
      aiData.fixedDelayMinutes = 300; // Cap at 5 hours
    }
    if (aiData.fixedDelayMinutes < 30) {
      aiData.fixedDelayMinutes = 60; // Minimum 1 hour
    }

    // Ensure delayMinutes matches fixedDelayMinutes
    aiData.delayMinutes = aiData.fixedDelayMinutes;

    // Format delay label if not provided
    if (!aiData.delayLabel) {
      const hours = Math.floor(aiData.fixedDelayMinutes / 60);
      const minutes = aiData.fixedDelayMinutes % 60;
      aiData.delayLabel = `+ ${hours} hr ${minutes} min`;
    }

    return {
      success: true,
      ...aiData
    };

  } catch (error) {
    console.error('Incident analysis error:', error.message);
    return {
      success: false,
      fixedDelayMinutes: 60,
      delayMinutes: 60,
      severity: 'MODERATE',
      delayLabel: '+ 1 hr 0 min',
      trafficCondition: 'Heavy Congestion',
      recommendation: 'Major accident reported. Monitor situation and consider rerouting.',
      shouldReroute: true
    };
  }
}

/**
 * Get real-time traffic prediction for a specific time window
 */
async function predictTrafficForTimeWindow(locations, departureTime, duration) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return {
        success: false,
        prediction: 'moderate',
        confidence: 'low'
      };
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const locationSummary = locations.slice(0, 5).map(loc => loc.name).join(', ');

    const prompt = `Predict traffic conditions for delivery route.

LOCATIONS: ${locationSummary}
DEPARTURE TIME: ${departureTime}
ESTIMATED DURATION: ${duration} minutes

Analyze typical traffic patterns for this time window and predict conditions.

Respond in EXACT JSON format (no markdown):
{
  "prediction": "light|moderate|heavy|severe",
  "confidence": "high|medium|low",
  "peakTrafficTime": "HH:MM AM/PM",
  "recommendedSpeed": number (km/h),
  "notes": "Brief traffic insight"
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const aiData = JSON.parse(cleanText);

    return {
      success: true,
      ...aiData
    };

  } catch (error) {
    console.error('Traffic prediction error:', error.message);
    return {
      success: false,
      prediction: 'moderate',
      confidence: 'low',
      recommendedSpeed: 60
    };
  }
}

module.exports = {
  predictBestDepartureTime,
  analyzeIncidentImpact,
  predictTrafficForTimeWindow
};
