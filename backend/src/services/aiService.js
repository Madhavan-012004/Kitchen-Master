const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Robustly extracts JSON from AI response text
 */
const extractJSON = (text, isArray = true) => {
    const pattern = isArray ? /\[[\s\S]*\]/ : /\{[\s\S]*\}/;
    const match = text.match(pattern);
    if (match) return match[0];
    // Fallback: simple cleanup
    return text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
};

/**
 * Digitizes a physical menu image into structured JSON
 * using Gemini 1.5 Flash Vision.
 */
const digitizeMenuFromImage = async (imagePath) => {
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-1.5-flash' });

    const imageData = fs.readFileSync(imagePath);
    const base64Image = imageData.toString('base64');

    // Determine mimeType for Gemini
    const ext = imagePath.split('.').pop().toLowerCase();
    let mimeType = 'image/jpeg';
    if (ext === 'png') mimeType = 'image/png';
    if (ext === 'webp') mimeType = 'image/webp';
    if (ext === 'heic') mimeType = 'image/heic';
    if (ext === 'heif') mimeType = 'image/heif';

    const prompt = `You are an expert restaurant menu digitizer and culinary AI. Carefully analyze this menu image and extract EVERY single item with high accuracy.
Pay special attention to categorizing items correctly as Veg or Non-Veg (isVeg: true/false). Look for visual cues like green dots/squares (Veg) or red/brown dots/squares (Non-Veg). Also infer from the item name and description (e.g., chicken, mutton, beef, fish, egg typically indicate Non-Veg; paneer, dal, vegetable, tofu indicate Veg).

Return ONLY a valid JSON array (no markdown, no explanation) with this exact structure per item:
[
  {
    "name": "Exact Item Name",
    "category": "Detailed Category Name (e.g., Starters, Main Course, Beverages, Desserts)",
    "price": 0.00,
    "description": "Short description or list of ingredients if visible, else empty string",
    "isVeg": true or false
  }
]
If the price is not visible, use 0. Ensure NO items are missed and the JSON is perfectly formatted.`;

    const result = await model.generateContent([
        prompt,
        {
            inlineData: {
                data: base64Image,
                mimeType,
            },
        },
    ]);

    const responseText = result.response.text().trim();
    const jsonString = extractJSON(responseText, true);

    try {
        const menuItems = JSON.parse(jsonString);
        return menuItems;
    } catch (e) {
        console.error("Failed to parse Gemini output:", responseText);
        throw new Error("Failed to parse the AI response. Please try again.");
    }
};

/**
 * Parses voice/text order into structured cart items.
 * e.g. "Two chicken biryanis and one lassi for table 4"
 */
const parseVoiceOrder = async (transcribedText, availableMenuItems) => {
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-1.5-flash' });

    const menuContext = availableMenuItems
        .map((item) => `- ${item.name} (ID: ${item._id}, Price: ${item.price})`)
        .join('\n');

    const prompt = `You are a smart restaurant order parser.

Available menu items:
${menuContext}

Customer order text: "${transcribedText}"

Extract the order and return ONLY a valid JSON object (no markdown, no explanation):
{
  "tableNumber": "Table number as string, or 'Takeaway' if not mentioned",
  "items": [
    {
      "menuItemId": "exact _id from the menu list above if matched, else null",
      "name": "item name as spoken",
      "quantity": number,
      "notes": "any special notes mentioned (e.g. extra spicy), else empty string"
    }
  ],
  "rawText": "${transcribedText}"
}

Match item names fuzzy/flexibly. If an item is not in the menu, still include it with menuItemId as null.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();
    const jsonString = extractJSON(responseText, false);
    return JSON.parse(jsonString);
};

/**
 * Smart upsell: Given current cart items, suggest frequently paired items.
 * Uses Gemini to simulate a recommendation when real order history is sparse.
 */
const getUpsellSuggestions = async (cartItems, allMenuItems, topPairs) => {
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-1.5-flash' });

    const cartContext = cartItems.map((i) => i.name).join(', ');
    const menuContext = allMenuItems.slice(0, 30).map((i) => `${i.name} (${i.category})`).join(', ');
    const pairsContext = topPairs.length ? topPairs.map((p) => p.name).join(', ') : 'none';

    const prompt = `You are a restaurant upsell engine. A customer has ordered: ${cartContext}.
Frequently paired items from sales data: ${pairsContext}.
Full menu available: ${menuContext}.

Suggest 3 items to upsell. Return ONLY valid JSON array (no markdown):
[{ "name": "item name", "reason": "short reason why it pairs well" }]`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();
    const jsonString = extractJSON(responseText, true);
    return JSON.parse(jsonString);
};

/**
 * Predictive inventory: Analyze sales to forecast reorder dates.
 */
const forecastInventoryNeeds = async (inventoryAlerts, salesSummary) => {
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-1.5-flash' });

    const prompt = `You are a predictive inventory AI for a restaurant.

Low stock items: ${JSON.stringify(inventoryAlerts)}
Sales summary (last 7 days): ${JSON.stringify(salesSummary)}

Provide reorder recommendations. Return ONLY valid JSON array (no markdown):
[{
  "itemName": "name",
  "currentStock": number,
  "unit": "unit",
  "estimatedDaysLeft": number,
  "recommendedReorderQty": number,
  "urgency": "critical | high | medium"
}]`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();
    const jsonString = extractJSON(responseText, true);
    return JSON.parse(jsonString);
};

module.exports = {
    digitizeMenuFromImage,
    parseVoiceOrder,
    getUpsellSuggestions,
    forecastInventoryNeeds,
};
