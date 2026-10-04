import { Recipe, WeeklyPlan, StorageLocation, UserProfile, StorageStats, ServerBackupFile } from '../types';

const STORAGE_KEY = 'sous_chef_recipes';
const PLAN_KEY = 'sous_chef_weekly_plan';
const SHOPPING_LIST_KEY = 'sous_chef_shopping_list_checked';
const SHOPPING_MANUAL_KEY = 'sous_chef_shopping_manual';
const INVENTORY_KEY = 'sous_chef_inventory';
const INVENTORY_LOCATIONS_KEY = 'sous_chef_inventory_locations';
const ACTIVE_USER_KEY = 'mpishi_active_user';

// Online/Offline & Sync state
let isServerReachable = true;

export const checkServerConnection = async (): Promise<boolean> => {
  try {
    const res = await fetch('/api/health', { signal: AbortSignal.timeout(2000) });
    isServerReachable = res.ok;
    return res.ok;
  } catch (_) {
    isServerReachable = false;
    return false;
  }
};

export const getActiveUser = (): UserProfile | null => {
  try {
    const raw = localStorage.getItem(ACTIVE_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
};

export const setActiveUser = (user: UserProfile | null): void => {
  if (user) {
    localStorage.setItem(ACTIVE_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(ACTIVE_USER_KEY);
  }
};

// -------------------------------------------------------------------
// SYNCHRONIZATION WITH STORAGE CONTAINER
// -------------------------------------------------------------------

export const syncWithServer = async (): Promise<{
  recipes: Recipe[];
  weeklyPlan: WeeklyPlan;
  inventory: string[];
  inventoryLocations: Record<string, StorageLocation>;
  manualShopping: string[];
  shoppingChecked: string[];
  users: UserProfile[];
} | null> => {
  try {
    const res = await fetch('/api/sync', { signal: AbortSignal.timeout(3500) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // Cache to localStorage
    if (data.recipes) localStorage.setItem(STORAGE_KEY, JSON.stringify(data.recipes));
    if (data.weeklyPlan) localStorage.setItem(PLAN_KEY, JSON.stringify(data.weeklyPlan));
    if (data.inventory) localStorage.setItem(INVENTORY_KEY, JSON.stringify(data.inventory));
    if (data.inventoryLocations) localStorage.setItem(INVENTORY_LOCATIONS_KEY, JSON.stringify(data.inventoryLocations));
    if (data.manualShopping) localStorage.setItem(SHOPPING_MANUAL_KEY, JSON.stringify(data.manualShopping));
    if (data.shoppingChecked) localStorage.setItem(SHOPPING_LIST_KEY, JSON.stringify(data.shoppingChecked));

    isServerReachable = true;
    return data;
  } catch (err) {
    console.warn('[Storage] Sync with server container failed, using local offline copy:', err);
    isServerReachable = false;
    return null;
  }
};

// -------------------------------------------------------------------
// RECIPES
// -------------------------------------------------------------------

export const getRecipes = (): Recipe[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error('Failed to load recipes from local cache', e);
    return [];
  }
};

export const saveRecipe = (recipe: Recipe): void => {
  const activeUser = getActiveUser();
  if (activeUser && !recipe.authorName) {
    recipe.authorId = activeUser.id;
    recipe.authorName = activeUser.name;
  }

  // 1. Update local cache
  const recipes = getRecipes();
  const index = recipes.findIndex(r => r.id === recipe.id);
  if (index >= 0) {
    recipes[index] = recipe;
  } else {
    recipes.unshift(recipe);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes));

  // 2. Persist to server storage container
  fetch('/api/recipes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(recipe)
  }).catch(e => console.warn('[Storage] Offline, server save queued:', e));
};

export const saveAllRecipes = (recipes: Recipe[]): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes));

  // Push to server
  fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipes })
  }).catch(e => console.warn('[Storage] Offline, batch save queued:', e));
};

export const deleteRecipe = (id: string): void => {
  const recipes = getRecipes();
  const filtered = recipes.filter(r => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));

  // Persist to server
  fetch(`/api/recipes/${id}`, { method: 'DELETE' })
    .catch(e => console.warn('[Storage] Offline, server delete queued:', e));
};

export const toggleFavorite = (id: string): Recipe | undefined => {
  const recipes = getRecipes();
  const recipe = recipes.find(r => r.id === id);
  if (recipe) {
    recipe.isFavorite = !recipe.isFavorite;
    saveRecipe(recipe);
    return recipe;
  }
  return undefined;
};

// -------------------------------------------------------------------
// WEEKLY PLANNER
// -------------------------------------------------------------------

export const getWeeklyPlan = (): WeeklyPlan => {
  try {
    const stored = localStorage.getItem(PLAN_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (e) {
    return {};
  }
};

export const saveWeeklyPlan = (plan: WeeklyPlan): void => {
  localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
  fetch('/api/plan', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(plan)
  }).catch(e => console.warn('[Storage] Offline, plan save queued:', e));
};

// -------------------------------------------------------------------
// INVENTORY
// -------------------------------------------------------------------

export const getInventory = (): string[] => {
  try {
    const stored = localStorage.getItem(INVENTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
};

export const saveInventory = (items: string[]): void => {
  localStorage.setItem(INVENTORY_KEY, JSON.stringify(items));
  const locs = getInventoryLocations();
  fetch('/api/inventory', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inventory: items, locations: locs })
  }).catch(e => console.warn('[Storage] Offline, inventory save queued:', e));
};

export const getInventoryLocations = (): Record<string, StorageLocation> => {
  try {
    const stored = localStorage.getItem(INVENTORY_LOCATIONS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (e) {
    return {};
  }
};

export const saveInventoryLocations = (locations: Record<string, StorageLocation>): void => {
  localStorage.setItem(INVENTORY_LOCATIONS_KEY, JSON.stringify(locations));
  const inventory = getInventory();
  fetch('/api/inventory', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inventory, locations })
  }).catch(e => console.warn('[Storage] Offline, locations save queued:', e));
};

// -------------------------------------------------------------------
// SHOPPING LIST
// -------------------------------------------------------------------

export const getShoppingListState = (): string[] => {
  try {
    const stored = localStorage.getItem(SHOPPING_LIST_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
};

export const saveShoppingListState = (checkedItems: string[]): void => {
  localStorage.setItem(SHOPPING_LIST_KEY, JSON.stringify(checkedItems));
  const manual = getManualShoppingItems();
  fetch('/api/shopping', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ manual, checked: checkedItems })
  }).catch(e => console.warn('[Storage] Offline, shopping save queued:', e));
};

export const getManualShoppingItems = (): string[] => {
  try {
    const stored = localStorage.getItem(SHOPPING_MANUAL_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
};

export const saveManualShoppingItems = (items: string[]): void => {
  localStorage.setItem(SHOPPING_MANUAL_KEY, JSON.stringify(items));
  const checked = getShoppingListState();
  fetch('/api/shopping', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ manual: items, checked })
  }).catch(e => console.warn('[Storage] Offline, manual shopping save queued:', e));
};

// -------------------------------------------------------------------
// SEED INITIAL DATA (OFFLINE FALLBACK)
// -------------------------------------------------------------------

export const seedInitialData = () => {
  if (getRecipes().length === 0) {
    const demoRecipe: Recipe = {
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
        'While pasta cooks, combine olive oil and garlic in a cold skillet. Turn heat to medium-low and slowly toast garlic until golden.',
        'Add red pepper flakes to the oil and remove from heat.',
        'Drain pasta, reserving 1/2 cup of pasta water.',
        'Toss pasta with the oil sauce and parsley, adding pasta water if needed to create an emulsion.',
        'Serve immediately with grated parmesan if desired.'
      ],
      rating: 5,
      isFavorite: true,
      createdAt: new Date().toISOString(),
      authorName: 'Head Chef'
    };
    saveRecipe(demoRecipe);
  }
};

// -------------------------------------------------------------------
// SERVER STORAGE CONTAINER STATS & ADMIN MANAGEMENT
// -------------------------------------------------------------------

export const getStorageStats = async (): Promise<StorageStats | null> => {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
};

export const getServerBackups = async (): Promise<ServerBackupFile[]> => {
  try {
    const res = await fetch('/api/storage/backups');
    if (!res.ok) return [];
    const data = await res.json();
    return data.backups || [];
  } catch (err) {
    return [];
  }
};

export const createServerSnapshot = async (): Promise<string | null> => {
  try {
    const res = await fetch('/api/storage/backup/create', { method: 'POST' });
    if (!res.ok) return null;
    const data = await res.json();
    return data.filename;
  } catch (err) {
    return null;
  }
};

export const restoreServerSnapshot = async (filename: string): Promise<boolean> => {
  try {
    const res = await fetch(`/api/storage/backup/restore/${encodeURIComponent(filename)}`, { method: 'POST' });
    return res.ok;
  } catch (err) {
    return false;
  }
};

export const uploadRecipeImage = async (imageBase64: string, originalName?: string): Promise<string | null> => {
  try {
    const res = await fetch('/api/storage/upload-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, originalName })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.url;
  } catch (err) {
    return null;
  }
};

// -------------------------------------------------------------------
// 2-USER MANAGEMENT
// -------------------------------------------------------------------

export const fetchUsers = async (): Promise<UserProfile[]> => {
  try {
    const res = await fetch('/api/auth/users');
    if (!res.ok) throw new Error('Failed to fetch users');
    const data = await res.json();
    return data.users;
  } catch (err) {
    // Offline fallback for 2 default users
    return [
      { id: 'user-1', username: 'chef1', name: 'Head Chef', role: 'admin', avatarColor: '#ea580c' },
      { id: 'user-2', username: 'chef2', name: 'Sous Chef', role: 'user', avatarColor: '#0284c7' }
    ];
  }
};

export const updateUserProfile = async (
  userId: string,
  updates: { name?: string; username?: string; newPassword?: string; avatarColor?: string }
): Promise<UserProfile | null> => {
  try {
    const res = await fetch(`/api/auth/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.user;
  } catch (err) {
    return null;
  }
};
