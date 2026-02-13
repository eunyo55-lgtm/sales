import { useState, useEffect } from 'react';
import { LayoutDashboard, Package, Archive } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import ProductStatus from './pages/ProductStatus';
import InventoryStatus from './pages/InventoryStatus';
import { DataUploader } from './components/DataUploader';

function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'inventory'>(() => {
    const saved = localStorage.getItem('activeTab');
    return (saved as 'dashboard' | 'products' | 'inventory') || 'dashboard';
  });

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200">
        <div className="p-6">
          <div className="flex items-start space-x-2">
            <span className="text-xl">🚀</span>
            <div>
              <h1 className="text-lg font-bold text-gray-800 whitespace-nowrap leading-none pt-1">Coupang Manager</h1>
              <p className="text-xs text-gray-400 font-normal mt-1">by OzKiz</p>
            </div>
          </div>
        </div>
        <nav className="mt-6 px-4 space-y-2">
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
        </nav>

        <div className="absolute bottom-0 w-64 p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center space-x-3 text-sm text-gray-600">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span>Supabase Connected</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center sticky top-0 z-10">
          <h2 className="text-lg font-semibold text-gray-800">
            {activeTab === 'dashboard' && '대시보드 Overview'}
            {activeTab === 'products' && '상품 판매 현황'}
            {activeTab === 'inventory' && '재고 관리 현황'}
          </h2>
          <DataUploader />
        </header>

        <div className="p-8">
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'products' && <ProductStatus />}
          {activeTab === 'inventory' && <InventoryStatus />}
        </div>
      </main>
    </div>
  );
}

export default App;
