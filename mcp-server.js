const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';

const TOOLS = [
  {
    name: 'list_effects',
    description: 'List all available kaleidoscope effects and their default parameters.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'list_outputs',
    description: 'List all generated output images by their server path.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'apply_effect',
    description: 'Apply an effect to an image. Provide either localFilePath (absolute path on disk) or existingImagePath (a /outputs/... path from a previous result).',
    inputSchema: {
      type: 'object',
      properties: {
        effect: { type: 'string', description: 'Effect ID, e.g. 8fold_kaleidoscope' },
        localFilePath: { type: 'string', description: 'Absolute path to an image file on disk' },
        existingImagePath: { type: 'string', description: 'Server path like /outputs/output_XYZ.jpg' },
        params: { type: 'object', description: 'Effect parameters, e.g. { cropSize: "12%" }', additionalProperties: true }
      },
      required: ['effect'],
      oneOf: [
        { required: ['localFilePath'] },
        { required: ['existingImagePath'] }
      ]
    }
  },
  {
    name: 'list_presets',
    description: 'List all saved preset templates.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'save_preset',
    description: 'Save or update a preset with a given name.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        effectId: { type: 'string' },
        params: { type: 'object', additionalProperties: true }
      },
      required: ['name', 'effectId']
    }
  },
  {
    name: 'delete_preset',
    description: 'Delete a preset by name.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' }
      },
      required: ['name']
    }
  },
  {
    name: 'apply_preset',
    description: 'Look up a saved preset by name and apply it to an image.',
    inputSchema: {
      type: 'object',
      properties: {
        presetName: { type: 'string' },
        localFilePath: { type: 'string' },
        existingImagePath: { type: 'string' }
      },
      required: ['presetName'],
      oneOf: [
        { required: ['localFilePath'] },
        { required: ['existingImagePath'] }
      ]
    }
  }
];

async function callListEffects() {
  const res = await fetch(`${BASE_URL}/api/effects`);
  return res.json();
}

async function callListOutputs() {
  const res = await fetch(`${BASE_URL}/api/outputs`);
  return res.json();
}

async function callApplyEffect({ effect, localFilePath, existingImagePath, params }) {
  if (!localFilePath && !existingImagePath) {
    throw new Error('Either localFilePath or existingImagePath must be provided');
  }

  const form = new FormData();
  if (localFilePath) {
    form.append('image', fs.createReadStream(localFilePath), path.basename(localFilePath));
  } else {
    form.append('existingImage', existingImagePath);
  }
  form.append('effect', effect);
  form.append('params', JSON.stringify(params || {}));

  const res = await fetch(`${BASE_URL}/api/process`, {
    method: 'POST',
    body: form,
    headers: form.getHeaders()
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function callListPresets() {
  const res = await fetch(`${BASE_URL}/api/presets`);
  return res.json();
}

async function callSavePreset({ name, effectId, params }) {
  const res = await fetch(`${BASE_URL}/api/presets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, effectId, params: params || {} })
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function callDeletePreset({ name }) {
  const res = await fetch(`${BASE_URL}/api/presets/${encodeURIComponent(name)}`, {
    method: 'DELETE'
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function callApplyPreset({ presetName, localFilePath, existingImagePath }) {
  if (!localFilePath && !existingImagePath) {
    throw new Error('Either localFilePath or existingImagePath must be provided');
  }

  const presetsRes = await fetch(`${BASE_URL}/api/presets`);
  const presetsData = await presetsRes.json();
  const preset = presetsData.presets.find(p => p.name === presetName);

  if (!preset) {
    throw new Error(`Preset "${presetName}" not found`);
  }

  return callApplyEffect({
    effect: preset.effectId,
    localFilePath,
    existingImagePath,
    params: preset.params
  });
}

const handlers = {
  list_effects: callListEffects,
  list_outputs: callListOutputs,
  apply_effect: callApplyEffect,
  list_presets: callListPresets,
  save_preset: callSavePreset,
  delete_preset: callDeletePreset,
  apply_preset: callApplyPreset
};

const server = new Server(
  { name: 'kaleidoscope', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    if (!handlers[name]) {
      throw new Error(`Unknown tool: ${name}`);
    }
    const result = await handlers[name](args);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
    };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Error: ${err.message}` }],
      isError: true
    };
  }
});

async function main() {
  try {
    await fetch(`${BASE_URL}/api/effects`).catch(() => {
      console.error('Warning: Could not connect to kaleidoscope server at http://localhost:3000');
      console.error('Make sure the server is running with: npm start');
    });

    const transport = new StdioServerTransport();
    await server.connect(transport);
  } catch (err) {
    console.error('Server error:', err);
    process.exit(1);
  }
}

main();
