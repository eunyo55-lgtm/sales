import { useState, useEffect, Suspense, lazy } from 'react';
import { LayoutDashboard, Package, Archive, Menu, TrendingUp, BarChart3 } from 'lucide-react';
import { DataUploader } from './components/DataUploader';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const ProductStatus = lazy(() => import('./pages/ProductStatus'));
const InventoryStatus = lazy(() => import('./pages/InventoryStatus'));
const SmartOrder = lazy(() => import('./pages/SmartOrder'));
const SupplyStatus = lazy(() => import('./pages/SupplyStatus'));
const KeywordRanking = lazy(() => import('./pages/KeywordRanking'));
const AdManagement = lazy(() => import('./pages/AdManagement'));

const PageLoader = () => (
  <div className="flex items-center justify-center h-[50vh] w-full">
    <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
  </div>
);

function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'inventory' | 'smartorder' | 'keyword' | 'supply' | 'advertising'>(() => {
    const saved = localStorage.getItem('activeTab');
    const validTabs = ['dashboard', 'products', 'inventory', 'smartorder', 'keyword', 'supply' , 'advertising'];
    return (validTabs.includes(saved || '') ? saved : 'dashboard') as any;
  });

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showKeywordManager, setShowKeywordManager] = useState(() => {
    const saved = localStorage.getItem('showKeywordManager');
    return saved !== null ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    localStorage.setItem('showKeywordManager', JSON.stringify(showKeywordManager));
  }, [showKeywordManager]);

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-hidden font-sans relative">
      {/* Ambient background removed for cleaner minimalist look */}

      {/* Sidebar - Glassmorphism Light */}
      <aside className={`relative z-20 bg-white/70 backdrop-blur-xl border-r border-white/60 transition-all duration-400 ease-[cubic-bezier(0.25,1,0.5,1)] flex-shrink-0 ${isSidebarOpen ? 'w-64 opacity-100' : 'w-0 opacity-0 overflow-hidden'}`}>
        <div className="w-64 h-full relative flex flex-col">
          <div className="p-6 pb-2">
            <div className="flex items-center space-x-3 group cursor-pointer">
              <div className="w-8 h-8 rounded-full bg-rose-500 flex items-center justify-center transition-all duration-300 shadow-sm">
                <span className="text-sm font-bold text-white tracking-widest">C</span>
              </div>
              <div className="flex flex-col">
                <h1 className="text-[17px] font-semibold text-slate-800 whitespace-nowrap leading-tight tracking-tight">Coupang Analytics</h1>
              </div>
            </div>
          </div>
          
          <div className="px-6 py-4">
            <p className="text-[11px] font-medium text-slate-400 mb-3 px-3">Menu</p>
            <nav className="space-y-1.5 flex-1 w-full">
              {[
                { id: 'dashboard', label: '대시보드', icon: LayoutDashboard },
                { id: 'products', label: '상품현황', icon: Package },
                { id: 'inventory', label: '재고현황', icon: Archive },
                { id: 'smartorder', label: '스마트 발주', icon: null, emoji: '🚚' },
                { id: 'supply', label: '공급관리', icon: TrendingUp },
                { id: 'keyword', label: '키워드 랭킹', icon: null, emoji: '📊' },
                { id: 'advertising', label: '광고 관리', icon: BarChart3 },
              ].map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as any)}
                    className={`group w-full flex items-center justify-between px-4 py-2.5 rounded-2xl transition-all duration-300 overflow-hidden relative ${
                      isActive
                        ? 'bg-sky-50 text-blue-500 font-semibold'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700 font-medium'
                    }`}
                  >
                    <div className="flex items-center space-x-3 z-10 w-full">
                      {item.icon ? (
                        <item.icon size={18} strokeWidth={isActive ? 2 : 1.5} className={`transition-colors ${isActive ? 'text-blue-500' : 'text-slate-400 group-hover:text-slate-500'}`} />
                      ) : (
                        <span className="text-lg w-[18px] text-center">{item.emoji}</span>
                      )}
                      <span className="tracking-tight text-sm flex-1 text-left">{item.label}</span>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="w-full p-6 mt-auto">
            <div className="bg-white/60 border border-slate-100 rounded-xl p-4 flex items-center space-x-3 backdrop-blur-md">
              <div className="relative flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 z-10"></div>
                <div className="absolute w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping opacity-75"></div>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-medium text-slate-600 leading-tight">Supabase Connected</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 relative z-10 flex flex-col h-screen overflow-hidden">
        {/* Header - Glassmorphism */}
        <header className="bg-white/60 backdrop-blur-xl border-b border-white/50 px-8 py-4 flex justify-between items-center z-50 sticky top-0 transition-all">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 -ml-2 text-slate-500 hover:bg-slate-100/80 rounded-xl transition-colors"
            >
              <Menu size={22} className={!isSidebarOpen ? "scale-110" : ""} />
            </button>
            <div className="h-6 w-px bg-slate-200"></div>
            <h2 className="text-lg font-medium text-slate-700 tracking-tight flex items-center">
              {activeTab === 'dashboard' && '대시보드 Overview'}
              {activeTab === 'products' && '상품 판매 현황'}
              {activeTab === 'inventory' && '재고 관리 현황'}
              {activeTab === 'smartorder' && '스마트 발주 추천'}
              {activeTab === 'keyword' && '쿠팡 키워드 랭킹 추적'}
              {activeTab === 'supply' && '쿠팡 발주 대비 공급/입고 현황'}
              {activeTab === 'advertising' && '쿠팡 광고 성과 및 제어'}
            </h2>
          </div>
          <div className="flex items-center">
            <DataUploader />
          </div>
        </header>

        {/* Content Area */}
        <div className="p-8 overflow-y-auto flex-1 h-full scroll-smooth">
          <div className="w-full">
            <Suspense fallback={<PageLoader />}>
              {activeTab === 'dashboard' && <Dashboard />}
              {activeTab === 'products' && <ProductStatus />}
              {activeTab === 'inventory' && <InventoryStatus />}
              {activeTab === 'smartorder' && <SmartOrder />}
              {activeTab === 'keyword' && (
                <KeywordRanking
                  showKeywordManager={showKeywordManager}
                  setShowKeywordManager={setShowKeywordManager}
                />
              )}
              {activeTab === 'supply' && <SupplyStatus />}
              {activeTab === 'advertising' && <AdManagement />}
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
