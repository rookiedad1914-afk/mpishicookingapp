import React, { useState, useEffect } from 'react';
import { AlertCircle, ArrowRight, Lock, ChefHat, User, ShieldCheck } from 'lucide-react';
import BrandLogo from './BrandLogo';
import { UserProfile } from '../types';
import * as storage from '../services/storageService';

interface LoginScreenProps {
  onLogin: (username: string, password: string) => Promise<boolean>;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    storage.fetchUsers().then(fetched => {
      setUsers(fetched);
      if (fetched.length > 0) {
        setSelectedUser(fetched[0]);
        setUsername(fetched[0].username);
      }
    });
  }, []);

  const handleSelectUser = (user: UserProfile) => {
    setSelectedUser(user);
    setUsername(user.username);
    setPassword('');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    try {
      const targetUser = username || selectedUser?.username || 'chef1';
      const success = await onLogin(targetUser, password);
      if (!success) {
        setError("Incorrect passcode or username.");
      }
    } catch (err) {
      setError("An unexpected error occurred connecting to the container.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafaf9] flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full">
        
        {/* Logo Section */}
        <div className="text-center mb-8 animate-in fade-in zoom-in duration-500">
          <div className="bg-chef-50 w-28 h-28 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-xl shadow-chef-100 rotate-2 border border-chef-100">
            <BrandLogo size="large" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight mb-1">Sous Chef AI</h1>
          <p className="text-gray-500 text-sm">Self-Hosted Kitchen Companion</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="p-6 sm:p-8">
            <h2 className="text-xl font-bold text-gray-800 mb-1 text-center">
              Kitchen Sign In
            </h2>
            <p className="text-gray-500 text-center mb-6 text-xs">
              Select your chef profile to unlock your cookbook
            </p>

            {/* 2-User Switcher Buttons */}
            {users.length > 0 && (
              <div className="grid grid-cols-2 gap-3 mb-6">
                {users.map(u => {
                  const isChosen = (selectedUser?.id === u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleSelectUser(u)}
                      className={`p-3 rounded-2xl border-2 text-left transition-all flex items-center gap-3 ${
                        isChosen
                          ? 'border-chef-600 bg-chef-50/70 shadow-sm'
                          : 'border-gray-200 bg-gray-50/50 hover:bg-gray-100'
                      }`}
                    >
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-base shrink-0 shadow-sm"
                        style={{ backgroundColor: u.avatarColor || '#ea580c' }}
                      >
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-gray-900 truncate">{u.name}</div>
                        <div className="text-[10px] text-gray-400 capitalize">{u.role}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Username</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. chef1"
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-chef-500 focus:border-transparent outline-none transition-all font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Passcode / Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password..."
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-chef-500 focus:border-transparent outline-none transition-all"
                    autoFocus
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={isLoading || !password}
                className="w-full bg-chef-600 text-white font-bold py-3.5 rounded-xl hover:bg-chef-700 transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-chef-200 disabled:bg-gray-300 disabled:shadow-none disabled:cursor-not-allowed text-sm"
              >
                {isLoading ? 'Verifying...' : 'Enter Kitchen'}
                {!isLoading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>

            {error && (
              <div className="mt-4 flex items-start gap-2.5 p-3 bg-red-50 text-red-700 rounded-xl border border-red-100 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            <div className="mt-5 p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-[11px] text-stone-500 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-stone-700">
                <ShieldCheck className="w-3.5 h-3.5 text-chef-600" />
                Default Credentials:
              </div>
              <div>Head Chef (Admin): <code className="bg-white px-1 py-0.5 rounded border border-stone-200 font-mono text-stone-800">Mpishi4me!</code></div>
              <div>Sous Chef: <code className="bg-white px-1 py-0.5 rounded border border-stone-200 font-mono text-stone-800">Cooking123!</code></div>
            </div>
          </div>
          
          <div className="bg-gray-50 p-3.5 text-center border-t border-gray-100">
            <p className="text-[11px] text-gray-400 font-medium">Self-Hosted LXC Storage Container • Tailscale Mesh Ready</p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default LoginScreen;