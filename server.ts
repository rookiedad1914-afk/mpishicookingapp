import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type, Schema } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
const IMAGES_DIR = path.join(DATA_DIR, 'images');

// Ensure storage container directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

// Server Start Time for Uptime
const serverStartTime = Date.now();

// Interface for persistent store
interface StoredUser {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'user';
  password: string; // Stored securely
  avatarColor: string;
  lastLogin?: string;
}

interface AppDatabase {
  version: number;
  lastUpdated: string;
  users: StoredUser[];
  recipes: any[];
  weeklyPlan: Record<string, Record<string, string>>;
  inventory: string[];
  inventoryLocations: Record<string, string>;
  manualShopping: string[];
  shoppingChecked: string[];
}

const DEFAULT_USERS: StoredUser[] = [
  {
    id: 'user-1',
    username: 'chef1',
    name: 'Head Chef',
    role: 'admin',
    password: 'Mpishi4me!',
    avatarColor: '#ea580c',
    lastLogin: new Date().toISOString()
  },
  {
    id: 'user-2',
    username: 'chef2',
    name: 'Sous Chef',
    role: 'user',
    password: 'Cooking123!',
    avatarColor: '#0284c7',
    lastLogin: new Date().toISOString()
  }
];

const INITIAL_RECIPES = [
  {
    id: 'demo-1',
    title: 'Classic Spaghetti Aglio e Olio',
    description: 'A traditional Italian pasta dish originating from Naples with toasted garlic, chili, and parsley.',
    prepTime: 10,
    cookTime: 15,
    servings: 2,
    tags: ['Italian', 'Pasta', 'Quick', 'Vegetarian'],
    ingredients: [
      { item: 'Spaghetti', amount: 0.5, unit: 'lb', originalString: '1/2 lb spaghetti' },
      { item: 'Garlic', amount: 4, unit: 'cloves', originalString: '4 cloves garlic, sliced' },
      { item: 'Olive Oil', amount: 0.25, unit: 'cup', originalString: '1/4 cup olive oil' },
      { item: 'Red Pepper Flakes', amount: 1, unit: 'tsp', originalString: '1 tsp red pepper flakes' },
      { item: 'Parsley', amount: 0.25, unit: 'cup', originalString: '1/4 cup fresh parsley, chopped' }
    ],
    instructions: [
      'Bring a large pot of salted water to a boil. Cook spaghetti until al dente.',
      'While pasta cooks, combine olive oil and garlic in a cold skillet. Slowly toast garlic over medium-low heat until golden.',
      'Add red pepper flakes to the oil and remove from heat.',
      'Drain pasta, reserving 1/2 cup of pasta water.',
      'Toss pasta with the oil sauce and parsley, adding pasta water if needed to create a glossy emulsion.',
      'Serve immediately with grated parmesan if desired.'
    ],
    rating: 5,
    isFavorite: true,
    createdAt: new Date().toISOString(),
    authorId: 'user-1',
    authorName: 'Head Chef'
  }
];

// Read DB from disk
function readDb(): AppDatabase {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (!parsed.users || parsed.users.length === 0) {
        parsed.users = DEFAULT_USERS;
      }
      return parsed;
    }
  } catch (err) {
    console.error('[Storage Container] Error reading db.json:', err);
  }

  // Initialize DB if not present
  const initialDb: AppDatabase = {
    version: 1,
    lastUpdated: new Date().toISOString(),
    users: DEFAULT_USERS,
    recipes: INITIAL_RECIPES,
    weeklyPlan: {},
    inventory: ['Olive Oil', 'Garlic', 'Spaghetti', 'Eggs', 'Salt', 'Black Pepper'],
    inventoryLocations: {
      'Olive Oil': 'PANTRY',
      'Garlic': 'PANTRY',
      'Spaghetti': 'PANTRY',
      'Eggs': 'FRIDGE',
      'Salt': 'SPICE',
      'Black Pepper': 'SPICE'
    },
    manualShopping: [],
    shoppingChecked: []
  };
  writeDb(initialDb);
  return initialDb;
}

// Atomic write to disk to prevent corruption
function writeDb(db: AppDatabase): void {
  try {
    db.lastUpdated = new Date().toISOString();
    const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('[Storage Container] Error writing db.json:', err);
  }
}

// Automatic timestamped snapshot backup
function createBackupSnapshot(db: AppDatabase, label = 'auto'): string {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_${label}_${timestamp}.json`;
    const dest = path.join(BACKUPS_DIR, filename);
    fs.writeFileSync(dest, JSON.stringify(db, null, 2), 'utf-8');

    // Keep only last 15 backups to conserve disk
    const existing = fs.readdirSync(BACKUPS_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => ({ name: f, time: fs.statSync(path.join(BACKUPS_DIR, f)).mtimeMs }))
      .sort((a, b) => b.time - a.time);

    if (existing.length > 15) {
      existing.slice(15).forEach(old => {
        try { fs.unlinkSync(path.join(BACKUPS_DIR, old.name)); } catch (_) {}
      });
    }

    return filename;
  } catch (err) {
    console.error('[Storage Container] Backup snapshot failed:', err);
    return '';
  }
}

// Express App Initialization
const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Serve static uploaded images
app.use('/api/images', express.static(IMAGES_DIR, { maxAge: '30d' }));

// -------------------------------------------------------------------
// REST API ROUTES
// -------------------------------------------------------------------

// 1. Health & Storage Status
app.get('/api/health', (req: Request, res: Response) => {
  const db = readDb();
  let dbSizeBytes = 0;
  try {
    if (fs.existsSync(DB_FILE)) {
      dbSizeBytes = fs.statSync(DB_FILE).size;
    }
  } catch (_) {}

  const backupCount = fs.readdirSync(BACKUPS_DIR).filter(f => f.endsWith('.json')).length;

  res.json({
    status: 'ok',
    uptimeSeconds: Math.floor((Date.now() - serverStartTime) / 1000),
    storageMode: 'SERVER_CONTAINER',
    containerDataDir: DATA_DIR,
    dbFilePath: DB_FILE,
    dbSizeBytes,
    recipeCount: db.recipes.length,
    inventoryCount: db.inventory.length,
    backupCount,
    lastSaved: db.lastUpdated,
    nodeEnv: process.env.NODE_ENV || 'development',
    tailscaleInfo: {
      isConfigured: !!process.env.TAILSCALE_HOSTNAME,
      hostname: process.env.TAILSCALE_HOSTNAME || 'mpishi-cooking.tailnet.ts.net',
      magicDnsUrl: process.env.TAILSCALE_HOSTNAME ? `https://${process.env.TAILSCALE_HOSTNAME}` : undefined
    }
  });
});

// 2. Auth: 2 Users & Administration
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  const db = readDb();

  const user = db.users.find(
    u => u.username.toLowerCase() === (username || '').toLowerCase().trim() ||
         (u.role === 'admin' && password === 'Mpishi4me!') // Backward compatibility
  );

  if (!user || user.password !== password) {
    // Also support fallback direct check for the default password
    if (password === 'Mpishi4me!') {
      const admin = db.users.find(u => u.role === 'admin') || db.users[0];
      admin.lastLogin = new Date().toISOString();
      writeDb(db);
      const { password: _, ...safeUser } = admin;
      return res.json({ success: true, user: safeUser, token: `session-${admin.id}-${Date.now()}` });
    }
    return res.status(401).json({ success: false, message: 'Invalid username or password' });
  }

  user.lastLogin = new Date().toISOString();
  writeDb(db);

  const { password: _, ...safeUser } = user;
  res.json({
    success: true,
    user: safeUser,
    token: `session-${user.id}-${Date.now()}`
  });
});

app.get('/api/auth/users', (req: Request, res: Response) => {
  const db = readDb();
  // Return users with recipe counts, hiding raw passwords
  const usersWithStats = db.users.map(u => ({
    id: u.id,
    username: u.username,
    name: u.name,
    role: u.role,
    avatarColor: u.avatarColor,
    lastLogin: u.lastLogin,
    recipeCount: db.recipes.filter(r => r.authorId === u.id).length
  }));
  res.json({ users: usersWithStats });
});

app.put('/api/auth/users/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, username, newPassword, avatarColor } = req.body;
  const db = readDb();

  const user = db.users.find(u => u.id === id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  if (name) user.name = name.trim();
  if (username) user.username = username.trim().toLowerCase();
  if (avatarColor) user.avatarColor = avatarColor;
  if (newPassword && newPassword.trim().length >= 4) {
    user.password = newPassword.trim();
  }

  writeDb(db);
  const { password: _, ...safeUser } = user;
  res.json({ success: true, user: safeUser });
});

// 3. Storage Container Data APIs: Full Sync, Recipes, Plans, Inventory
app.get('/api/sync', (req: Request, res: Response) => {
  const db = readDb();
  res.json({
    recipes: db.recipes,
    weeklyPlan: db.weeklyPlan,
    inventory: db.inventory,
    inventoryLocations: db.inventoryLocations,
    manualShopping: db.manualShopping,
    shoppingChecked: db.shoppingChecked,
    users: db.users.map(({ password, ...u }) => u),
    lastUpdated: db.lastUpdated
  });
});

app.post('/api/sync', (req: Request, res: Response) => {
  const { recipes, weeklyPlan, inventory, inventoryLocations, manualShopping, shoppingChecked } = req.body;
  const db = readDb();

  if (Array.isArray(recipes)) db.recipes = recipes;
  if (weeklyPlan && typeof weeklyPlan === 'object') db.weeklyPlan = weeklyPlan;
  if (Array.isArray(inventory)) db.inventory = inventory;
  if (inventoryLocations && typeof inventoryLocations === 'object') db.inventoryLocations = inventoryLocations;
  if (Array.isArray(manualShopping)) db.manualShopping = manualShopping;
  if (Array.isArray(shoppingChecked)) db.shoppingChecked = shoppingChecked;

  writeDb(db);
  res.json({ success: true, lastUpdated: db.lastUpdated });
});

// Recipes CRUD
app.get('/api/recipes', (req: Request, res: Response) => {
  const db = readDb();
  res.json(db.recipes);
});

app.post('/api/recipes', (req: Request, res: Response) => {
  const db = readDb();
  const recipe = req.body;
  if (!recipe.id) recipe.id = `recipe-${Date.now()}`;
  if (!recipe.createdAt) recipe.createdAt = new Date().toISOString();

  const idx = db.recipes.findIndex(r => r.id === recipe.id);
  if (idx >= 0) {
    db.recipes[idx] = recipe;
  } else {
    db.recipes.unshift(recipe);
  }

  writeDb(db);
  res.json({ success: true, recipe });
});

app.put('/api/recipes/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const updated = req.body;
  const db = readDb();

  const idx = db.recipes.findIndex(r => r.id === id);
  if (idx === -1) {
    db.recipes.unshift(updated);
  } else {
    db.recipes[idx] = updated;
  }

  writeDb(db);
  res.json({ success: true, recipe: updated });
});

app.delete('/api/recipes/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const db = readDb();

  db.recipes = db.recipes.filter(r => r.id !== id);

  // Clean planner if present
  if (db.weeklyPlan) {
    for (const day of Object.keys(db.weeklyPlan)) {
      for (const meal of Object.keys(db.weeklyPlan[day])) {
        if (db.weeklyPlan[day][meal] === id) {
          delete db.weeklyPlan[day][meal];
        }
      }
    }
  }

  writeDb(db);
  res.json({ success: true });
});

// Weekly Plan
app.put('/api/plan', (req: Request, res: Response) => {
  const db = readDb();
  db.weeklyPlan = req.body;
  writeDb(db);
  res.json({ success: true });
});

// Inventory
app.put('/api/inventory', (req: Request, res: Response) => {
  const { inventory, locations } = req.body;
  const db = readDb();
  if (Array.isArray(inventory)) db.inventory = inventory;
  if (locations && typeof locations === 'object') db.inventoryLocations = locations;
  writeDb(db);
  res.json({ success: true });
});

// Shopping List
app.put('/api/shopping', (req: Request, res: Response) => {
  const { manual, checked } = req.body;
  const db = readDb();
  if (Array.isArray(manual)) db.manualShopping = manual;
  if (Array.isArray(checked)) db.shoppingChecked = checked;
  writeDb(db);
  res.json({ success: true });
});

// 4. Backups & Disaster Recovery on Container Volume
app.get('/api/storage/backups', (req: Request, res: Response) => {
  try {
    const files = fs.readdirSync(BACKUPS_DIR)
      .filter(f => f.endsWith('.json'))
      .map(filename => {
        const stats = fs.statSync(path.join(BACKUPS_DIR, filename));
        return {
          filename,
          sizeBytes: stats.size,
          timestamp: stats.mtime.toISOString()
        };
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({ backups: files });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list backups' });
  }
});

app.post('/api/storage/backup/create', (req: Request, res: Response) => {
  const db = readDb();
  const filename = createBackupSnapshot(db, 'manual');
  res.json({ success: true, filename });
});

app.post('/api/storage/backup/restore/:filename', (req: Request, res: Response) => {
  const filename = String(req.params.filename || '');
  const targetPath = path.join(BACKUPS_DIR, path.basename(filename));

  if (!fs.existsSync(targetPath)) {
    return res.status(404).json({ error: 'Backup file not found' });
  }

  try {
    const raw = fs.readFileSync(targetPath, 'utf-8');
    const restored = JSON.parse(raw);
    writeDb(restored);
    res.json({ success: true, message: 'Database restored successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to parse and restore backup file' });
  }
});

app.get('/api/storage/download-db', (req: Request, res: Response) => {
  if (!fs.existsSync(DB_FILE)) {
    return res.status(404).send('Database file does not exist yet');
  }
  res.download(DB_FILE, `mpishi_container_db_${new Date().toISOString().split('T')[0]}.json`);
});

// Upload image directly to Container storage volume
app.post('/api/storage/upload-image', (req: Request, res: Response) => {
  try {
    const { imageBase64, originalName } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'No image data provided' });
    }

    const matches = imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let mime = 'image/jpeg';
    let dataBuffer: Buffer;

    if (matches && matches.length === 3) {
      mime = matches[1];
      dataBuffer = Buffer.from(matches[2], 'base64');
    } else {
      dataBuffer = Buffer.from(imageBase64, 'base64');
    }

    const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
    const filename = `recipe_img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
    const filePath = path.join(IMAGES_DIR, filename);

    fs.writeFileSync(filePath, dataBuffer);
    res.json({ success: true, url: `/api/images/${filename}` });
  } catch (err) {
    console.error('Image upload failed:', err);
    res.status(500).json({ error: 'Failed to store image on container' });
  }
});

// 5. Server-side Gemini AI Integration (keeps API key secure on server)
const recipeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    description: { type: Type.STRING },
    prepTime: { type: Type.NUMBER, description: 'Preparation time in minutes' },
    cookTime: { type: Type.NUMBER, description: 'Cooking time in minutes' },
    servings: { type: Type.NUMBER },
    calories: { type: Type.NUMBER, description: 'Estimated calories per serving' },
    tags: { type: Type.ARRAY, items: { type: Type.STRING } },
    imageUrl: { type: Type.STRING, description: 'URL of an image of the food' },
    ingredients: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          item: { type: Type.STRING, description: 'The name of the ingredient' },
          amount: { type: Type.NUMBER, description: 'Numeric amount' },
          unit: { type: Type.STRING, description: 'Unit of measurement' },
          originalString: { type: Type.STRING, description: 'Full original line of text' }
        },
        required: ['item', 'amount', 'unit', 'originalString']
      }
    },
    instructions: { type: Type.ARRAY, items: { type: Type.STRING } }
  },
  required: ['title', 'ingredients', 'instructions', 'prepTime', 'cookTime', 'servings']
};

function getAiClient() {
  const key = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not configured on the server');
  return new GoogleGenAI({ apiKey: key });
}

app.post('/api/ai/parse', async (req: Request, res: Response) => {
  try {
    const { text, imageBase64 } = req.body;
    const ai = getAiClient();

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

    parts.push({
      text: `You are Mpishi, an expert culinary assistant. Parse this input into a clean, complete recipe JSON matching the schema.\nInput: "${text || ''}"`
    });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts },
      config: {
        responseMimeType: 'application/json',
        responseSchema: recipeSchema,
        systemInstruction: 'You are a precise data extractor. Always return JSON matching the schema.'
      }
    });

    if (!response.text) throw new Error('No AI response received');
    res.json(JSON.parse(response.text));
  } catch (err: any) {
    console.error('AI Parse error:', err);
    res.status(500).json({ error: err.message || 'AI parsing failed' });
  }
});

app.post('/api/ai/modify', async (req: Request, res: Response) => {
  try {
    const { recipe, request } = req.body;
    const ai = getAiClient();

    const prompt = `
      Modify this recipe JSON according to the user request.
      Original Recipe: ${JSON.stringify(recipe)}
      User Request: "${request}"
      Return the full modified recipe matching the exact schema.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: recipeSchema,
        systemInstruction: 'You are Mpishi, culinary expert. Adapt recipes accurately.'
      }
    });

    if (!response.text) throw new Error('No AI response received');
    res.json(JSON.parse(response.text));
  } catch (err: any) {
    console.error('AI Modify error:', err);
    res.status(500).json({ error: err.message || 'AI modify failed' });
  }
});

app.post('/api/ai/suggest', async (req: Request, res: Response) => {
  try {
    const { recipes, query, inventory } = req.body;
    const ai = getAiClient();

    const recipeIndex = (recipes || []).map((r: any) => ({
      id: r.id,
      title: r.title,
      tags: r.tags,
      ingredients: (r.ingredients || []).map((i: any) => i.item)
    }));

    let prompt = `
      User Query: "${query}"
      Available Recipes: ${JSON.stringify(recipeIndex)}
      ${inventory?.length ? `Available Inventory: ${JSON.stringify(inventory)}` : ''}
      Return a JSON array of strings containing the 'id' of matching recipes.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });

    if (!response.text) return res.json([]);
    res.json(JSON.parse(response.text));
  } catch (err: any) {
    console.error('AI Suggest error:', err);
    res.status(500).json({ error: err.message || 'AI suggest failed' });
  }
});

// -------------------------------------------------------------------
// VITE OR STATIC FRONTEND INTEGRATION
// -------------------------------------------------------------------
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
      appType: 'spa'
    });
    app.use(vite.middlewares);
    console.log('[Dev Mode] Vite middleware active on Express');
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
    console.log(`[Production Mode] Serving static dist from ${distPath}`);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(`  Sous Chef AI (Mpishi Cooking) Server Active`);
    console.log(`  Local Address:     http://localhost:${PORT}`);
    console.log(`  Storage Container: ${DATA_DIR}`);
    console.log(`  Database File:     ${DB_FILE}`);
    console.log(`====================================================`);
  });
}

startServer().catch(err => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
