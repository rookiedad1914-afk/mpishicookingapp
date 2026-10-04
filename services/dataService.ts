
import { Recipe, WeeklyPlan, BackupData, StorageLocation } from '../types';
import { v4 as uuidv4 } from 'uuid';

// Helper: Download a Blob as a file
const downloadFile = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// 1. JSON FULL BACKUP
export const exportBackup = (
  recipes: Recipe[], 
  inventory: string[], 
  weeklyPlan: WeeklyPlan,
  inventoryLocations: Record<string, StorageLocation>
) => {
  const data: BackupData = {
    version: 1,
    timestamp: new Date().toISOString(),
    recipes,
    inventory,
    weeklyPlan,
    inventoryLocations
  };
  
  const filename = `mpishi_backup_${new Date().toISOString().split('T')[0]}.json`;
  downloadFile(JSON.stringify(data, null, 2), filename, 'application/json');
};

// 2. CSV EXPORTS
export const exportRecipesToCSV = (recipes: Recipe[]) => {
  const headers = [
    'ID', 'Title', 'Description', 'Prep Time (m)', 'Cook Time (m)', 'Servings', 
    'Tags', 'Ingredients', 'Instructions', 'Source URL', 'Calories'
  ];

  const rows = recipes.map(r => [
    r.id,
    `"${r.title.replace(/"/g, '""')}"`,
    `"${r.description.replace(/"/g, '""')}"`,
    r.prepTime,
    r.cookTime,
    r.servings,
    `"${r.tags.join(', ')}"`,
    // Format ingredients as "amount unit item"
    `"${r.ingredients.map(i => `${i.amount} ${i.unit} ${i.item}`).join('; ').replace(/"/g, '""')}"`,
    `"${r.instructions.join(' | ').replace(/"/g, '""')}"`,
    r.sourceUrl || '',
    r.calories || ''
  ]);

  const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  const filename = `mpishi_recipes_${new Date().toISOString().split('T')[0]}.csv`;
  downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
};

export const exportInventoryToCSV = (inventory: string[]) => {
  const headers = ['Item'];
  const rows = inventory.map(item => [`"${item.replace(/"/g, '""')}"`]);
  const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  const filename = `mpishi_inventory_${new Date().toISOString().split('T')[0]}.csv`;
  downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
};

// 3. IMPORTS & PARSING

// Robust CSV Parser that handles newlines inside quotes
const parseCSVFull = (text: string): string[][] => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;
  
  // Normalize line endings
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    const nextChar = normalized[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = '';
    } else if (char === '\n' && !inQuotes) {
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }
  
  // Push last cell/row if exists
  if (currentCell || currentRow.length > 0) {
      currentRow.push(currentCell);
      rows.push(currentRow);
  }

  return rows;
};

export const readRawCsv = async (file: File): Promise<{ headers: string[], rows: string[][] }> => {
  const text = await file.text();
  const allRows = parseCSVFull(text).filter(r => r.length > 0 && r.some(c => c.trim().length > 0));
  
  if (allRows.length < 2) return { headers: [], rows: [] };

  const headers = allRows[0];
  const rows = allRows.slice(1);
  
  // Normalize row length to header length
  const normalizedRows = rows.map(r => {
      // If row is shorter, pad. If longer, slice? usually padding is safer.
      while (r.length < headers.length) r.push("");
      return r;
  });

  return { headers, rows: normalizedRows };
};

// Defines which Recipe field maps to which CSV column index
export interface CsvMapping {
  title: number;
  ingredients: number;
  instructions: number;
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  tags?: number;
  imageUrl?: number;
  calories?: number;
  sourceUrl?: number;
}

const safeParseAmount = (str: string): number => {
    // Handles "1/2", "1 1/2", "1.5", "1-1/2"
    if (!str) return 0;
    
    // Replace 1-1/2 with 1 1/2 for easier parsing
    const clean = str.replace('-', ' ').trim();
    
    if (clean.includes('/')) {
        const parts = clean.split(' ');
        let total = 0;
        for (const part of parts) {
            if (part.includes('/')) {
                const [num, den] = part.split('/').map(Number);
                if (den !== 0) total += num / den;
            } else {
                total += Number(part) || 0;
            }
        }
        return total || 0;
    }
    
    return parseFloat(clean) || 0;
};

// The requested default image (Unsplash: xoWNIXzULMs)
const DEFAULT_IMAGE_URL = "https://images.unsplash.com/photo-1605522283494-4905a81284d7?q=80&w=1080&auto=format&fit=crop";

export const convertMappedCsvToRecipes = (
  headers: string[],
  rows: string[][],
  mapping: CsvMapping
): Recipe[] => {
  return rows.map(row => {
    // Helper to safely get value
    const val = (idx?: number) => idx !== undefined && idx >= 0 ? row[idx]?.trim() : "";
    
    // Ingredients Parsing
    const rawIngs = val(mapping.ingredients);
    const ingredientsList = rawIngs
        .split(/[\n;|]+/) // Split by newline, semicolon, pipe
        .map(s => s.trim())
        .filter(s => s)
        .map(s => {
           // Heuristic parser: "2 cups flour" or "1 1/2 lbs beef"
           const match = s.match(/^([\d\s./-]+)\s+([a-zA-Z]+)\s+(.+)/);
           if (match) {
             return {
               amount: safeParseAmount(match[1]),
               unit: match[2],
               item: match[3],
               originalString: s
             };
           }
           
           // Simple number start check: "2 eggs"
           const simpleMatch = s.match(/^([\d\s./-]+)\s+(.+)/);
           if (simpleMatch) {
                return {
                    amount: safeParseAmount(simpleMatch[1]),
                    unit: 'unit',
                    item: simpleMatch[2],
                    originalString: s
                };
           }

           // Fallback
           return {
             amount: 1,
             unit: 'unit',
             item: s,
             originalString: s
           };
        });

    // Instructions Parsing
    const rawInstr = val(mapping.instructions);
    let instructionsList = rawInstr
        .split(/[\n|]+/) // split by newlines or pipes
        .map(s => s.trim())
        .filter(s => s.length > 0);
        
    // If splitting failed to produce multiple steps, try splitting by period logic
    if (instructionsList.length === 1 && instructionsList[0].length > 100) {
        // Look for periods followed by spaces and capital letters or numbers
        const sentences = instructionsList[0].match(/[^\.!\?]+[\.!\?]+/g);
        if (sentences && sentences.length > 1) {
            instructionsList = sentences.map(s => s.trim());
        }
    }

    // Tags
    const tagsRaw = val(mapping.tags);
    const tags = tagsRaw ? tagsRaw.split(/[,;]+/).map(t => t.trim()).filter(t => t) : [];

    return {
      id: uuidv4(),
      title: val(mapping.title) || "Untitled Imported Recipe",
      description: "Imported from CSV",
      prepTime: parseInt(val(mapping.prepTime)) || 0,
      cookTime: parseInt(val(mapping.cookTime)) || 0,
      servings: parseInt(val(mapping.servings)) || 4,
      calories: parseInt(val(mapping.calories)) || 0,
      tags: tags,
      ingredients: ingredientsList,
      instructions: instructionsList,
      sourceUrl: val(mapping.sourceUrl),
      imageUrl: val(mapping.imageUrl) || DEFAULT_IMAGE_URL,
      rating: 0,
      isFavorite: false,
      createdAt: new Date().toISOString()
    };
  });
};

export const parseImportFile = async (file: File): Promise<{ type: 'RECIPES' | 'INVENTORY' | 'BACKUP', data: any }> => {
  const text = await file.text();

  // Try JSON first
  try {
    const json = JSON.parse(text);
    if (json.recipes && Array.isArray(json.recipes)) {
      return { type: 'BACKUP', data: json };
    }
  } catch (e) {
    // Not JSON, continue to CSV check
  }

  // Parse CSV
  const allRows = parseCSVFull(text).filter(r => r.length > 0 && r.some(c => c.trim().length > 0));
  if (allRows.length < 2) throw new Error("File is empty or invalid");

  const headers = allRows[0].map(h => h.toLowerCase().trim());

  // Detect Type
  if (headers.includes('title') && headers.includes('ingredients')) {
    // Recipe CSV (Simple Auto-Import logic)
    const mapping: CsvMapping = {
        title: headers.indexOf('title'),
        ingredients: headers.indexOf('ingredients'),
        instructions: headers.indexOf('instructions'),
        prepTime: headers.indexOf('prep time'),
        cookTime: headers.indexOf('cook time'),
        servings: headers.indexOf('servings'),
        tags: headers.indexOf('tags'),
        sourceUrl: headers.indexOf('source url'),
        imageUrl: headers.indexOf('image url'),
        calories: headers.indexOf('calories')
    };

    // If critical fields miss, try fuzzy match
    if (mapping.instructions === -1) mapping.instructions = headers.findIndex(h => h.includes('instruction') || h.includes('method'));
    
    if (mapping.title === -1 || mapping.ingredients === -1) {
        throw new Error("CSV missing 'Title' or 'Ingredients' column");
    }

    const recipes = convertMappedCsvToRecipes(allRows[0], allRows.slice(1), mapping);
    return { type: 'RECIPES', data: recipes };
  } 
  else if (headers.includes('item')) {
    // Inventory CSV
    const inventory = allRows.slice(1).map(row => row[0]).filter(i => i);
    return { type: 'INVENTORY', data: inventory };
  }

  throw new Error("Could not detect file format. Use the Import Wizard for custom CSVs.");
};
