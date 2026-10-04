
import React, { useRef, useState } from 'react';
import { X, Settings, Download, Upload, Database, FileJson, FileSpreadsheet, RefreshCw, ArrowRight, CheckCircle, ArrowLeft, Eye, Trash2, AlertTriangle, List } from 'lucide-react';
import * as dataService from '../services/dataService';
import { Recipe, WeeklyPlan } from '../types';
import { getInventoryLocations } from '../services/storageService';

interface SettingsModalProps {
  onClose: () => void;
  recipes: Recipe[];
  inventory: string[];
  weeklyPlan: WeeklyPlan;
  onImportData: (type: 'RECIPES' | 'INVENTORY' | 'BACKUP', data: any) => void;
  onReset?: () => void; // New prop for clearing data
}

type ViewState = 'MENU' | 'CSV_WIZARD';
type WizardStep = 'UPLOAD' | 'MAP' | 'PREVIEW' | 'CONFIRM';

const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, recipes, inventory, weeklyPlan, onImportData, onReset }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [view, setView] = useState<ViewState>('MENU');
  
  // Wizard State
  const [wizardStep, setWizardStep] = useState<WizardStep>('UPLOAD');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [previewRecipes, setPreviewRecipes] = useState<Recipe[]>([]);
  
  // Danger Zone State
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Mapping State (CSV Header Index)
  const [mapping, setMapping] = useState<Record<string, number>>({
      title: -1,
      ingredients: -1,
      instructions: -1,
      prepTime: -1,
      cookTime: -1,
      servings: -1,
      tags: -1,
      imageUrl: -1,
      sourceUrl: -1
  });

  const handleExportJSON = () => {
    const locs = getInventoryLocations();
    dataService.exportBackup(recipes, inventory, weeklyPlan, locs);
  };

  const handleExportRecipesCSV = () => dataService.exportRecipesToCSV(recipes);
  const handleExportInventoryCSV = () => dataService.exportInventoryToCSV(inventory);

  const handleQuickImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImportStatus("Parsing...");
      const result = await dataService.parseImportFile(file);
      onImportData(result.type, result.data);
      setImportStatus(`Success! Loaded ${result.type.toLowerCase()}.`);
      setTimeout(() => setImportStatus(null), 3000);
    } catch (err: any) {
      console.error(err);
      setImportStatus(`Error: ${err.message}`);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const startWizard = () => {
      setView('CSV_WIZARD');
      setWizardStep('UPLOAD');
      setCsvFile(null);
      setMapping({
        title: -1,
        ingredients: -1,
        instructions: -1,
        prepTime: -1,
        cookTime: -1,
        servings: -1,
        tags: -1,
        imageUrl: -1,
        sourceUrl: -1
      });
  };

  const handleWizardFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
          const { headers, rows } = await dataService.readRawCsv(file);
          if (headers.length === 0) throw new Error("Empty CSV");
          
          setCsvHeaders(headers);
          setCsvRows(rows);
          setCsvFile(file);
          
          // Try Auto-Map
          const newMapping = { ...mapping };
          headers.forEach((h, idx) => {
              const lower = h.toLowerCase();
              if (lower.includes('title') || lower.includes('name')) newMapping.title = idx;
              if (lower.includes('ingredient')) newMapping.ingredients = idx;
              if (lower.includes('instruction') || lower.includes('direction') || lower.includes('method')) newMapping.instructions = idx;
              if (lower.includes('prep')) newMapping.prepTime = idx;
              if (lower.includes('cook')) newMapping.cookTime = idx;
              if (lower.includes('serving') || lower.includes('yield')) newMapping.servings = idx;
              if (lower.includes('tag') || lower.includes('category')) newMapping.tags = idx;
              if (lower.includes('image') || lower.includes('photo')) newMapping.imageUrl = idx;
              if (lower.includes('source') || lower.includes('url') || lower.includes('link')) newMapping.sourceUrl = idx;
          });
          setMapping(newMapping);
          setWizardStep('MAP');
      } catch (err) {
          alert("Failed to read CSV. Please check the file format.");
      }
  };

  const handleGeneratePreview = () => {
      const finalMapping: dataService.CsvMapping = {
          title: mapping.title,
          ingredients: mapping.ingredients,
          instructions: mapping.instructions,
          prepTime: mapping.prepTime,
          cookTime: mapping.cookTime,
          servings: mapping.servings,
          tags: mapping.tags,
          imageUrl: mapping.imageUrl,
          sourceUrl: mapping.sourceUrl
      };
      // Preview first 5 rows
      const sample = csvRows.slice(0, 5);
      const generated = dataService.convertMappedCsvToRecipes(csvHeaders, sample, finalMapping);
      setPreviewRecipes(generated);
      setWizardStep('PREVIEW');
  };

  const finishWizard = () => {
      const finalMapping: dataService.CsvMapping = {
          title: mapping.title,
          ingredients: mapping.ingredients,
          instructions: mapping.instructions,
          prepTime: mapping.prepTime,
          cookTime: mapping.cookTime,
          servings: mapping.servings,
          tags: mapping.tags,
          imageUrl: mapping.imageUrl,
          sourceUrl: mapping.sourceUrl
      };
      
      const recipes = dataService.convertMappedCsvToRecipes(csvHeaders, csvRows, finalMapping);
      onImportData('RECIPES', recipes);
      setView('MENU');
      setImportStatus(`Successfully imported ${recipes.length} recipes via Wizard!`);
  };

  const renderMenu = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-2">
        {/* Export Section */}
        <div>
            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Download className="w-4 h-4" /> Export Data
            </h4>
            <div className="grid gap-3">
            <button onClick={handleExportJSON} className="flex items-center justify-between p-3 bg-white border border-gray-200 hover:border-chef-300 rounded-lg group transition-all">
                <div className="flex items-center gap-3">
                <div className="bg-indigo-50 p-2 rounded-md text-indigo-600"><FileJson className="w-5 h-5" /></div>
                <div className="text-left">
                    <div className="font-bold text-gray-800">Full System Backup</div>
                    <div className="text-xs text-gray-500">JSON • Includes Everything</div>
                </div>
                </div>
                <Download className="w-4 h-4 text-gray-300 group-hover:text-chef-600" />
            </button>

            <button onClick={handleExportRecipesCSV} className="flex items-center justify-between p-3 bg-white border border-gray-200 hover:border-chef-300 rounded-lg group transition-all">
                <div className="flex items-center gap-3">
                <div className="bg-green-50 p-2 rounded-md text-green-600"><FileSpreadsheet className="w-5 h-5" /></div>
                <div className="text-left">
                    <div className="font-bold text-gray-800">Export Recipes</div>
                    <div className="text-xs text-gray-500">CSV • Excel Compatible</div>
                </div>
                </div>
                <Download className="w-4 h-4 text-gray-300 group-hover:text-chef-600" />
            </button>
            
            <button onClick={handleExportInventoryCSV} className="flex items-center justify-between p-3 bg-white border border-gray-200 hover:border-chef-300 rounded-lg group transition-all">
                <div className="flex items-center gap-3">
                <div className="bg-amber-50 p-2 rounded-md text-amber-600"><FileSpreadsheet className="w-5 h-5" /></div>
                <div className="text-left">
                    <div className="font-bold text-gray-800">Export Inventory</div>
                    <div className="text-xs text-gray-500">CSV • Excel Compatible</div>
                </div>
                </div>
                <Download className="w-4 h-4 text-gray-300 group-hover:text-chef-600" />
            </button>
            </div>
        </div>

        {/* Import Section */}
        <div className="border-t border-gray-100 pt-6">
            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Upload className="w-4 h-4" /> Import Data
            </h4>
            
            <div className="grid gap-3">
                {/* Wizard Button */}
                <button onClick={startWizard} className="flex items-center justify-between p-4 bg-chef-50 border border-chef-200 hover:bg-chef-100 hover:border-chef-300 rounded-xl group transition-all shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="bg-white p-2 rounded-full text-chef-600 shadow-sm"><RefreshCw className="w-6 h-6" /></div>
                        <div className="text-left">
                            <div className="font-bold text-chef-800">Bulk CSV Import Wizard</div>
                            <div className="text-xs text-chef-600">Import any CSV recipe collection and map columns</div>
                        </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-chef-400 group-hover:text-chef-600" />
                </button>

                {/* Quick Upload */}
                <div className="relative flex items-center justify-between p-3 bg-white border border-dashed border-gray-300 hover:border-gray-400 rounded-lg group transition-all cursor-pointer">
                    <input 
                        ref={fileInputRef}
                        type="file" 
                        accept=".json,.csv" 
                        onChange={handleQuickImport}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="flex items-center gap-3">
                        <div className="bg-gray-100 p-2 rounded-md text-gray-500"><Database className="w-5 h-5" /></div>
                        <div className="text-left">
                            <div className="font-bold text-gray-700">Restore Backup / Quick Import</div>
                            <div className="text-xs text-gray-400">mpishi_backup.json or standardized csv</div>
                        </div>
                    </div>
                </div>
            </div>

            {importStatus && (
                <div className={`mt-4 text-sm font-bold p-3 rounded-lg border text-center ${importStatus.includes('Error') ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
                    {importStatus}
                </div>
            )}
        </div>

        {/* Danger Zone */}
        {onReset && (
             <div className="border-t border-red-100 pt-6 mt-6">
                 <h4 className="text-sm font-bold text-red-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                     <AlertTriangle className="w-4 h-4" /> Danger Zone
                 </h4>
                 
                 {!showClearConfirm ? (
                     <button 
                       onClick={() => setShowClearConfirm(true)}
                       className="w-full p-3 bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2"
                     >
                        <Trash2 className="w-4 h-4" /> Clear All Local Data
                     </button>
                 ) : (
                     <div className="bg-red-50 border border-red-200 rounded-lg p-4 animate-in fade-in slide-in-from-top-1">
                         <p className="text-red-800 font-bold text-sm mb-2 text-center">Are you sure? This will delete all recipes.</p>
                         <div className="flex gap-2">
                             <button 
                               onClick={() => setShowClearConfirm(false)}
                               className="flex-1 py-2 bg-white text-gray-600 border border-gray-200 rounded-md text-sm font-medium hover:bg-gray-50"
                             >
                                Cancel
                             </button>
                             <button 
                               onClick={() => { onReset(); onClose(); }}
                               className="flex-1 py-2 bg-red-600 text-white rounded-md text-sm font-bold hover:bg-red-700 shadow-sm"
                             >
                                Yes, Clear Everything
                             </button>
                         </div>
                     </div>
                 )}
             </div>
        )}
    </div>
  );

  const renderWizard = () => (
      <div className="flex flex-col h-full animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center gap-2 mb-4">
              <button 
                onClick={() => {
                  if (wizardStep === 'PREVIEW') setWizardStep('MAP');
                  else if (wizardStep === 'MAP') setWizardStep('UPLOAD');
                  else setView('MENU');
                }} 
                className="text-gray-400 hover:text-gray-600"
              >
                  <ArrowLeft className="w-5 h-5" />
              </button>
              <h4 className="font-bold text-gray-800">
                  {wizardStep === 'UPLOAD' && 'Step 1: Upload CSV'}
                  {wizardStep === 'MAP' && 'Step 2: Map Columns'}
                  {wizardStep === 'PREVIEW' && 'Step 3: Preview Data'}
              </h4>
          </div>

          <div className="flex-1 overflow-y-auto">
              {wizardStep === 'UPLOAD' && (
                  <div className="h-64 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors relative">
                      <input 
                        type="file" 
                        accept=".csv"
                        onChange={handleWizardFileUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <FileSpreadsheet className="w-12 h-12 text-gray-400 mb-3" />
                      <p className="font-bold text-gray-600">Click to Select CSV File</p>
                      <p className="text-xs text-gray-400">or drag and drop here</p>
                  </div>
              )}

              {wizardStep === 'MAP' && (
                  <div className="space-y-4">
                      <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-700 mb-4">
                          <p>We found <strong>{csvRows.length}</strong> rows. Please match your CSV columns to Mpishi's fields.</p>
                      </div>

                      {/* Required Fields */}
                      <div className="space-y-3">
                          <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Required Fields</h5>
                          {[
                              { key: 'title', label: 'Recipe Title' },
                              { key: 'ingredients', label: 'Ingredients List' },
                              { key: 'instructions', label: 'Instructions / Method' }
                          ].map(field => (
                              <div key={field.key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-white border border-gray-200 rounded-lg">
                                  <label className="font-bold text-gray-700 w-1/3 flex items-center gap-1">
                                      {field.label} <span className="text-red-500">*</span>
                                  </label>
                                  <select 
                                      className={`flex-1 p-2 rounded-lg border ${mapping[field.key] === -1 ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'}`}
                                      value={mapping[field.key]}
                                      onChange={(e) => setMapping({...mapping, [field.key]: parseInt(e.target.value)})}
                                  >
                                      <option value={-1}>-- Select Column --</option>
                                      {csvHeaders.map((h, i) => (
                                          <option key={i} value={i}>{h}</option>
                                      ))}
                                  </select>
                              </div>
                          ))}
                      </div>

                      {/* Optional Fields */}
                      <div className="space-y-3 mt-6">
                          <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Optional Fields</h5>
                          {[
                              { key: 'prepTime', label: 'Prep Time (min)' },
                              { key: 'cookTime', label: 'Cook Time (min)' },
                              { key: 'servings', label: 'Servings / Yield' },
                              { key: 'imageUrl', label: 'Image URL' },
                              { key: 'sourceUrl', label: 'Source / Link' },
                              { key: 'tags', label: 'Tags / Categories' }
                          ].map(field => (
                              <div key={field.key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-gray-50 border border-gray-100 rounded-lg">
                                  <label className="font-medium text-gray-600 w-1/3">
                                      {field.label}
                                  </label>
                                  <select 
                                      className="flex-1 p-2 rounded-lg border border-gray-200 bg-white text-sm"
                                      value={mapping[field.key]}
                                      onChange={(e) => setMapping({...mapping, [field.key]: parseInt(e.target.value)})}
                                  >
                                      <option value={-1}>-- Skip --</option>
                                      {csvHeaders.map((h, i) => (
                                          <option key={i} value={i}>{h}</option>
                                      ))}
                                  </select>
                              </div>
                          ))}
                      </div>
                  </div>
              )}

              {wizardStep === 'PREVIEW' && (
                  <div className="space-y-4">
                      <div className="bg-purple-50 p-3 rounded-lg text-sm text-purple-700 mb-4 flex items-center gap-2">
                         <Eye className="w-5 h-5 shrink-0" />
                         <p>Previewing <strong>{previewRecipes.length}</strong> of {csvRows.length} recipes. Check if data looks correct.</p>
                      </div>

                      <div className="space-y-4">
                          {previewRecipes.map((r, i) => (
                              <div key={i} className="border border-gray-200 rounded-lg p-3 bg-white text-sm">
                                  <div className="font-bold text-gray-800 text-lg mb-1">{r.title || <span className="text-red-400 italic">Missing Title</span>}</div>
                                  <div className="grid grid-cols-2 gap-2 text-gray-600 mb-2">
                                      <div><span className="font-bold">Time:</span> {r.prepTime + r.cookTime}m</div>
                                      <div><span className="font-bold">Servings:</span> {r.servings}</div>
                                  </div>
                                  <div className="mb-2">
                                      <span className="font-bold block text-xs uppercase text-gray-400">Ingredients ({r.ingredients.length})</span>
                                      <div className="text-gray-700 pl-2 border-l-2 border-gray-200 mt-1 text-xs">
                                          {r.ingredients.slice(0, 3).map((ing, idx) => (
                                              <div key={idx}>{ing.amount} {ing.unit} {ing.item}</div>
                                          ))}
                                          {r.ingredients.length > 3 && <div className="italic text-gray-400">...and {r.ingredients.length - 3} more</div>}
                                      </div>
                                  </div>
                                  <div>
                                      <span className="font-bold block text-xs uppercase text-gray-400">Steps ({r.instructions.length})</span>
                                      <div className="text-gray-700 mt-1 line-clamp-2 text-xs">
                                          {r.instructions[0]}
                                      </div>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              )}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
              {wizardStep === 'MAP' && (
                  <button 
                      onClick={handleGeneratePreview}
                      disabled={mapping.title === -1 || mapping.ingredients === -1 || mapping.instructions === -1}
                      className="px-6 py-2 bg-chef-600 text-white font-bold rounded-lg hover:bg-chef-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                      <Eye className="w-4 h-4" />
                      Generate Preview
                  </button>
              )}

              {wizardStep === 'PREVIEW' && (
                  <button 
                      onClick={finishWizard}
                      className="px-6 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 flex items-center gap-2 shadow-lg shadow-green-200"
                  >
                      <CheckCircle className="w-5 h-5" />
                      Confirm & Import {csvRows.length} Recipes
                  </button>
              )}
          </div>
      </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] h-[650px]">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-700" />
            <h3 className="font-bold text-gray-800">
                {view === 'MENU' ? 'Settings & Data' : 'CSV Import Wizard'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
             {view === 'MENU' ? renderMenu() : renderWizard()}
        </div>

        {view === 'MENU' && (
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-lg text-sm font-medium transition-colors">
                Close
            </button>
            </div>
        )}
      </div>
    </div>
  );
};

export default SettingsModal;
