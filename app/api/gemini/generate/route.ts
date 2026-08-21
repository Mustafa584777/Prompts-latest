import { GoogleGenAI, Type } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

// Prioritized model fallback sequence: if one model fails or is unavailable, switch to the next
const CANDIDATE_MODELS = [
  'gemini-2.5-flash',
  'gemini-3.7-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-2.5-pro',
];

// Reusable executor that tries candidate models in sequence
async function generateWithModelFallback(ai: GoogleGenAI, payload: any) {
  let lastError: any = null;

  for (const model of CANDIDATE_MODELS) {
    try {
      const res = await ai.models.generateContent({
        ...payload,
        model,
      });

      if (res && res.text) {
        return { response: res, modelUsed: model };
      }
    } catch (err: any) {
      console.warn(`[Gemini Switcher] Model "${model}" failed: ${err?.message || err}. Switching to next candidate...`);
      lastError = err;
    }
  }

  throw lastError || new Error('All candidate Gemini models were unavailable.');
}

// Deterministic heuristic generator for resilient offline/fallback scenarios
function generateFallbackPost(topic: string, tool: string, category: string, isFromImage = false) {
  const cleanTitle = (topic || 'Cinematic Photo Composition')
    .trim()
    .replace(/^["']|["']$/g, '');
  const cleanSlug = cleanTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

  const promptText = isFromImage
    ? `Masterpiece photograph of [subject], captured with [camera_lens], cinematic [lighting_setup], natural color grade, photorealistic textures, shallow depth of field, 8K ultra high detail, aesthetic studio art direction --ar 16:9 --v 6.1`
    : `Editorial portrait of [subject], atmospheric [lighting], rich cinematic contrast, shot on [camera_angle], 85mm f/1.4 lens, hyper-detailed skin texture and fabrics, masterpiece quality --ar 16:9 --v 6.1`;

  return {
    title: cleanTitle,
    slug: cleanSlug || 'cinematic-photo-prompt',
    promptText,
    negativePrompt: 'blurry, low quality, deformed anatomy, extra fingers, cartoonish, oversaturated, watermark, bad lighting, grainy artifacts',
    suggestedParameters: {
      aspectRatio: '16:9',
      model: 'v6.1',
      stylize: '250',
      steps: '30',
      cfgScale: '7.0',
      lighting: 'Golden Hour Soft Rim Lighting',
      camera: 'Sony A7R V with 85mm f/1.4 GM',
      renderEngine: 'Raw Photographic Rendering',
    },
    tags: [
      tool || 'Midjourney',
      category || 'Photorealistic & Portraits',
      '8K Resolution',
      'Cinematic Lighting',
      'Editorial Photo',
      'Copy Paste Prompt',
    ],
    seo: {
      metaTitle: `${cleanTitle} | Trending Copy Paste Photo Prompts`,
      metaDescription: `Copy and paste this ${tool || 'Midjourney'} prompt for ${cleanTitle}. Includes calibrated camera parameters, lighting breakdown, and pro tips.`,
      focusKeyword: cleanTitle,
    },
    articleContent: `## About This Prompt

This prompt is crafted to produce clean, hyper-realistic imagery on **${tool || 'Midjourney'}**. By specifying lighting dynamics, lens physics, and realistic textures, you achieve studio-grade results without artificial plastic finishes.

### Composition & Optics Breakdown
- **Subject Framing**: High-definition focus on ${cleanTitle} with authentic surface micro-details.
- **Lighting Dynamics**: Soft volumetric rim light with subtle warm highlights.
- **Lens & Optics**: Sony A7R V with 85mm f/1.4 G-Master lens physics.

### Pro Tips for Highest Quality
1. **Focal Length**: Use 85mm or 50mm lenses for portraits to minimize distortion.
2. **Aspect Ratio**: Keep \`--ar 16:9\` for landscapes and \`--ar 4:5\` for mobile-optimized social posts.
3. **Stylize Value**: Set \`--s 150\` to \`--s 300\` for the optimal balance between prompt obedience and photorealism.`,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, topic, tool, rawPrompt, category, mode, image } = body;

    const apiKey = process.env.GEMINI_API_KEY;

    // Handle full post generation
    if (action === 'generate_full_post') {
      const isImageMode = mode === 'image' || (!!image && mode !== 'title');

      // If API key is not present, return high-quality heuristic generation
      if (!apiKey) {
        const fallbackData = generateFallbackPost(topic || 'Featured Photo Prompt', tool, category, isImageMode);
        return NextResponse.json({ success: true, data: fallbackData, fallback: true });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const systemInstruction = `You are a world-class prompt engineer and AI art director specializing in Midjourney v6, ChatGPT-4o, Flux.1, Stable Diffusion XL, Claude 3.5, and Gemini.
Generate a comprehensive, high-quality prompt package formatted for a prompt directory article like trendinggeminiprompts.com.
Ensure the prompt includes dynamic variable placeholders like [subject], [lighting], [style] so users can customize them.`;

      let contentsPayload: any;

      if (isImageMode && image) {
        // Extract base64 image data or fetch remote image
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

        if (base64Data) {
          const imagePart = {
            inlineData: {
              mimeType,
              data: base64Data,
            },
          };
          const textPart = {
            text: `Thoroughly inspect and reverse-engineer this attached photograph/artwork.
Reverse-engineer its exact aesthetic, lighting setup, subject matter, composition, color palette, camera optics, and mood into a master-level ${tool || 'Midjourney'} ready-to-run prompt package.
Category: "${category || 'Photorealistic & Portraits'}"

Provide a structured JSON output with title, slug, promptText (fully formed, ready-to-copy photographic prompt without placeholder brackets), negativePrompt, suggestedParameters (aspectRatio, model, stylize, steps, cfgScale, lighting, camera, renderEngine), tags array (5-8 tags), seo (metaTitle, metaDescription, focusKeyword), and articleContent (a rich markdown guide explaining how the prompt works, lighting/camera breakdowns, parameter settings, and pro tips).`,
          };
          contentsPayload = { parts: [imagePart, textPart] };
        } else {
          // Fallback to text prompt
          contentsPayload = `Create a complete prompt post based on image concept: "${topic || 'Photorealistic Artwork'}" for ${tool || 'Midjourney'}.`;
        }
      } else {
        contentsPayload = `Create a complete, master-level prompt post for:
Topic / Idea: "${topic || 'Futuristic cybernetic portrait'}"
Target AI Platform: "${tool || 'Midjourney'}"
Category: "${category || 'Photorealistic & Portraits'}"

Provide a structured JSON output with title, slug, promptText (fully formed, ready-to-copy photographic prompt without placeholder brackets), negativePrompt, suggestedParameters (e.g. aspectRatio, model, stylize, steps, lighting, camera, renderEngine), tags array (5-8 tags), seo (metaTitle, metaDescription, focusKeyword), and articleContent (a rich markdown guide explaining how the prompt works, lighting/camera breakdowns, parameter settings, and pro tips).`;
      }

      const jsonSchemaConfig = {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            slug: { type: Type.STRING },
            promptText: { type: Type.STRING },
            negativePrompt: { type: Type.STRING },
            suggestedParameters: {
              type: Type.OBJECT,
              properties: {
                aspectRatio: { type: Type.STRING },
                model: { type: Type.STRING },
                stylize: { type: Type.STRING },
                steps: { type: Type.STRING },
                cfgScale: { type: Type.STRING },
                lighting: { type: Type.STRING },
                camera: { type: Type.STRING },
                renderEngine: { type: Type.STRING },
              },
            },
            tags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            seo: {
              type: Type.OBJECT,
              properties: {
                metaTitle: { type: Type.STRING },
                metaDescription: { type: Type.STRING },
                focusKeyword: { type: Type.STRING },
              },
              required: ['metaTitle', 'metaDescription', 'focusKeyword'],
            },
            articleContent: { type: Type.STRING },
          },
          required: ['title', 'slug', 'promptText', 'tags', 'seo', 'articleContent'],
        },
      };

      try {
        const { response, modelUsed } = await generateWithModelFallback(ai, {
          contents: contentsPayload,
          config: jsonSchemaConfig,
        });

        const parsedData = JSON.parse(response.text || '{}');
        return NextResponse.json({ success: true, data: parsedData, modelUsed });
      } catch (geminiError: any) {
        console.warn('Gemini models error, applying smart local fallback:', geminiError?.message);
        const fallbackData = generateFallbackPost(topic || 'Featured Photo Prompt', tool, category, isImageMode);
        return NextResponse.json({ success: true, data: fallbackData, fallback: true });
      }
    }

    if (action === 'enhance_prompt') {
      if (!apiKey) {
        return NextResponse.json({
          success: true,
          data: {
            enhancedPrompt: `${rawPrompt || 'A stunning photo'}, 8K resolution, cinematic lighting, shot on 85mm f/1.4 lens, photorealistic textures, master art direction --ar 16:9 --v 6.1`,
            negativePrompt: 'blurry, low quality, deformed anatomy, grainy, bad composition',
            suggestedParameters: {
              aspectRatio: '16:9',
              model: 'v6.1',
              lighting: 'Dramatic Rim Light',
              camera: '85mm f/1.4 Prime',
            },
            explanation: 'Enhanced with professional camera framing and lighting tokens.',
          },
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const { response, modelUsed } = await generateWithModelFallback(ai, {
        contents: `Enhance this prompt to make it photographic, detailed, and visually breathtaking for ${tool || 'Midjourney'}:
Input Prompt: "${rawPrompt}"

Return a JSON with "enhancedPrompt", "negativePrompt", "suggestedParameters" and "explanation".`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              enhancedPrompt: { type: Type.STRING },
              negativePrompt: { type: Type.STRING },
              suggestedParameters: {
                type: Type.OBJECT,
                properties: {
                  aspectRatio: { type: Type.STRING },
                  model: { type: Type.STRING },
                  lighting: { type: Type.STRING },
                  camera: { type: Type.STRING },
                },
              },
              explanation: { type: Type.STRING },
            },
            required: ['enhancedPrompt', 'negativePrompt'],
          },
        },
      });

      const parsedData = JSON.parse(response.text || '{}');
      return NextResponse.json({ success: true, data: parsedData, modelUsed });
    }

    return NextResponse.json({ error: 'Unknown action specified' }, { status: 400 });
  } catch (error: any) {
    console.error('Gemini API Route Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to process AI request' },
      { status: 500 }
    );
  }
}

