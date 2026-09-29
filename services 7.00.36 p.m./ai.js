const OPENAI_URL = 'https://api.openai.com/v1/responses';

function hasAI() { return Boolean(process.env.OPENAI_API_KEY); }
function model() { return process.env.OPENAI_MODEL || 'gpt-5.6'; }

async function callAI({ system, input, jsonSchema }) {
  if (!hasAI()) return null;
  const body = {
    model: model(),
    instructions: system,
    input,
  };
  if (jsonSchema) {
    body.text = {
      format: {
        type: 'json_schema',
        name: jsonSchema.name || 'response',
        schema: jsonSchema.schema,
        strict: true
      }
    };
  }
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`OPENAI_${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.output_text || data.output?.flatMap(o => o.content || []).find(c => c.type === 'output_text')?.text;
  if (!text) throw new Error('OPENAI_EMPTY_RESPONSE');
  return jsonSchema ? JSON.parse(text) : text;
}

async function generateImage(prompt) {
  if (!hasAI()) return null;
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method:'POST',
    headers:{'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},
    body:JSON.stringify({model:process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2',prompt,size:'1024x1024'})
  });
  if (!res.ok) throw new Error(`OPENAI_IMAGE_${res.status}: ${await res.text()}`);
  const data = await res.json();
  const item = data.data?.[0];
  return item?.url || (item?.b64_json ? `data:image/png;base64,${item.b64_json}` : null);
}

module.exports = { hasAI, callAI, generateImage };
