import { GoogleGenAI, Type } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-3.7-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-2.5-pro',
  'gemini-2.5-flash-lite',
];

async function generateWithModel(ai: GoogleGenAI, preferredModel: string | undefined, payload: any) {
  const modelToUse = preferredModel && preferredModel !== 'imagen-3.0-generate-002'
    ? preferredModel
    : 'gemini-2.5-flash';

  try {
    const res = await ai.models.generateContent({
      ...payload,
      model: modelToUse,
    });

    if (res && res.text) {
      return { response: res, modelUsed: modelToUse };
    }
    throw new Error('Empty response from Gemini model');
  } catch (err: any) {
    console.warn(`[Gemini Tool] Model "${modelToUse}" failed:`, err?.message || err);
    throw err;
  }
}

// Fallback reverse-prompt generator when offline or API key missing
function generateLocalImageToPrompt(styleFocus?: string) {
  const focus = styleFocus || 'Photorealistic 8K Portrait';
  return {
    title: 'Cinematic Studio Masterpiece',
    promptText: `Hyperrealistic photograph with masterfully composed ${focus} art direction. Captured on 85mm f/1.4 lens, soft volumetric golden hour rim lighting, authentic skin micro-textures, atmospheric depth of field, 8K ultra high resolution, cinematic color grade --ar 16:9 --v 6.1 --style raw`,
    negativePrompt: 'blurry, low resolution, deformed anatomy, extra fingers, cartoon, drawing, plastic skin, bad lighting, oversaturated, watermark, noise',
    camera: 'Sony A7R V with 85mm f/1.4 GM',
    lighting: 'Soft volumetric rim light with natural directional fill',
    composition: 'Rule of thirds portrait framing with shallow depth of field',
    colorPalette: 'Warm golden tones with cinematic teal contrast',
    aspectRatio: '16:9',
    suggestedParameters: {
      model: 'v6.1',
      aspectRatio: '16:9',
      stylize: '250',
      cfgScale: '7.0',
      steps: '30',
    },
    tags: ['Photorealistic', '8K', 'Cinematic Lighting', 'Portrait', 'Masterpiece'],
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      action,
      image,
      referenceImage,
      styleFocus,
      prompt,
      aspectRatio,
      enhanceWithAi,
      selectedModel,
    } = body;

    const apiKey = process.env.GEMINI_API_KEY;

    // =========================================================================
    // ACTION 1: IMAGE TO PROMPT (Reverse-engineering from image)
    // =========================================================================
    if (action === 'image_to_prompt') {
      if (!image) {
        return NextResponse.json({ error: 'Image data is required' }, { status: 400 });
      }

      if (!apiKey) {
        const fallback = generateLocalImageToPrompt(styleFocus);
        return NextResponse.json({ success: true, data: fallback, fallback: true });
      }

      const ai = new GoogleGenAI({ apiKey });

      // Parse image base64 data
      let mimeType = 'image/jpeg';
      let base64Data = '';

      if (image.startsWith('data:')) {
        const match = image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
        if (match) {
          mimeType = match[1];
          base64Data = match[2];
        }
      } else if (image.startsWith('http')) {
        try {
          const imgRes = await fetch(image);
          const arrayBuffer = await imgRes.arrayBuffer();
          base64Data = Buffer.from(arrayBuffer).toString('base64');
          mimeType = imgRes.headers.get('content-type') || 'image/jpeg';
        } catch (fetchErr) {
          console.warn('Failed to fetch remote image for multimodal analysis:', fetchErr);
        }
      }

      if (!base64Data) {
        const fallback = generateLocalImageToPrompt(styleFocus);
        return NextResponse.json({ success: true, data: fallback, fallback: true });
      }

      const promptInstruction = `You are a world-renowned AI Prompt Engineer and Master Photographer.
Examine the provided image with extreme artistic and technical precision:
1. Identify the subject, pose, micro-expressions, apparel, and styling.
2. Analyze the photographic optics: camera model, lens focal length (e.g. 85mm f/1.4, 35mm anamorphic), aperture, and depth of field.
3. Analyze the lighting dynamics: key light, rim light, volumetric fill, studio modifiers, or natural ambient lighting.
4. Analyze the color grading, tones, atmosphere, and textures.
5. Apply the preferred style focus: "${styleFocus || 'Photorealistic & Cinematic'}".

Generate a comprehensive JSON reverse-engineered prompt package.
The "promptText" MUST be a master-level, fully formed, copy-ready prompt containing camera physics, lighting cues, and parameters without placeholder brackets.`;

      const jsonSchemaConfig = {
        systemInstruction: 'You are an expert AI prompt extractor that outputs structured JSON only.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Short descriptive title of the image' },
            promptText: { type: Type.STRING, description: 'Complete ready-to-copy AI prompt' },
            negativePrompt: { type: Type.STRING, description: 'Negative prompt tokens to avoid flaws' },
            camera: { type: Type.STRING, description: 'Exact camera model and lens physics' },
            lighting: { type: Type.STRING, description: 'Lighting setup and direction' },
            composition: { type: Type.STRING, description: 'Framing and angle breakdown' },
            colorPalette: { type: Type.STRING, description: 'Key color tones and grading' },
            aspectRatio: { type: Type.STRING, description: 'Detected aspect ratio (e.g. 16:9, 1:1, 4:5)' },
            suggestedParameters: {
              type: Type.OBJECT,
              properties: {
                model: { type: Type.STRING },
                aspectRatio: { type: Type.STRING },
                stylize: { type: Type.STRING },
                cfgScale: { type: Type.STRING },
                steps: { type: Type.STRING },
              },
            },
            tags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['title', 'promptText', 'negativePrompt', 'camera', 'lighting', 'composition', 'tags'],
        },
      };

      try {
        const { response, modelUsed } = await generateWithModel(ai, selectedModel, {
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              },
              {
                text: promptInstruction,
              },
            ],
          },
          config: jsonSchemaConfig,
        });

        const parsed = JSON.parse(response.text || '{}');
        return NextResponse.json({ success: true, data: parsed, modelUsed });
      } catch (err: any) {
        console.warn('Gemini vision failed, using heuristic reverse prompt:', err?.message);
        const fallback = generateLocalImageToPrompt(styleFocus);
        return NextResponse.json({ success: true, data: fallback, fallback: true });
      }
    }

    // =========================================================================
    // ACTION 2: PROMPT TO IMAGE (Generates image URL & enhanced prompt)
    // =========================================================================
    if (action === 'prompt_to_image') {
      if (!prompt || !prompt.trim()) {
        return NextResponse.json({ error: 'Prompt text is required' }, { status: 400 });
      }

      let finalPrompt = prompt.trim();
      let enhancedPromptText = finalPrompt;
      let modelUsedToSynthesize = selectedModel || 'gemini-2.5-flash';

      // If reference image is provided, enhance prompt with multimodal vision
      if (referenceImage && apiKey) {
        try {
          const ai = new GoogleGenAI({ apiKey });
          let refMimeType = 'image/jpeg';
          let refBase64 = '';

          if (referenceImage.startsWith('data:')) {
            const match = referenceImage.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
            if (match) {
              refMimeType = match[1];
              refBase64 = match[2];
            }
          }

          if (refBase64) {
            const { response, modelUsed } = await generateWithModel(ai, selectedModel, {
              contents: {
                parts: [
                  {
                    inlineData: {
                      mimeType: refMimeType,
                      data: refBase64,
                    },
                  },
                  {
                    text: `You are an expert AI prompt engineer and image-to-image transformation artist. The user has uploaded an input reference image AND provided transformation instructions: "${finalPrompt}".
CRITICAL INSTRUCTION: Do NOT generate an unrelated random image. You must explicitly describe the exact transformation and modification of the uploaded reference image.
Analyze the reference image's subject, pose, face, clothing, facial expression, lighting, and composition. Rewrite the prompt so that it transforms this exact reference image according to the user's instruction: "${finalPrompt}".
Ensure the output is a rich, master-level image-to-image prompt (75+ words) detailing how the reference image is modified and transformed while preserving its core identity and applying the requested changes (e.g. background, lighting, style, or attire). Respond ONLY with the final prompt text.`,
                  },
                ],
              },
            });

            const merged = response.text?.trim();
            if (merged) {
              finalPrompt = merged;
              enhancedPromptText = merged;
              modelUsedToSynthesize = modelUsed;
            }
          }
        } catch (refErr) {
          console.warn('Multimodal reference blend failed:', refErr);
        }
      } else if (enhanceWithAi && apiKey) {
        // Standard text-only enhancement
        try {
          const ai = new GoogleGenAI({ apiKey });
          const { response, modelUsed } = await generateWithModel(ai, selectedModel, {
            contents: `Transform this short prompt into a studio-grade, hyper-detailed photographic master prompt:
Input: "${finalPrompt}"
Respond ONLY with the final enhanced prompt text, nothing else. Keep it under 65 words.`,
          });
          const enhanced = response.text?.trim();
          if (enhanced) {
            enhancedPromptText = enhanced;
            finalPrompt = enhanced;
            modelUsedToSynthesize = modelUsed;
          }
        } catch (enhanceErr) {
          console.warn('Prompt enhancement failed, using original prompt:', enhanceErr);
        }
      }

      // Map aspect ratio to width & height
      let width = 1024;
      let height = 1024;
      switch (aspectRatio) {
        case '16:9':
          width = 1280;
          height = 720;
          break;
        case '9:16':
          width = 720;
          height = 1280;
          break;
        case '4:5':
          width = 864;
          height = 1080;
          break;
        case '3:4':
          width = 768;
          height = 1024;
          break;
        case '1:1':
        default:
          width = 1024;
          height = 1024;
          break;
      }

      const seed = Math.floor(Math.random() * 9999999) + 1000;
      
      // Clean and distill prompt specifically for the image synthesis engine (under 280 chars to avoid HTTP 414 URL length errors)
      const cleanPromptForEngine = finalPrompt
        .replace(/--ar\s+[0-9:]+/gi, '')
        .replace(/--v\s+[0-9.]+/gi, '')
        .replace(/--s\s+[0-9]+/gi, '')
        .replace(/[^\w\s,.-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 260);

      const encodedPrompt = encodeURIComponent(cleanPromptForEngine || 'masterpiece cinematic visual 8k');
      const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&model=flux&nologo=true&seed=${seed}`;
      const alternativeUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&model=turbo&nologo=true&seed=${seed + 77}`;

      return NextResponse.json({
        success: true,
        data: {
          imageUrl,
          alternativeUrl,
          prompt: finalPrompt,
          enhancedPrompt: enhancedPromptText,
          aspectRatio: aspectRatio || '1:1',
          width,
          height,
          seed,
          modelUsed: modelUsedToSynthesize,
        },
      });
    }

    // =========================================================================
    // ACTION 3: PROMPT ENHANCER
    // =========================================================================
    if (action === 'enhance_prompt') {
      if (!prompt) {
        return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
      }

      if (!apiKey) {
        return NextResponse.json({
          success: true,
          data: {
            enhancedPrompt: `${prompt.trim()}, 8K resolution, cinematic lighting, shot on 85mm f/1.4 lens, photorealistic textures, master art direction --ar 16:9 --v 6.1`,
          },
        });
      }

      const ai = new GoogleGenAI({ apiKey });
      const { response, modelUsed } = await generateWithModel(ai, selectedModel, {
        contents: `You are an expert AI prompt engineer. Enhance this prompt with camera physics, lighting cues, and artistic composition:
Prompt: "${prompt}"

Return ONLY the enhanced prompt string.`,
      });

      return NextResponse.json({
        success: true,
        data: {
          enhancedPrompt: response.text?.trim() || prompt,
          modelUsed,
        },
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('AI Studio Tools Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to process AI tool request' },
      { status: 500 }
    );
  }
}
