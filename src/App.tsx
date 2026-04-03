import { useState, useEffect, Suspense, lazy } from 'react';
import { LayoutDashboard, Package, Archive, TrendingUp, BarChart3, Truck, Search, RefreshCw, Menu } from 'lucide-react';
import { DataUploader } from './components/DataUploader';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const ProductStatus = lazy(() => import('./pages/ProductStatus'));
const InventoryStatus = lazy(() => import('./pages/InventoryStatus'));
const SmartOrder = lazy(() => import('./pages/SmartOrder'));
const SupplyStatus = lazy(() => import('./pages/SupplyStatus'));
const KeywordRanking = lazy(() => import('./pages/KeywordRanking'));
const AdManagement = lazy(() => import('./pages/AdManagement'));

const PageLoader = () => (
  <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] w-full gap-4">
    <div className="w-16 h-16 border-4 border-slate-100 border-t-primary rounded-full animate-spin"></div>
    <p className="text-caption font-black text-text-disabled uppercase tracking-[0.3em]">Initializing Interface...</p>
  </div>
);

function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'inventory' | 'smartorder' | 'keyword' | 'supply' | 'advertising'>(() => {
    const saved = localStorage.getItem('activeTab');
    const validTabs = ['dashboard', 'products', 'inventory', 'smartorder', 'keyword', 'supply', 'advertising'];
    return (validTabs.includes(saved || '') ? saved : 'dashboard') as any;
  });

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('isSidebarOpen');
    return saved !== null ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    localStorage.setItem('isSidebarOpen', JSON.stringify(isSidebarOpen));
  }, [isSidebarOpen]);

  const [showKeywordManager, setShowKeywordManager] = useState(() => {
    const saved = localStorage.getItem('showKeywordManager');
    return saved !== null ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    localStorage.setItem('showKeywordManager', JSON.stringify(showKeywordManager));
  }, [showKeywordManager]);

  const handleHardRefresh = () => {
    if (confirm('전체 데이터를 새로고침하고 캐시를 초기화하시겠습니까?')) {
      window.location.href = window.location.pathname + '?v=' + Date.now();
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFCFD] flex overflow-hidden font-sans selection:bg-primary/10 selection:text-primary">
      {/* Sidebar */}
      <aside className={`relative z-20 bg-white border-r border-slate-100 transition-all duration-500 ease-in-out flex-shrink-0 overflow-hidden ${isSidebarOpen ? 'w-80 opacity-100 translate-x-0' : 'w-0 opacity-0 -translate-x-4'}`}>
        <div className="w-80 h-full relative flex flex-col">
          <div className="p-10 pb-6">
            <div
              onClick={() => setActiveTab('dashboard')}
              className="flex items-center gap-3.5 cursor-pointer group select-none transition-all duration-300 hover:translate-x-1"
            >
              <div className="flex items-center justify-center transition-all duration-500 group-hover:rotate-12">
                <span className="text-4xl leading-none">🚀</span>
              </div>
              <div className="flex flex-col">
                <h1 className="text-[22px] font-extrabold text-text-primary tracking-tight transition-colors duration-300 group-hover:text-primary">
                  Coupang Analytics
                </h1>
              </div>
            </div>

          </div>

          <div className="px-6 py-8 flex-1 overflow-y-auto custom-scrollbar">

            <nav className="space-y-2 flex-1 w-full">
              {[
                { id: 'dashboard', label: '대시보드', icon: LayoutDashboard },
                { id: 'products', label: '상품현황', icon: Package },
                { id: 'inventory', label: '재고현황', icon: Archive },
                { id: 'smartorder', label: '스마트 발주', icon: Truck },
                { id: 'supply', label: '공급관리', icon: TrendingUp },
                { id: 'keyword', label: '키워드 랭킹', icon: Search },
                { id: 'advertising', label: '광고 관리', icon: BarChart3 },
              ].map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as any)}
                    className={`group w-full flex items-center px-6 py-4 rounded-3xl transition-all duration-500 ${isActive
                        ? 'bg-primary text-white scale-[1.02]'
                        : 'text-text-secondary hover:bg-primary-soft hover:text-primary'
                      }`}
                  >
                    <item.icon size={20} strokeWidth={isActive ? 3 : 2} className={`mr-4 ${isActive ? 'text-white' : 'text-text-disabled group-hover:text-primary'} transition-colors`} />
                    <span className={`text-item-main tracking-tight ${isActive ? 'text-white opacity-100' : 'text-text-secondary opacity-80'}`}>{item.label}</span>
                    {isActive && <div className="ml-auto w-2 h-2 rounded-full bg-white/40 animate-pulse"></div>}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-10 mt-auto opacity-10">
            <span className="text-[9px] font-bold text-text-disabled uppercase tracking-widest">Analytics Dashboard</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 relative z-10 flex flex-col h-screen overflow-hidden bg-[#FDFCFD]">
        <header className="bg-white/60 backdrop-blur-3xl border-b border-slate-100 px-12 py-8 flex justify-between items-center z-50 sticky top-0">
          <div className="flex items-center gap-8">

            <div className="flex items-center gap-6">
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-3 hover:bg-slate-100 rounded-2xl text-text-secondary transition-all active:scale-95"
                title="사이드바 메뉴"
              >
                <Menu size={20} strokeWidth={2.5} />
              </button>
              <div className="flex flex-col">
                <h2 className="text-page-title text-text-primary tracking-tighter">
                  {activeTab === 'dashboard' && '대시보드'}
                  {activeTab === 'products' && '상품 판매 현황'}
                  {activeTab === 'inventory' && '재고 관리 현황'}
                  {activeTab === 'smartorder' && '스마트 발주 추천'}
                  {activeTab === 'keyword' && '쿠팡 키워드 랭킹 추적'}
                  {activeTab === 'supply' && '쿠팡 발주 대비 공급/입고 현황'}
                  {activeTab === 'advertising' && '쿠팡 광고 성과 및 제어'}
                </h2>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <button
              onClick={handleHardRefresh}
              className="p-3 text-text-disabled hover:text-primary transition-all rounded-2xl hover:bg-primary-soft group"
              title="시스템 강제 새로고침"
            >
              <RefreshCw size={20} className="group-active:rotate-180 transition-transform duration-700" />
            </button>
            <DataUploader />
          </div>
        </header>

        {/* Content Area - Open & Spacious */}
        <div className="p-0 overflow-y-auto flex-1 h-full scroll-smooth custom-scrollbar">
          <div className="max-w-[1700px] mx-auto w-full px-12 py-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
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
