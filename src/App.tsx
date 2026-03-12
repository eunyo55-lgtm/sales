import { useState, useEffect } from 'react';
import { LayoutDashboard, Package, Archive, Lightbulb, Menu, TrendingUp } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import ProductStatus from './pages/ProductStatus';
import InventoryStatus from './pages/InventoryStatus';
import SmartOrder from './pages/SmartOrder';
import Insights from './pages/Insights';
import SupplyStatus from './pages/SupplyStatus';
import KeywordRanking from './pages/KeywordRanking';
import { DataUploader } from './components/DataUploader';

function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'inventory' | 'smartorder' | 'insights' | 'keyword' | 'supply'>(() => {
    const saved = localStorage.getItem('activeTab');
    return (saved as 'dashboard' | 'products' | 'inventory' | 'smartorder' | 'insights' | 'keyword' | 'supply') || 'dashboard';
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

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className={`bg-white border-gray-200 transition-all duration-300 overflow-hidden shrink-0 ${isSidebarOpen ? 'w-64 border-r' : 'w-0'}`}>
        <div className="w-64 h-full relative flex flex-col">
          <div className="p-6">
            <div className="flex items-start space-x-2">
              <span className="text-xl">🚀</span>
              <div>
                <h1 className="text-lg font-bold text-gray-800 whitespace-nowrap leading-none pt-1">Coupang Manager V2</h1>
                <p className="text-xs text-gray-400 font-normal mt-1">by OzKiz</p>
              </div>
            </div>
          </div>
          <nav className="mt-6 px-4 space-y-2 flex-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'dashboard'
                ? 'bg-blue-50 text-blue-600'
                : 'text-gray-600 hover:bg-gray-50'
                }`}
            >
              <LayoutDashboard size={20} />
              <span className="font-medium">대시보드</span>
            </button>

            <button
              onClick={() => setActiveTab('products')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'products'
                ? 'bg-blue-50 text-blue-600'
                : 'text-gray-600 hover:bg-gray-50'
                }`}
            >
              <Package size={20} />
              <span className="font-medium">상품현황</span>
            </button>

            <button
              onClick={() => setActiveTab('inventory')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'inventory'
                ? 'bg-blue-50 text-blue-600'
                : 'text-gray-600 hover:bg-gray-50'
                }`}
            >
              <Archive size={20} />
              <span className="font-medium">재고현황</span>
            </button>

            <button
              onClick={() => setActiveTab('smartorder')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'smartorder'
                ? 'bg-blue-50 text-blue-600'
                : 'text-gray-600 hover:bg-gray-50'
                }`}
            >
              <span className="text-xl">🚚</span>
              <span className="font-medium">스마트 발주</span>
            </button>

            <button
              onClick={() => setActiveTab('insights')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'insights'
                ? 'bg-purple-50 text-purple-600'
                : 'text-gray-600 hover:bg-gray-50'
                }`}
            >
              <Lightbulb size={20} className={activeTab === 'insights' ? 'text-purple-600' : 'text-gray-500'} />
              <span className="font-medium">인사이트</span>
            </button>

            <button
              onClick={() => setActiveTab('supply')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'supply'
                ? 'bg-emerald-50 text-emerald-600'
                : 'text-gray-600 hover:bg-gray-50'
                }`}
            >
              <TrendingUp size={20} className={activeTab === 'supply' ? 'text-emerald-600' : 'text-gray-500'} />
              <span className="font-medium">공급관리</span>
            </button>

            <button
              onClick={() => setActiveTab('keyword')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'keyword'
                ? 'bg-rose-50 text-rose-600'
                : 'text-gray-600 hover:bg-gray-50'
                }`}
            >
              <span className="text-xl">📊</span>
              <span className="font-medium">키워드 랭킹</span>
            </button>
          </nav>

          <div className="w-full p-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center space-x-3 text-sm text-gray-600">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span>Supabase Connected</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center sticky top-0 z-50">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Menu size={24} />
            </button>
            <h2 className="text-lg font-semibold text-gray-800">
              {activeTab === 'dashboard' && '대시보드 Overview'}
              {activeTab === 'products' && '상품 판매 현황'}
              {activeTab === 'inventory' && '재고 관리 현황'}
              {activeTab === 'smartorder' && '스마트 발주 추천'}
              {activeTab === 'insights' && '악성 재고 & 프로모션 인사이트'}
              {activeTab === 'keyword' && '쿠팡 키워드 랭킹 추적'}
              {activeTab === 'supply' && '쿠팡 발주 대비 공급/입고 현황'}
            </h2>
          </div>
          <DataUploader />
        </header>

        <div className="p-8">
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'products' && <ProductStatus />}
          {activeTab === 'inventory' && <InventoryStatus />}
          {activeTab === 'smartorder' && <SmartOrder />}
          {activeTab === 'insights' && <Insights />}
          {activeTab === 'keyword' && (
            <KeywordRanking
              showKeywordManager={showKeywordManager}
              setShowKeywordManager={setShowKeywordManager}
            />
          )}
          {activeTab === 'supply' && <SupplyStatus />}
        </div>
      </main>
    </div>
  );
}

export default App;
