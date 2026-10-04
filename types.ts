
export interface Ingredient {
  item: string;
  amount: number;
  unit: string;
  originalString: string;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  sourceUrl?: string;
  imageUrl?: string;
  prepTime: number; // minutes
  cookTime: number; // minutes
  servings: number;
  calories?: number;
  tags: string[];
  ingredients: Ingredient[];
  instructions: string[];
  rating: number; // 0-5
  lastCooked?: string;
  isFavorite: boolean;
  createdAt: string;
  authorId?: string;
  authorName?: string;
}

export type NewRecipeInput = Omit<Recipe, 'id' | 'createdAt' | 'lastCooked' | 'rating' | 'isFavorite'>;

export enum ViewMode {
  LIST = 'LIST',
  DETAIL = 'DETAIL',
  IMPORT = 'IMPORT',
  PLANNER = 'PLANNER',
  SHOPPING_LIST = 'SHOPPING_LIST',
  INVENTORY = 'INVENTORY',
  ADMIN = 'ADMIN'
}

export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
export type MealType = 'Breakfast' | 'Lunch' | 'Dinner';

export const DAYS_OF_WEEK: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const MEAL_TYPES: MealType[] = ['Breakfast', 'Lunch', 'Dinner'];

export const DINING_OUT_ID = 'DINING_OUT';

export interface WeeklyPlan {
  [day: string]: { // DayOfWeek
    [meal: string]: string; // MealType -> recipeId
  }
}

export type StorageLocation = 'FRIDGE' | 'PANTRY' | 'SPICE';

export const COMMON_SEASONINGS = [
  'Salt', 'Pepper', 'Black Pepper', 'Sea Salt', 'Kosher Salt',
  'Olive Oil', 'Vegetable Oil', 'Canola Oil', 'Coconut Oil', 'Butter',
  'Water', 'Sugar', 'Brown Sugar', 'Flour', 'All-Purpose Flour', 
  'Cooking Spray', 'Vinegar', 'Balsamic Vinegar', 'Soy Sauce', 
  'Garlic Powder', 'Onion Powder', 'Paprika', 'Cumin', 'Dried Oregano', 'Dried Basil'
];

export const MASTER_INGREDIENT_LIST = [
  // Dairy & Eggs
  "Butter", "Eggs", "Milk", "Heavy Cream", "Sour Cream", "Yogurt", "Greek Yogurt", "Cheddar Cheese", "Mozzarella", "Parmesan", "Cream Cheese", "Feta Cheese", "Cottage Cheese", "Almond Milk", "Oat Milk",
  
  // Meat & Seafood
  "Chicken Breast", "Chicken Thighs", "Ground Beef", "Steak", "Roast Beef", "Pork Chops", "Pork Tenderloin", "Bacon", "Sausage", "Turkey", "Ham", "Salmon", "Shrimp", "Tuna", "Cod", "Tilapia", "Crab",
  
  // Produce
  "Onion", "Red Onion", "Garlic", "Potato", "Sweet Potato", "Carrot", "Celery", "Bell Pepper", "Jalapeño", "Broccoli", "Cauliflower", "Spinach", "Kale", "Lettuce", "Arugula", "Cabbage",
  "Tomato", "Cherry Tomatoes", "Cucumber", "Zucchini", "Squash", "Mushroom", "Avocado", "Corn", "Green Beans", "Asparagus", "Peas",
  "Lemon", "Lime", "Apple", "Banana", "Orange", "Strawberry", "Blueberry", "Raspberry", "Grape", "Pineapple", "Mango", "Peach",
  "Ginger", "Cilantro", "Parsley", "Basil", "Mint", "Dill", "Rosemary", "Thyme", "Chives", "Scallions",
  
  // Pantry - Grains & Pasta
  "Rice", "Brown Rice", "Jasmine Rice", "Basmati Rice", "Quinoa", "Couscous", "Oats", "Pasta", "Spaghetti", "Penne", "Macaroni", "Noodles", "Bread", "Sourdough Bread", "Tortillas", "Breadcrumbs", "Panko",
  
  // Pantry - Baking & Condiments
  "All-Purpose Flour", "Sugar", "Brown Sugar", "Powdered Sugar", "Baking Powder", "Baking Soda", "Vanilla Extract", "Cocoa Powder", "Chocolate Chips",
  "Olive Oil", "Vegetable Oil", "Coconut Oil", "Sesame Oil", "Vinegar", "Apple Cider Vinegar", "Balsamic Vinegar", "Red Wine Vinegar", "Rice Vinegar",
  "Soy Sauce", "Worcestershire Sauce", "Hot Sauce", "Sriracha", "Mayonnaise", "Mustard", "Dijon Mustard", "Ketchup", "BBQ Sauce", "Honey", "Maple Syrup", "Peanut Butter",
  "Tomato Sauce", "Tomato Paste", "Crushed Tomatoes", "Diced Tomatoes", "Marinara Sauce", "Salsa",
  
  // Canned Goods
  "Black Beans", "Kidney Beans", "Chickpeas", "Cannellini Beans", "Lentils", "Corn", "Tuna", "Coconut Milk", "Chicken Broth", "Beef Broth", "Vegetable Broth",
  
  // Spices (Expanded)
  "Salt", "Black Pepper", "Kosher Salt", "Sea Salt", "Paprika", "Smoked Paprika", "Cumin", "Chili Powder", "Garlic Powder", "Onion Powder", "Cinnamon", "Nutmeg", "Ginger Powder", "Cayenne Pepper", "Red Pepper Flakes", "Turmeric", "Curry Powder", "Italian Seasoning", "Taco Seasoning"
];

// Helper for Categorization
export const INGREDIENT_CATEGORIES: Record<string, string[]> = {
  'Produce': ['apple', 'banana', 'fruit', 'vegetable', 'spinach', 'lettuce', 'kale', 'onion', 'garlic', 'ginger', 'potato', 'tomato', 'pepper', 'carrot', 'celery', 'herb', 'basil', 'cilantro', 'parsley', 'mushroom', 'lemon', 'lime', 'avocado', 'squash', 'cucumber', 'berry', 'grape', 'orange', 'salad', 'zucchini', 'corn', 'broccoli', 'cauliflower', 'asparagus', 'scallion', 'chive', 'dill', 'mint', 'thyme', 'rosemary'],
  'Meat & Seafood': ['chicken', 'beef', 'pork', 'steak', 'meat', 'turkey', 'fish', 'salmon', 'shrimp', 'bacon', 'sausage', 'ham', 'lamb', 'tuna', 'cod', 'crab', 'lobster', 'fillet', 'prosciutto', 'salami', 'pepperoni'],
  'Dairy & Eggs': ['milk', 'cheese', 'butter', 'yogurt', 'cream', 'egg', 'margarine', 'cheddar', 'mozzarella', 'parmesan', 'feta', 'ricotta', 'brie', 'curd', 'whey', 'ghee'],
  'Bakery': ['bread', 'bun', 'tortilla', 'bagel', 'pita', 'roll', 'baguette', 'sourdough', 'loaf', 'toast', 'crust', 'flatbread'],
  'Frozen': ['frozen', 'ice cream', 'sorbet', 'ice'],
  'Pantry & Canned': ['flour', 'sugar', 'salt', 'pepper', 'oil', 'vinegar', 'sauce', 'pasta', 'rice', 'cereal', 'oat', 'nut', 'seed', 'spice', 'can', 'bean', 'soup', 'broth', 'stock', 'chocolate', 'cocoa', 'baking', 'vanilla', 'honey', 'syrup', 'jam', 'jelly', 'mayo', 'mustard', 'ketchup', 'soy', 'noodle', 'lentil', 'chickpea', 'yeast', 'powder', 'soda', 'cornstarch', 'crumb', 'wine', 'beer']
};

export const getIngredientCategory = (item: string) => {
  const lower = item.toLowerCase();
  for (const [category, keywords] of Object.entries(INGREDIENT_CATEGORIES)) {
    if (keywords.some(k => lower.includes(k))) return category;
  }
  return 'Other';
};

export interface BackupData {
  version: number;
  timestamp: string;
  recipes: Recipe[];
  inventory: string[];
  weeklyPlan: WeeklyPlan;
  inventoryLocations: Record<string, StorageLocation>;
  manualShopping?: string[];
  shoppingChecked?: string[];
  users?: UserProfile[];
}

export type UserRole = 'admin' | 'user';

export interface UserProfile {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  avatarColor: string;
  lastLogin?: string;
  recipeCount?: number;
}

export interface StorageStats {
  containerDataDir: string;
  dbFilePath: string;
  dbSizeBytes: number;
  recipeCount: number;
  inventoryCount: number;
  backupCount: number;
  lastSaved: string;
  uptimeSeconds: number;
  nodeEnv: string;
  storageMode: 'SERVER_CONTAINER' | 'LOCAL_FALLBACK';
  tailscaleInfo: {
    isConfigured: boolean;
    tailscaleIp?: string;
    hostname?: string;
    magicDnsUrl?: string;
  };
}

export interface ServerBackupFile {
  filename: string;
  sizeBytes: number;
  timestamp: string;
}