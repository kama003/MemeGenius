
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { AnalysisResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to convert Blob/File to Base64
export const fileToB64 = (file: File | Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      // Remove data url prefix (e.g. "data:image/jpeg;base64,")
      resolve(base64.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const generateFunnyImagePrompts = async (imageBase64: string): Promise<string[]> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: imageBase64
            }
          },
          {
            text: "Analyze this image and generate 5 funny, creative, and absurd prompts to edit this image into a meme or funny situation. The prompts should be instructions for an image editing AI (e.g., 'Make the person hold a giant taco', 'Turn the background into a chaotic alien invasion'). Return ONLY the prompts."
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING
          }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as string[];
    }
    return [];
  } catch (error) {
    console.error("Error generating prompts:", error);
    throw error;
  }
};

export const analyzeImageContext = async (imageBase64: string): Promise<AnalysisResult> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: imageBase64
            }
          },
          {
            text: "Perform a detailed analysis of this image. Describe the visual content, the mood/tone, and extract 5 key visual keywords."
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            mood: { type: Type.STRING },
            keywords: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["description", "mood", "keywords"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as AnalysisResult;
    }
    throw new Error("No analysis returned");
  } catch (error) {
    console.error("Error analyzing image:", error);
    throw error;
  }
};

export const editImageWithPrompt = async (imageBase64: string, prompt: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: imageBase64
            }
          },
          {
            text: prompt
          }
        ]
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1"
        }
      }
    });

    const parts = response.candidates?.[0]?.content?.parts;
    if (parts && parts.length > 0) {
        const imagePart = parts.find(p => p.inlineData);
        if (imagePart && imagePart.inlineData && imagePart.inlineData.data) {
             return imagePart.inlineData.data;
        }
    }
    throw new Error("No image generated");
  } catch (error) {
    console.error("Error editing image:", error);
    throw error;
  }
};

export const generateFunnyImage = async (prompt: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: `Create a funny, meme-worthy image based on this idea: ${prompt}`
          }
        ]
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1"
        }
      }
    });

    const parts = response.candidates?.[0]?.content?.parts;
    if (parts && parts.length > 0) {
        const imagePart = parts.find(p => p.inlineData);
        if (imagePart && imagePart.inlineData && imagePart.inlineData.data) {
             return imagePart.inlineData.data;
        }
    }
    throw new Error("No image generated");
  } catch (error) {
    console.error("Error generating image:", error);
    throw error;
  }
};
