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
      {/* Background ambient gradient for glassmorphism effect */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-200/40 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-blue-200/40 rounded-full blur-[100px] pointer-events-none" />

      {/* Sidebar - Glassmorphism Light */}
      <aside className={`relative z-20 bg-white/70 backdrop-blur-xl border-r border-white/60 shadow-[4px_0_24px_rgba(0,0,0,0.02)] transition-all duration-400 ease-[cubic-bezier(0.25,1,0.5,1)] flex-shrink-0 ${isSidebarOpen ? 'w-64 opacity-100' : 'w-0 opacity-0 overflow-hidden'}`}>
        <div className="w-64 h-full relative flex flex-col">
          <div className="p-6 pb-2">
            <div className="flex items-center space-x-3 group cursor-pointer">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 group-hover:shadow-indigo-500/50 transition-all duration-300 group-hover:scale-105">
                <span className="text-xl text-white">🚀</span>
              </div>
              <div className="flex flex-col">
                <h1 className="text-[17px] font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-900 to-slate-700 whitespace-nowrap leading-tight tracking-tight">OzKiz Analytics</h1>
                <p className="text-[11px] font-semibold text-indigo-400 tracking-wider uppercase mt-0.5">by OzKiz Pro</p>
              </div>
            </div>
          </div>
          
          <div className="px-6 py-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">Menu</p>
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
                    className={`group w-full flex items-center justify-between px-3 py-3 rounded-xl transition-all duration-300 overflow-hidden relative ${
                      isActive
                        ? 'bg-white shadow-sm border border-slate-100 text-indigo-600 font-bold'
                        : 'text-slate-500 hover:bg-white/50 hover:text-slate-800 font-medium hover:shadow-sm hover:translate-x-1'
                    }`}
                  >
                    {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 rounded-r-md"></div>}
                    <div className="flex items-center space-x-3 z-10 w-full">
                      {item.icon ? (
                        <item.icon size={18} strokeWidth={isActive ? 2.5 : 2} className={`transition-colors ${isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-indigo-500'}`} />
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
            <div className="bg-white/60 border border-slate-100 rounded-xl p-4 flex items-center space-x-3 shadow-sm backdrop-blur-md">
              <div className="relative flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 z-10"></div>
                <div className="absolute w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping opacity-75"></div>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-slate-800 leading-tight">Supabase</span>
                <span className="text-[10px] text-emerald-600 font-medium">Connected</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 relative z-10 flex flex-col h-screen overflow-hidden">
        {/* Header - Glassmorphism */}
        <header className="bg-white/60 backdrop-blur-xl border-b border-white/50 px-8 py-4 flex justify-between items-center z-50 sticky top-0 shadow-[0_4px_30px_rgba(0,0,0,0.01)] transition-all">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 -ml-2 text-slate-500 hover:bg-slate-100/80 rounded-xl transition-colors hover:shadow-sm"
            >
              <Menu size={22} className={!isSidebarOpen ? "scale-110" : ""} />
            </button>
            <div className="h-6 w-px bg-slate-200"></div>
            <h2 className="text-lg font-bold text-slate-800 tracking-tight flex items-center">
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
          <div className="max-w-7xl mx-auto w-full">
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
