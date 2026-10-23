import { createDesignFromPrompt, validateDesign } from '../../src/design-engine.js';

const ALLOWED_TYPES = new Set(['House', 'Plaza', 'Shop', 'University', 'Office', 'Apartment', 'Road', 'Tunnel', 'Commercial Building', 'School', 'Hospital', 'Parking']);

function sanitizeAiSpec(value) {
  if (!value || typeof value !== 'object') throw new Error('AI specification was not an object.');
  const spec = {};
  if (ALLOWED_TYPES.has(value.projectType)) spec.projectType = value.projectType;
  for (const key of ['width', 'depth', 'floors', 'bedrooms', 'bathrooms']) {
    if (Number.isFinite(Number(value[key]))) spec[key] = Number(value[key]);
  }
  if (['meters', 'feet', 'marla', 'kanal'].includes(value.unit)) spec.unit = value.unit;
  if (['Modern', 'Contemporary', 'Traditional', 'Minimalist'].includes(value.style)) spec.style = value.style;
  if (typeof value.location === 'string') spec.location = value.location.slice(0, 80);
  if (typeof value.parking === 'boolean') spec.parking = value.parking;
  return spec;
}

export function aiStatus(env) {
  const configured = env.aiProvider !== 'procedural' && Boolean(env.aiApiKey);
  return { configured, provider: configured ? env.aiProvider : 'procedural' };
}

export async function interpretDesign(prompt, previous, env) {
  const procedural = createDesignFromPrompt(prompt, previous || {});
  validateDesign(procedural);
  const status = aiStatus(env);
  if (!status.configured) {
    return {
      config: procedural,
      source: 'BuildRight procedural geometry service',
      ai: { configured: false, used: false, provider: 'procedural' },
    };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.aiTimeoutMs);
  try {
    const response = await fetch(`${env.aiBaseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${env.aiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.aiModel || 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Extract a construction design specification as JSON with projectType, width, depth, floors, unit, style, location, bedrooms, bathrooms, and parking. Do not invent dimensions that the user did not state.' },
          { role: 'user', content: prompt },
        ],
      }),
    });
    if (!response.ok) throw new Error(`AI provider responded with ${response.status}.`);
    const payload = await response.json();
    const content = payload.choices?.[0]?.message?.content;
    const extracted = sanitizeAiSpec(JSON.parse(content));
    const merged = createDesignFromPrompt(prompt, { ...procedural, ...extracted });
    validateDesign(merged);
    return {
      config: merged,
      source: 'Configured AI extraction with BuildRight procedural geometry',
      ai: { configured: true, used: true, provider: env.aiProvider },
    };
  } catch (error) {
    return {
      config: procedural,
      source: 'BuildRight procedural geometry service',
      ai: {
        configured: true,
        used: false,
        provider: env.aiProvider,
        warning: `The configured AI provider did not return a usable specification (${error.message}). Procedural interpretation was used instead.`,
      },
    };
  } finally {
    clearTimeout(timer);
  }
}
