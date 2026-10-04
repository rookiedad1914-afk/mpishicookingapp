import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Recipe, NewRecipeInput } from '../types';

// Helper to get client with current key if available on client
const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key not found");
  return new GoogleGenAI({ apiKey });
};

// The default placeholder image
const DEFAULT_IMAGE_URL = "https://images.unsplash.com/photo-1605522283494-4905a81284d7?q=80&w=1080&auto=format&fit=crop";

const recipeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    description: { type: Type.STRING },
    prepTime: { type: Type.NUMBER, description: "Preparation time in minutes" },
    cookTime: { type: Type.NUMBER, description: "Cooking time in minutes" },
    servings: { type: Type.NUMBER },
    calories: { type: Type.NUMBER, description: "Estimated calories per serving" },
    tags: { type: Type.ARRAY, items: { type: Type.STRING } },
    imageUrl: { type: Type.STRING, description: "URL of an image of the food if found in text" },
    ingredients: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          item: { type: Type.STRING, description: "The name of the ingredient" },
          amount: { type: Type.NUMBER, description: "Numeric amount" },
          unit: { type: Type.STRING, description: "Unit of measurement (e.g., cup, tbsp)" },
          originalString: { type: Type.STRING, description: "The full original line of text" }
        },
        required: ["item", "amount", "unit", "originalString"]
      }
    },
    instructions: { type: Type.ARRAY, items: { type: Type.STRING } }
  },
  required: ["title", "ingredients", "instructions", "prepTime", "cookTime", "servings"]
};

/**
 * Parses a recipe from text OR an image (base64).
 * Prefers the server container endpoint /api/ai/parse to keep API keys secure.
 */
export const parseRecipe = async (text: string, imageBase64?: string): Promise<NewRecipeInput> => {
  // Try server proxy first (secure for self-hosted container)
  try {
    const res = await fetch('/api/ai/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, imageBase64 })
    });
    if (res.ok) {
      const data = await res.json();
      return {
        title: data.title || "Untitled Recipe",
        description: data.description || "",
        prepTime: data.prepTime || 0,
        cookTime: data.cookTime || 0,
        servings: data.servings || 1,
        calories: data.calories,
        tags: data.tags || [],
        ingredients: data.ingredients || [],
        instructions: data.instructions || [],
        sourceUrl: "", 
        imageUrl: data.imageUrl || DEFAULT_IMAGE_URL 
      };
    }
  } catch (err) {
    console.warn('[AI] Server proxy unavailable, checking client fallback...', err);
  }

  // Client-side fallback if API key is in environment
  const ai = getAiClient();
  
  const promptText = `
    You are Mpishi, an expert culinary data extractor.
    Extract a structured recipe object from the provided input (Text or Image).
    
    If analyzing an IMAGE (cookbook page, screenshot):
    - Transcribe the recipe details accurately.
    - Infer prep/cook times if not explicitly stated.
    
    If analyzing TEXT (blog post, pasted content):
    - Clean up any blog spam or irrelevant commentary. Focus purely on the culinary data.
    - If the text contains a URL (especially an image URL ending in jpg, png, etc), extract the image URL into the 'imageUrl' field.
    
    Context/Notes from User: "${text}"
  `;

  const parts: any[] = [];
  if (imageBase64) {
      const cleanBase64 = imageBase64.split(',')[1] || imageBase64;
      parts.push({
          inlineData: {
              mimeType: 'image/jpeg',
              data: cleanBase64
          }
      });
  }

  parts.push({ text: promptText });

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: { parts },
    config: {
      responseMimeType: "application/json",
      responseSchema: recipeSchema,
      systemInstruction: "You are a precise data extractor. Always return JSON matching the schema."
    }
  });

  if (!response.text) {
    throw new Error("Failed to parse recipe");
  }

  const data = JSON.parse(response.text);
  
  return {
    title: data.title || "Untitled Recipe",
    description: data.description || "",
    prepTime: data.prepTime || 0,
    cookTime: data.cookTime || 0,
    servings: data.servings || 1,
    calories: data.calories,
    tags: data.tags || [],
    ingredients: data.ingredients || [],
    instructions: data.instructions || [],
    sourceUrl: "", 
    imageUrl: data.imageUrl || DEFAULT_IMAGE_URL 
  };
};

export const parseRecipeFromText = (text: string) => parseRecipe(text);

export const modifyRecipeWithAI = async (recipe: Recipe, request: string): Promise<NewRecipeInput> => {
  // Try server proxy first
  try {
    const res = await fetch('/api/ai/modify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipe, request })
    });
    if (res.ok) {
      const data = await res.json();
      return {
        ...data,
        imageUrl: data.imageUrl || recipe.imageUrl 
      };
    }
  } catch (err) {
    console.warn('[AI] Server proxy unavailable, checking client fallback...', err);
  }

  const ai = getAiClient();

  const prompt = `
    I have the following recipe JSON:
    ${JSON.stringify(recipe)}

    User Request: "${request}"

    Please modify the recipe to meet the user's request (e.g., scale it, make it vegan, swap an ingredient).
    Return the FULL updated recipe JSON structure.
    Keep the same structure/schema.
    Preserve the imageUrl unless the request specifically asks to change the appearance substantially (even then, prefer keeping it).
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: recipeSchema,
      systemInstruction: "You are Mpishi, a culinary expert. precise adjustments to ingredients and instructions based on dietary needs or scaling."
    }
  });

  if (!response.text) {
    throw new Error("Failed to modify recipe");
  }

  const data = JSON.parse(response.text);
  return {
    ...data,
    imageUrl: data.imageUrl || recipe.imageUrl 
  };
};

export const suggestRecipes = async (recipes: Recipe[], query: string, inventory: string[] = []): Promise<string[]> => {
  // Try server proxy first
  try {
    const res = await fetch('/api/ai/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipes, query, inventory })
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[AI] Server proxy unavailable, checking client fallback...', err);
  }

  const ai = getAiClient();
  
  const recipeIndex = recipes.map(r => ({
      id: r.id,
      title: r.title,
      tags: r.tags,
      ingredients: r.ingredients.map(i => i.item)
  }));

  let prompt = `
      User Query: "${query}"
      
      Available Recipes (JSON):
      ${JSON.stringify(recipeIndex)}

      Return a JSON array of strings containing the 'id' of the recipes that best match the query.
      If no good matches are found, return an empty array.
  `;

  if (inventory.length > 0) {
    prompt += `
      IMPORTANT: The user has the following INVENTORY in their kitchen:
      ${JSON.stringify(inventory)}
      
      Prioritize recipes that utilize these ingredients. 
      It is okay if a recipe needs a few extra ingredients, but favor those where the main components are in the inventory.
    `;
  }

  const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
          responseMimeType: "application/json",
          responseSchema: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
          }
      }
  });

  if (!response.text) return [];
  return JSON.parse(response.text);
};
