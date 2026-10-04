
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, LayoutGrid, 
  ExternalLink, Calendar, Settings as SettingsIcon, Sparkles, XCircle, Refrigerator, Heart, AlertTriangle, Trash2, LogOut, ChefHat,
  Server, ShieldCheck
} from 'lucide-react';

import { Recipe, ViewMode, WeeklyPlan, BackupData, UserProfile } from './types';
import * as storage from './services/storageService';

import RecipeCard from './components/RecipeCard';
import RecipeView from './components/RecipeView';
import ImportModal from './components/ImportModal';
import Planner from './components/Planner';
import ShoppingList from './components/ShoppingList';
import InventoryView from './components/InventoryView';
import SettingsModal from './components/SettingsModal';
import TodaysMenu from './components/TodaysMenu';
import RecommendationModal from './components/RecommendationModal';
import LoginScreen from './components/LoginScreen';
import BrandLogo from './components/BrandLogo';
import AdminConsole from './components/AdminConsole';

const App: React.FC = () => {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(storage.getActiveUser());
  const [isServerConnected, setIsServerConnected] = useState(true);

  // App State
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan>({});
  const [inventory, setInventory] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.LIST);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  
  // Modals
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showRecommendationModal, setShowRecommendationModal] = useState(false);
  
  // Delete Confirmation State
  const [recipeToDelete, setRecipeToDelete] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | 'ALL' | 'FAVORITES'>('ALL');
  const [quickTags, setQuickTags] = useState<string[]>([]);
  const [recommendedIds, setRecommendedIds] = useState<string[] | null>(null);

  const [apiKeyMissing, setApiKeyMissing] = useState(false);

  // Initialize
  useEffect(() => {
    const initApp = async () => {
      // Check Local Auth
      const storedAuth = localStorage.getItem('mpishi_auth');
      if (storedAuth === 'true') {
        setIsAuthenticated(true);
      }
      const activeUser = storage.getActiveUser();
      if (activeUser) {
        setCurrentUser(activeUser);
      }
      setAuthLoading(false);

      // Load initial local data immediately
      storage.seedInitialData();
      setRecipes(storage.getRecipes());
      setWeeklyPlan(storage.getWeeklyPlan());
      setInventory(storage.getInventory());

      // Attempt live sync with server storage container
      try {
        const syncResult = await storage.syncWithServer();
        if (syncResult) {
          setIsServerConnected(true);
          if (syncResult.recipes && syncResult.recipes.length > 0) setRecipes(syncResult.recipes);
          if (syncResult.weeklyPlan) setWeeklyPlan(syncResult.weeklyPlan);
          if (syncResult.inventory) setInventory(syncResult.inventory);
          if (!activeUser && syncResult.users && syncResult.users.length > 0) {
            storage.setActiveUser(syncResult.users[0]);
            setCurrentUser(syncResult.users[0]);
          }
        } else {
          setIsServerConnected(false);
        }
      } catch (_) {
        setIsServerConnected(false);
      }

      // Check for Shared Shopping List URL Param
      const params = new URLSearchParams(window.location.search);
      const quickListParam = params.get('quickList');
      if (quickListParam) {
          try {
              const decoded = atob(quickListParam);
              const items = JSON.parse(decoded);
              
              if (Array.isArray(items)) {
                  const currentManual = storage.getManualShoppingItems();
                  const newItems = items.filter((i: string) => !currentManual.includes(i));
                  const combined = [...currentManual, ...newItems];
                  
                  storage.saveManualShoppingItems(combined);
                  window.history.replaceState({}, document.title, window.location.pathname);
                  localStorage.setItem('mpishi_auth', 'true');
                  setIsAuthenticated(true);
                  setViewMode(ViewMode.SHOPPING_LIST);
                  alert(`Imported ${newItems.length} items from shared list!`);
              }
          } catch (e) {
              console.error("Failed to parse shared list", e);
          }
      }
    };

    initApp();
  }, []);

  const handleLogin = async (username: string, password: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          localStorage.setItem('mpishi_auth', 'true');
          storage.setActiveUser(data.user);
          setCurrentUser(data.user);
          setIsAuthenticated(true);
          return true;
        }
      }
    } catch (_) {
      // Fallback
    }

    if (password === 'Mpishi4me!' || password === 'Cooking123!') {
      localStorage.setItem('mpishi_auth', 'true');
      const fallbackUser: UserProfile = password === 'Cooking123!'
        ? { id: 'user-2', username: 'chef2', name: 'Sous Chef', role: 'user', avatarColor: '#0284c7' }
        : { id: 'user-1', username: 'chef1', name: 'Head Chef', role: 'admin', avatarColor: '#ea580c' };
      storage.setActiveUser(fallbackUser);
      setCurrentUser(fallbackUser);
      setIsAuthenticated(true);
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    localStorage.removeItem('mpishi_auth');
    setIsAuthenticated(false);
  };

  const handleClearData = () => {
      localStorage.clear();
      // Restore auth
      localStorage.setItem('mpishi_auth', 'true');
      
      // Reset State
      setRecipes([]);
      setWeeklyPlan({});
      setInventory([]);
      setQuickTags([]);
      setSelectedRecipeId(null);
      setRecommendedIds(null);
      setViewMode(ViewMode.LIST);
      
      // Re-seed demo data if needed (optional, or just leave empty)
      storage.seedInitialData();
      setRecipes(storage.getRecipes());
  };

  // Calculate Popular Tags and Rotate them
  useEffect(() => {
    if (recipes.length === 0) return;

    // 1. Count frequencies
    const tagCounts: Record<string, number> = {};
    recipes.forEach(r => r.tags.forEach(t => {
      tagCounts[t] = (tagCounts[t] || 0) + 1;
    }));

    // 2. Sort by popularity (most used first)
    const sortedTags = Object.keys(tagCounts).sort((a, b) => tagCounts[b] - tagCounts[a]);

    // 3. Take Top 20 Candidates (to avoid showing obscure tags)
    const candidatePool = sortedTags.slice(0, 20);

    // 4. Randomly pick 5 to display for this session
    const shuffled = [...candidatePool].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 5);

    setQuickTags(selected);
  }, [recipes.length]);

  // Ensure the active filter is visible if it's a tag
  const visibleTags = useMemo(() => {
      if (activeFilter !== 'ALL' && activeFilter !== 'FAVORITES' && !quickTags.includes(activeFilter)) {
          return [activeFilter, ...quickTags.slice(0, 4)];
      }
      return quickTags;
  }, [quickTags, activeFilter]);

  const handleRecipeClick = (id: string) => {
    setSelectedRecipeId(id);
    setViewMode(ViewMode.DETAIL);
    window.scrollTo(0, 0);
  };

  const handleSaveRecipe = (recipe: Recipe) => {
    storage.saveRecipe(recipe);
    setRecipes(storage.getRecipes());
  };

  const handleSaveCopy = (newRecipe: Recipe) => {
    storage.saveRecipe(newRecipe);
    setRecipes(storage.getRecipes());
    setSelectedRecipeId(newRecipe.id);
    setViewMode(ViewMode.DETAIL);
  };

  const handleUpdateRecipe = (updated: Recipe) => {
    storage.saveRecipe(updated);
    setRecipes(storage.getRecipes());
  };

  // Triggers the Confirmation Modal
  const handleDeleteRecipe = (id: string) => {
    setRecipeToDelete(id);
  };

  // Performs the actual deletion
  const executeDelete = () => {
    if (!recipeToDelete) return;

    const id = recipeToDelete;
    
    // 1. Delete from storage
    storage.deleteRecipe(id);
    
    // 2. Cleanup Planner
    let planUpdated = false;
    const newPlan = { ...weeklyPlan };
    Object.keys(newPlan).forEach(day => {
      Object.keys(newPlan[day]).forEach(meal => {
        if (newPlan[day][meal] === id) {
          delete newPlan[day][meal];
          planUpdated = true;
        }
      });
      if (Object.keys(newPlan[day]).length === 0) delete newPlan[day];
    });

    if (planUpdated) {
      setWeeklyPlan(newPlan);
      storage.saveWeeklyPlan(newPlan);
    }

    // 3. Update State directly
    setRecipes(prev => prev.filter(r => r.id !== id));
    
    // 4. Reset View
    setViewMode(ViewMode.LIST);
    setSelectedRecipeId(null);
    setRecipeToDelete(null);
  };

  const handleToggleFavorite = (e: React.MouseEvent | null, id: string) => {
    if (e) e.stopPropagation();
    storage.toggleFavorite(id);
    setRecipes(storage.getRecipes());
  };

  const handleUpdatePlan = (newPlan: WeeklyPlan) => {
    setWeeklyPlan(newPlan);
    storage.saveWeeklyPlan(newPlan);
  };

  const handleUpdateInventory = (items: string[]) => {
    setInventory(items);
    storage.saveInventory(items);
  };

  const handleRecommendationSelect = (ids: string[]) => {
    setRecommendedIds(ids);
    setSearchQuery(''); 
    setActiveFilter('ALL');
    setViewMode(ViewMode.LIST);
    setShowRecommendationModal(false);
  };

  const clearRecommendations = () => {
    setRecommendedIds(null);
  };

  const handleImportData = (type: 'RECIPES' | 'INVENTORY' | 'BACKUP', data: any) => {
    if (type === 'BACKUP') {
      const backup = data as BackupData;
      if (backup.recipes) {
        storage.saveAllRecipes(backup.recipes);
        setRecipes(backup.recipes);
      }
      if (backup.inventory) {
        storage.saveInventory(backup.inventory);
        setInventory(backup.inventory);
      }
      if (backup.weeklyPlan) {
        storage.saveWeeklyPlan(backup.weeklyPlan);
        setWeeklyPlan(backup.weeklyPlan);
      }
      if (backup.inventoryLocations) {
        storage.saveInventoryLocations(backup.inventoryLocations);
      }
      alert('Full System Restore Complete!');
    } 
    else if (type === 'RECIPES') {
      const newRecipes = data as Recipe[];
      const existingIds = new Set(recipes.map(r => r.id));
      const toAdd = newRecipes.filter(r => !existingIds.has(r.id));
      
      const combined = [...recipes, ...toAdd];
      storage.saveAllRecipes(combined);
      setRecipes(combined);
      alert(`Imported ${toAdd.length} new recipes.`);
    } 
    else if (type === 'INVENTORY') {
      const newItems = data as string[];
      const combined = Array.from(new Set([...inventory, ...newItems]));
      storage.saveInventory(combined);
      setInventory(combined);
      alert(`Imported inventory items.`);
    }
  };

  const filteredRecipes = recipes.filter(r => {
      if (recommendedIds) {
        return recommendedIds.includes(r.id);
      }
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || 
             r.title.toLowerCase().includes(q) || 
             r.tags.some(t => t.toLowerCase().includes(q)) ||
             r.ingredients.some(i => i.item.toLowerCase().includes(q));

      if (!matchesSearch) return false;
      if (activeFilter === 'FAVORITES') return r.isFavorite;
      if (activeFilter !== 'ALL') return r.tags.includes(activeFilter);
      return true;
  });

  const selectedRecipe = recipes.find(r => r.id === selectedRecipeId);

  // ----------------------------------------------------------------------------------
  // AUTH GUARD
  // ----------------------------------------------------------------------------------
  if (authLoading) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-[#fafaf9]">
             <div className="animate-spin text-chef-600">
                <BrandLogo size="large" />
             </div>
          </div>
      );
  }

  if (!isAuthenticated) {
      return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-[#fafaf9] flex flex-col font-sans">
      
      {/* Top Navigation */}
      <header className="bg-white border-b border-[#e7e5e4] sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div 
            className="flex items-center gap-3 cursor-pointer flex-shrink-0 group" 
            onClick={() => { setViewMode(ViewMode.LIST); setSelectedRecipeId(null); clearRecommendations(); setActiveFilter('ALL'); }}
          >
            <div className="bg-chef-50 p-1.5 rounded-lg group-hover:bg-chef-100 transition-colors">
              <BrandLogo />
            </div>
            <h1 className="text-xl font-bold text-gray-800 hidden md:block tracking-tight group-hover:text-chef-700 transition-colors">Mpishi Cooking</h1>
          </div>

          <div className="flex items-center bg-[#f5f5f4] rounded-lg p-1 gap-1 overflow-x-auto no-scrollbar">
             <button 
                onClick={() => setViewMode(ViewMode.LIST)}
                className={`p-2 rounded-md transition-all flex items-center gap-2 text-sm font-medium whitespace-nowrap ${viewMode === ViewMode.LIST ? 'bg-white shadow text-chef-700' : 'text-gray-500 hover:text-gray-700'}`}
             >
                <LayoutGrid className="w-4 h-4" />
                <span className="hidden sm:inline">Recipes</span>
             </button>
             <button 
                onClick={() => setViewMode(ViewMode.PLANNER)}
                className={`p-2 rounded-md transition-all flex items-center gap-2 text-sm font-medium whitespace-nowrap ${viewMode === ViewMode.PLANNER || viewMode === ViewMode.SHOPPING_LIST ? 'bg-white shadow text-chef-700' : 'text-gray-500 hover:text-gray-700'}`}
             >
                <Calendar className="w-4 h-4" />
                <span className="hidden sm:inline">Planner</span>
             </button>
             <button 
                onClick={() => setViewMode(ViewMode.INVENTORY)}
                className={`p-2 rounded-md transition-all flex items-center gap-2 text-sm font-medium whitespace-nowrap ${viewMode === ViewMode.INVENTORY ? 'bg-white shadow text-chef-700' : 'text-gray-500 hover:text-gray-700'}`}
             >
                <Refrigerator className="w-4 h-4" />
                <span className="hidden sm:inline">Inventory</span>
             </button>
          </div>

          <div className="flex-1 max-w-sm mx-2 hidden md:block">
             <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-chef-500 transition-colors" />
                <input 
                  type="text" 
                  placeholder="Search recipes..." 
                  className="w-full bg-[#f5f5f4] border-transparent focus:bg-white border border-[#e7e5e4] focus:border-chef-500 rounded-full py-2 pl-10 pr-10 outline-none transition-all text-sm"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); if(recommendedIds) clearRecommendations(); }}
                />
                <button 
                   onClick={() => setShowRecommendationModal(true)}
                   className="absolute right-2 top-1/2 -translate-y-1/2 text-chef-500 hover:text-chef-600 p-1 hover:bg-chef-50 rounded-full transition-colors"
                   title="Ask Mpishi for a Recommendation"
                >
                  <Sparkles className="w-4 h-4" />
                </button>
             </div>
          </div>

          <div className="flex items-center gap-2">
            {/* LXC Storage Status Indicator */}
            <div 
              onClick={() => setShowAdminModal(true)}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border bg-stone-50 border-stone-200 cursor-pointer hover:bg-stone-100 transition-colors"
              title="Click to view Storage Container & LXC details"
            >
              <span className={`w-2 h-2 rounded-full ${isServerConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`}></span>
              <span className="text-stone-600 font-mono text-[11px]">
                {isServerConnected ? 'LXC Synced' : 'Offline Cache'}
              </span>
            </div>

            {/* Self-Host Admin Console Trigger */}
            <button 
              onClick={() => setShowAdminModal(true)}
              className="p-2 text-stone-600 hover:text-chef-600 hover:bg-stone-100 rounded-full transition-colors relative"
              title="Storage Container & 2-User Admin Console"
            >
              <Server className="w-5 h-5 text-chef-600" />
            </button>

            {/* Active Chef Profile */}
            {currentUser && (
              <button
                onClick={() => setShowAdminModal(true)}
                className="flex items-center gap-1.5 p-1 pr-2 rounded-full hover:bg-stone-100 transition-colors border border-stone-200"
                title={`Active: ${currentUser.name} (${currentUser.role}). Click to switch or edit.`}
              >
                <div 
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm"
                  style={{ backgroundColor: currentUser.avatarColor || '#ea580c' }}
                >
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-bold text-stone-700 hidden md:inline">
                  {currentUser.name.split(' ')[0]}
                </span>
              </button>
            )}

            <button 
              onClick={() => setShowSettingsModal(true)}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
              title="Data Export & CSV Import Wizard"
            >
              <SettingsIcon className="w-5 h-5" />
            </button>
            <button 
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setShowImportModal(true)}
              className="bg-chef-600 hover:bg-chef-700 text-white px-4 py-2 rounded-full font-medium flex items-center gap-2 transition-all shadow-lg shadow-chef-200 hover:scale-105"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6">
        
        {apiKeyMissing && (
           <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 flex items-center gap-3">
             <ExternalLink className="w-5 h-5" />
             <p><strong>API Key Missing:</strong> The <code>process.env.API_KEY</code> is not set. AI features (Import, Modify, Recommend) will not work.</p>
           </div>
        )}

        {viewMode === ViewMode.LIST && (
          <>
            {!searchQuery && !recommendedIds && activeFilter === 'ALL' && (
               <TodaysMenu 
                 plan={weeklyPlan} 
                 recipes={recipes} 
                 onRecipeClick={handleRecipeClick}
                 onGoToPlanner={() => setViewMode(ViewMode.PLANNER)}
               />
            )}

            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
              <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2 whitespace-nowrap">
                {recommendedIds ? (
                   <>
                     <Sparkles className="w-6 h-6 text-chef-500" />
                     Mpishi's Picks
                   </>
                ) : (
                   'My Cookbook'
                )}
                <span className="text-gray-400 font-normal text-lg ml-2">({filteredRecipes.length})</span>
              </h2>

              <div className="w-full md:w-auto overflow-x-auto pb-2 md:pb-0 no-scrollbar">
                 <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setActiveFilter('ALL')}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${activeFilter === 'ALL' ? 'bg-chef-600 text-white border-chef-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                    >
                      All
                    </button>
                    <button 
                      onClick={() => setActiveFilter('FAVORITES')}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border flex items-center gap-1.5 ${activeFilter === 'FAVORITES' ? 'bg-red-500 text-white border-red-500' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                    >
                      <Heart className={`w-3 h-3 ${activeFilter === 'FAVORITES' ? 'fill-current' : ''}`} />
                      Favorites
                    </button>
                    <div className="w-px h-6 bg-gray-200 mx-1"></div>
                    
                    {visibleTags.map(tag => (
                       <button
                         key={tag}
                         onClick={() => setActiveFilter(tag === activeFilter ? 'ALL' : tag)}
                         className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border whitespace-nowrap ${activeFilter === tag ? 'bg-chef-100 text-chef-800 border-chef-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                       >
                         {tag}
                       </button>
                    ))}
                 </div>
              </div>

              <div className="flex gap-2 hidden sm:flex">
                {recommendedIds && (
                  <button 
                     onClick={clearRecommendations}
                     className="flex items-center gap-1 px-3 py-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg text-sm font-medium transition-colors"
                  >
                     <XCircle className="w-4 h-4" />
                     Clear Picks
                  </button>
                )}
              </div>
            </div>

            {filteredRecipes.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredRecipes.map(recipe => (
                  <RecipeCard 
                    key={recipe.id} 
                    recipe={recipe} 
                    onClick={handleRecipeClick}
                    onToggleFavorite={handleToggleFavorite}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <div className="bg-gray-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-300">
                  <ChefHat className="w-12 h-12" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">No recipes found</h3>
                <p className="text-gray-500 mb-6 max-w-md mx-auto">
                   {recommendedIds 
                      ? "Mpishi couldn't find any recipes matching your request and inventory."
                      : activeFilter !== 'ALL' ? "No recipes match this filter." : "Your cookbook is empty. Try adding a recipe!"}
                </p>
                {recommendedIds || activeFilter !== 'ALL' ? (
                   <button 
                     onClick={() => { clearRecommendations(); setActiveFilter('ALL'); }}
                     className="text-chef-600 font-bold hover:underline"
                   >
                     Show all recipes
                   </button>
                ) : (
                   <button 
                     onClick={() => setShowImportModal(true)}
                     className="text-chef-600 font-bold hover:underline"
                   >
                     Import your first recipe
                   </button>
                )}
              </div>
            )}
          </>
        )}

        {viewMode === ViewMode.DETAIL && selectedRecipe && (
          <RecipeView 
            recipe={selectedRecipe} 
            onBack={() => { setViewMode(ViewMode.LIST); setSelectedRecipeId(null); }}
            onUpdate={handleUpdateRecipe}
            onSaveCopy={handleSaveCopy}
            onDelete={handleDeleteRecipe}
            onToggleFavorite={(id) => handleToggleFavorite(null, id)}
            inventory={inventory}
            onUpdateInventory={handleUpdateInventory}
          />
        )}

        {viewMode === ViewMode.PLANNER && (
           <Planner 
              plan={weeklyPlan}
              recipes={recipes}
              onUpdatePlan={handleUpdatePlan}
              onGenerateShoppingList={() => setViewMode(ViewMode.SHOPPING_LIST)}
           />
        )}

        {viewMode === ViewMode.SHOPPING_LIST && (
          <ShoppingList 
            plan={weeklyPlan}
            recipes={recipes}
            inventory={inventory}
            onUpdateInventory={handleUpdateInventory}
            onBack={() => setViewMode(ViewMode.PLANNER)}
            onClearPlan={() => handleUpdatePlan({})}
          />
        )}

        {viewMode === ViewMode.INVENTORY && (
          <InventoryView 
             inventory={inventory}
             onUpdateInventory={handleUpdateInventory}
          />
        )}

      </main>

      {/* Modals */}
      {showImportModal && (
        <ImportModal 
          onClose={() => setShowImportModal(false)} 
          onSave={handleSaveRecipe}
        />
      )}
      
      {showSettingsModal && (
        <SettingsModal 
          onClose={() => setShowSettingsModal(false)}
          recipes={recipes}
          inventory={inventory}
          weeklyPlan={weeklyPlan}
          onImportData={handleImportData}
          onReset={handleClearData}
        />
      )}

      {showAdminModal && (
        <AdminConsole
          onClose={() => setShowAdminModal(false)}
          currentUser={currentUser}
          onUserSwitched={(newUser) => setCurrentUser(newUser)}
          recipes={recipes}
          onDataRefreshed={() => {
            setRecipes(storage.getRecipes());
            setWeeklyPlan(storage.getWeeklyPlan());
            setInventory(storage.getInventory());
          }}
        />
      )}

      {showRecommendationModal && (
        <RecommendationModal
           recipes={recipes}
           inventory={inventory}
           onClose={() => setShowRecommendationModal(false)}
           onSelectRecipes={handleRecommendationSelect}
        />
      )}

      {/* Delete Confirmation Modal */}
      {recipeToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
             <div className="p-6 text-center">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                   <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">Delete Recipe?</h3>
                <p className="text-gray-500 text-sm mb-6">
                   Are you sure you want to delete this recipe? This action cannot be undone.
                </p>
                <div className="flex gap-3">
                   <button 
                     onClick={() => setRecipeToDelete(null)}
                     className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
                   >
                     Cancel
                   </button>
                   <button 
                     onClick={executeDelete}
                     className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                   >
                     <Trash2 className="w-4 h-4" /> Delete
                   </button>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
