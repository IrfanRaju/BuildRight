const STYLES = new Set(['Modern', 'Traditional', 'Minimal', 'Warm', 'Cool']);
const FINISHES = new Set(['Matte', 'Satin', 'Gloss', 'Textured', 'Stone']);
const SURFACES = new Set(['wall', 'exterior', 'floor', 'kitchen', 'bathroom', 'room']);

export function previewStatus(env) {
  return { configured: Boolean(env.imageApiKey), provider: env.imageApiKey ? 'configured-image-api' : 'local-color-concept' };
}

export async function conceptPreview({ color, finish, style, surface, env }) {
  const safe = {
    color: /^#[0-9a-fA-F]{6}$/.test(color || '') ? color : '#F4E4C8',
    finish: FINISHES.has(finish) ? finish : 'Matte',
    style: STYLES.has(style) ? style : 'Modern',
    surface: SURFACES.has(surface) ? surface : 'room',
  };
  if (!env.imageApiKey) {
    return {
      configured: false,
      used: false,
      mode: 'local-color-concept',
      ...safe,
      message: 'Image generation is not configured. Use the on-screen color overlay. It is a visual concept, not an exact picture of the finished repair and not proof that hidden damage has been fixed.',
    };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.aiTimeoutMs || 20000);
  try {
    const response = await fetch(`${env.imageBaseUrl.replace(/\/$/, '')}/images/generations`, {
      method: 'POST',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${env.imageApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: env.imageModel || 'dall-e-2',
        size: '512x512',
        response_format: 'b64_json',
        prompt: `A ${safe.style.toLowerCase()} ${safe.surface} interior concept with a ${safe.finish.toLowerCase()} finish in color ${safe.color}. Empty of people and text. This is a design concept, not a photograph of a completed repair.`,
      }),
    });
    if (!response.ok) throw new Error(`Image service responded with ${response.status}.`);
    const payload = await response.json();
    const encoded = payload.data?.[0]?.b64_json;
    if (!encoded) throw new Error('Image service returned no image.');
    return {
      configured: true,
      used: true,
      mode: 'ai-concept',
      ...safe,
      imageDataUrl: `data:image/png;base64,${encoded}`,
      message: 'This AI image is a visual concept generated from your color and style choices. It is not an exact representation of the final result and it is not proof that hidden damage has been repaired. Your uploaded photograph was not sent to the image service.',
    };
  } catch (error) {
    return {
      configured: true,
      used: false,
      mode: 'local-color-concept',
      ...safe,
      message: `The image service did not return a concept (${error.message}). The on-screen color overlay is still only a visual concept.`,
    };
  } finally {
    clearTimeout(timer);
  }
}
