
import React, { useMemo } from 'react';
import { WeeklyPlan, Recipe, DAYS_OF_WEEK, DINING_OUT_ID } from '../types';
import { Calendar, ChevronRight, Utensils, Coffee, Moon, Store, PenTool } from 'lucide-react';

interface TodaysMenuProps {
  plan: WeeklyPlan;
  recipes: Recipe[];
  onRecipeClick: (id: string) => void;
  onGoToPlanner: () => void;
}

const TodaysMenu: React.FC<TodaysMenuProps> = ({ plan, recipes, onRecipeClick, onGoToPlanner }) => {
  const today = useMemo(() => {
    return new Date().toLocaleDateString('en-US', { weekday: 'long' });
  }, []);

  // Validate if today is a supported DayOfWeek
  const isValidDay = DAYS_OF_WEEK.includes(today as any);
  const todaysMeals = isValidDay ? plan[today] : null;
  const hasMeals = todaysMeals && Object.keys(todaysMeals).length > 0;

  const getRecipe = (id: string) => recipes.find(r => r.id === id);

  const MealCard = ({ type, recipeId, icon: Icon }: { type: string, recipeId: string, icon: any }) => {
    // 1. Dining Out Case
    if (recipeId === DINING_OUT_ID) {
      return (
        <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-xl shadow-sm cursor-default">
           <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
              <Store className="w-6 h-6 text-blue-500" />
           </div>
           <div className="flex-1 min-w-0">
             <div className="flex items-center gap-2 mb-0.5">
               <Icon className="w-3 h-3 text-blue-400" />
               <span className="text-xs font-bold text-blue-400 uppercase tracking-wide">{type}</span>
             </div>
             <h4 className="font-bold text-gray-800 text-sm">Dining Out</h4>
           </div>
        </div>
      );
    }

    const recipe = getRecipe(recipeId);

    // 2. Custom Text Meal Case
    if (!recipe) {
        return (
            <div className="flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-100 rounded-xl shadow-sm cursor-default">
               <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center shrink-0">
                  <PenTool className="w-6 h-6 text-indigo-500" />
               </div>
               <div className="flex-1 min-w-0">
                 <div className="flex items-center gap-2 mb-0.5">
                   <Icon className="w-3 h-3 text-indigo-400" />
                   <span className="text-xs font-bold text-indigo-400 uppercase tracking-wide">{type}</span>
                 </div>
                 <h4 className="font-bold text-gray-800 text-sm truncate">{recipeId}</h4>
               </div>
            </div>
        );
    }

    // 3. Saved Recipe Case
    return (
      <div 
        onClick={() => onRecipeClick(recipeId)}
        className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md hover:border-chef-200 transition-all cursor-pointer group"
      >
        <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden shrink-0">
          <img src={recipe.imageUrl} className="w-full h-full object-cover" alt="" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <Icon className="w-3 h-3 text-chef-500" />
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">{type}</span>
          </div>
          <h4 className="font-bold text-gray-800 text-sm truncate group-hover:text-chef-600 transition-colors">
            {recipe.title}
          </h4>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-chef-400" />
      </div>
    );
  };

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-chef-600" />
          Today's Menu <span className="text-gray-400 font-normal">({today})</span>
        </h2>
        <button 
          onClick={onGoToPlanner}
          className="text-sm text-chef-600 font-medium hover:underline"
        >
          Edit Plan
        </button>
      </div>

      {!hasMeals ? (
        <div 
          onClick={onGoToPlanner}
          className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-chef-300 hover:bg-chef-50 transition-all cursor-pointer group"
        >
          <Utensils className="w-8 h-8 text-gray-300 mx-auto mb-2 group-hover:text-chef-500 transition-colors" />
          <p className="text-gray-500 font-medium">Nothing planned for today.</p>
          <p className="text-sm text-gray-400">Click to add meals</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {todaysMeals?.['Breakfast'] && <MealCard type="Breakfast" recipeId={todaysMeals['Breakfast']} icon={Coffee} />}
          {todaysMeals?.['Lunch'] && <MealCard type="Lunch" recipeId={todaysMeals['Lunch']} icon={Utensils} />}
          {todaysMeals?.['Dinner'] && <MealCard type="Dinner" recipeId={todaysMeals['Dinner']} icon={Moon} />}
        </div>
      )}
    </div>
  );
};

export default TodaysMenu;
