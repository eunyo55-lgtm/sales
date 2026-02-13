import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../lib/api';
import type { ProductStats } from '../lib/api';
import { Search, ArrowUpDown, Loader2, ChevronRight, ChevronDown, Filter, CheckCircle2, Copy } from 'lucide-react';
import StockRiskAlert from '../components/StockRiskAlert';

interface InventoryGroup {
  name: string;
  imageUrl?: string;
  hqStock: number;
  coupangStock: number;
  sales14Days: number;
  sales7Days: number;
  salesYesterday: number;
  avgDailySales: number;
  estimatedSales7d: number;
  shortage: number; // Sum of shortages
  minDaysOfInventory: number; // Worst case in group
  children: (ProductStats & {
    estimatedSales7d: number;
    shortage: number;
    status: string;
    statusColor: string
  })[];
}

export default function InventoryStatus() {
  const [products, setProducts] = useState<ProductStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'shortage', direction: 'desc' });
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showShortageOnly, setShowShortageOnly] = useState(true);
  const [visibleCount, setVisibleCount] = useState(50);

  useEffect(() => {
    loadData();
  }, []);

  // Reset pagination when search/filter/sort changes
  useEffect(() => {
    setVisibleCount(50);
  }, [search, showShortageOnly, sortConfig]);

  const loadData = async () => {
    try {
      const data = await api.getProductStats();
      setProducts(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // 1. Process & Group Data
  const groupedData = useMemo(() => {
    const groups = new Map<string, InventoryGroup>();

    products.forEach(p => {
      // Calculate item metrics
      const estimatedSales7d = Math.round(p.avgDailySales * 7);
      const shortage = Math.max(0, estimatedSales7d - p.coupangStock);

      let status = '양호';
      let statusColor = 'bg-green-100 text-green-800';
      if (p.coupangStock === 0) {
        status = '품절';
        statusColor = 'bg-gray-800 text-white';
      } else if (p.daysOfInventory < 7) {
        status = '위험';
        statusColor = 'bg-red-100 text-red-800';
      } else if (p.daysOfInventory < 14) {
        status = '부족';
        statusColor = 'bg-yellow-100 text-yellow-800';
      }

      const processedItem = { ...p, estimatedSales7d, shortage, status, statusColor };

      if (!groups.has(p.name)) {
        groups.set(p.name, {
          name: p.name,
          imageUrl: p.imageUrl,
          hqStock: 0,
          coupangStock: 0,
          sales14Days: 0,
          sales7Days: 0,
          salesYesterday: 0,
          avgDailySales: 0,
          estimatedSales7d: 0,
          shortage: 0,
          minDaysOfInventory: 9999,
          children: []
        });
      }

      const g = groups.get(p.name)!;
      g.hqStock += p.hqStock;
      g.coupangStock += p.coupangStock;
      g.sales14Days += p.sales14Days;
      g.sales7Days += p.sales7Days;
      g.salesYesterday += p.salesYesterday;
      g.avgDailySales += p.avgDailySales;
      g.estimatedSales7d += estimatedSales7d;
      g.shortage += shortage;
      if (p.daysOfInventory < g.minDaysOfInventory) g.minDaysOfInventory = p.daysOfInventory;

      g.children.push(processedItem);
    });

    return Array.from(groups.values());
  }, [products]);

  const riskItems = useMemo(() => {
    return groupedData
      .filter(g => {
        if (g.coupangStock <= 0) return false;
        if (g.sales7Days <= 0) return false;
        const avgDaily = g.sales7Days / 7;
        const daysLeft = g.coupangStock / avgDaily;
        return daysLeft <= 3;
      })
      .map(g => {
        const avgDaily = g.sales7Days / 7;
        return {
          name: g.name,
          imageUrl: g.imageUrl,
          currentStock: g.coupangStock,
          avgDailySales: avgDaily,
          daysLeft: g.coupangStock / avgDaily
        };
      })
      .sort((a, b) => b.avgDailySales - a.avgDailySales);
  }, [groupedData]);

  // 2. Filter & Sort
  const filteredGroups = useMemo(() => {
    let result = groupedData.filter(g => {
      const matchSearch = g.name.toLowerCase().includes(search.toLowerCase()) ||
        g.children.some(c => c.barcode.includes(search));

      if (showShortageOnly) {
        // Show if group has any shortage OR any child has shortage/warning status
        const hasShortage = g.shortage > 0 || g.children.some(c => c.status !== '양호');
        return matchSearch && hasShortage;
      }
      return matchSearch;
    });

    if (sortConfig) {
      result.sort((a, b) => {
        // @ts-ignore
        const aVal = a[sortConfig.key];
        // @ts-ignore
        const bVal = b[sortConfig.key];

        if (aVal === undefined || bVal === undefined) return 0;
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [groupedData, search, showShortageOnly, sortConfig]);

  const toggleGroup = (name: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(name)) newExpanded.delete(name);
    else newExpanded.add(name);
    setExpandedGroups(newExpanded);
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'desc';
    if ((key === 'minDaysOfInventory' || key === 'shortage') && (!sortConfig || sortConfig.key !== key)) {
      direction = 'asc'; // Default asc for days, but for shortage usually desc is better
      if (key === 'shortage') direction = 'desc';
      if (key === 'minDaysOfInventory') direction = 'asc'; // Lowest days first
    } else if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  // Toast State
  const [toast, setToast] = useState<{ show: boolean, message: string }>({ show: false, message: '' });

  const showToast = (message: string) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: '' }), 2000);
  };

  const handleCopyColumn = (key: string, label: string) => {
    const values = filteredGroups.map(g => {
      // @ts-ignore
      const val = g[key];
      return val !== undefined ? val : '';
    });

    // Header + Values
    const text = values.join('\n');

    navigator.clipboard.writeText(text).then(() => {
      showToast(`${label} 데이터가 복사되었습니다 (${values.length}행)`);
    }).catch(err => {
      console.error('Copy failed', err);
      alert('복사에 실패했습니다.');
    });
  };

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-blue-500" /></div>;

  // Sticky Helpers
  const W_TOGGLE = "w-10 min-w-[2.5rem]";
  const W_IMG = "w-12 min-w-[3rem]";
  const W_NAME = "w-64 min-w-[16rem]";

  const L_TOGGLE = "left-0";
  const L_IMG = "left-[2.5rem]";
  const L_NAME = "left-[5.5rem]"; // 2.5 + 3 = 5.5rem

  return (
    <div className="flex flex-col space-y-4">
      <StockRiskAlert riskItems={riskItems} />
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col relative">
        {/* Toast Notification */}
        {toast.show && (
          <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-opacity duration-300">
            {toast.message}
          </div>
        )}

        {/* Top Bar */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 flex-none">
          <div className="flex items-center space-x-4">
            <h3 className="font-semibold text-gray-800">
              재고 운영 현황
              <span className="text-sm font-normal text-gray-500 ml-2">
                (총 {filteredGroups.length}개 그룹 중 {Math.min(visibleCount, filteredGroups.length)}개 표시)
              </span>
            </h3>
            <button
              onClick={() => setShowShortageOnly(!showShortageOnly)}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${showShortageOnly ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              <Filter size={16} />
              <span>부족상품만 보기</span>
              {showShortageOnly && <CheckCircle2 size={16} className="ml-1" />}
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="상품명, 바코드 검색..."
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 w-64"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto relative">
          <table className="min-w-full text-sm text-left border-separate border-spacing-0">
            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100 sticky top-[60px] z-30 shadow-sm">
              <tr>
                <th className={`px-2 py-3 bg-gray-50 sticky z-30 ${W_TOGGLE} ${L_TOGGLE}`}></th>
                <th className={`px-2 py-3 bg-gray-50 sticky z-30 ${W_IMG} ${L_IMG} text-center whitespace-nowrap`}>이미지</th>
                <th className={`px-4 py-3 bg-gray-50 sticky z-30 ${W_NAME} ${L_NAME} cursor-pointer hover:bg-gray-100 whitespace-nowrap shadow-[4px_0_4px_-4px_rgba(0,0,0,0.1)]`}>
                  <div className="flex items-center justify-between">
                    <span onClick={() => handleSort('name')}>상품명 <ArrowUpDown size={12} className="inline ml-1 opacity-50" /></span>
                    <Copy size={14} className="text-gray-400 hover:text-blue-600 ml-2 cursor-pointer" onClick={(e) => { e.stopPropagation(); handleCopyColumn('name', '상품명'); }} />
                  </div>
                </th>

                <th className="px-4 py-3 text-right bg-blue-50 cursor-pointer hover:bg-blue-100 whitespace-nowrap">
                  <div className="flex items-center justify-end">
                    <span onClick={() => handleSort('hqStock')}>본사재고 <ArrowUpDown size={12} className="inline ml-1 opacity-50" /></span>
                    <Copy size={14} className="text-gray-400 hover:text-blue-600 ml-2 cursor-pointer" onClick={(e) => { e.stopPropagation(); handleCopyColumn('hqStock', '본사재고'); }} />
                  </div>
                </th>
                <th className="px-4 py-3 text-right bg-green-50 cursor-pointer hover:bg-green-100 whitespace-nowrap">
                  <div className="flex items-center justify-end">
                    <span onClick={() => handleSort('coupangStock')}>쿠팡재고 <ArrowUpDown size={12} className="inline ml-1 opacity-50" /></span>
                    <Copy size={14} className="text-gray-400 hover:text-blue-600 ml-2 cursor-pointer" onClick={(e) => { e.stopPropagation(); handleCopyColumn('coupangStock', '쿠팡재고'); }} />
                  </div>
                </th>

                <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100 whitespace-nowrap">
                  <div className="flex items-center justify-end">
                    <span onClick={() => handleSort('sales14Days')}>14일 판매 <ArrowUpDown size={12} className="inline ml-1 opacity-50" /></span>
                    <Copy size={14} className="text-gray-400 hover:text-blue-600 ml-2 cursor-pointer" onClick={(e) => { e.stopPropagation(); handleCopyColumn('sales14Days', '14일 판매'); }} />
                  </div>
                </th>
                <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100 font-bold whitespace-nowrap">
                  <div className="flex items-center justify-end">
                    <span onClick={() => handleSort('sales7Days')}>7일 판매 <ArrowUpDown size={12} className="inline ml-1 opacity-50" /></span>
                    <Copy size={14} className="text-gray-400 hover:text-blue-600 ml-2 cursor-pointer" onClick={(e) => { e.stopPropagation(); handleCopyColumn('sales7Days', '7일 판매'); }} />
                  </div>
                </th>
                <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100 whitespace-nowrap">
                  <div className="flex items-center justify-end">
                    <span onClick={() => handleSort('salesYesterday')}>전일 판매 <ArrowUpDown size={12} className="inline ml-1 opacity-50" /></span>
                    <Copy size={14} className="text-gray-400 hover:text-blue-600 ml-2 cursor-pointer" onClick={(e) => { e.stopPropagation(); handleCopyColumn('salesYesterday', '전일 판매'); }} />
                  </div>
                </th>
                <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100 whitespace-nowrap">
                  <div className="flex items-center justify-end">
                    <span onClick={() => handleSort('avgDailySales')}>일평균 <ArrowUpDown size={12} className="inline ml-1 opacity-50" /></span>
                    <Copy size={14} className="text-gray-400 hover:text-blue-600 ml-2 cursor-pointer" onClick={(e) => { e.stopPropagation(); handleCopyColumn('avgDailySales', '일평균'); }} />
                  </div>
                </th>

                <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100 text-blue-600 whitespace-nowrap">
                  <div className="flex items-center justify-end">
                    <span onClick={() => handleSort('estimatedSales7d')}>예상(7일) <ArrowUpDown size={12} className="inline ml-1 opacity-50" /></span>
                    <Copy size={14} className="text-gray-400 hover:text-blue-600 ml-2 cursor-pointer" onClick={(e) => { e.stopPropagation(); handleCopyColumn('estimatedSales7d', '예상(7일)'); }} />
                  </div>
                </th>
                <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100 text-red-600 whitespace-nowrap">
                  <div className="flex items-center justify-end">
                    <span onClick={() => handleSort('minDaysOfInventory')}>소진 예상 <ArrowUpDown size={12} className="inline ml-1 opacity-50" /></span>
                    <Copy size={14} className="text-gray-400 hover:text-blue-600 ml-2 cursor-pointer" onClick={(e) => { e.stopPropagation(); handleCopyColumn('minDaysOfInventory', '소진 예상'); }} />
                  </div>
                </th>
                <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100 whitespace-nowrap">
                  <div className="flex items-center justify-end">
                    <span onClick={() => handleSort('shortage')}>부족수량 <ArrowUpDown size={12} className="inline ml-1 opacity-50" /></span>
                    <Copy size={14} className="text-gray-400 hover:text-blue-600 ml-2 cursor-pointer" onClick={(e) => { e.stopPropagation(); handleCopyColumn('shortage', '부족수량'); }} />
                  </div>
                </th>
                <th className="px-4 py-3 text-center whitespace-nowrap">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredGroups.slice(0, visibleCount).map((g) => {
                const isExpanded = expandedGroups.has(g.name);
                const stickyBg = isExpanded ? 'bg-blue-50/30' : 'bg-white hover:bg-gray-50';

                // Group Status Logic (Worst case child)
                let groupStatus = '양호';
                let groupStatusColor = 'bg-green-100 text-green-800';
                if (g.children.some(c => c.status === '품절')) { groupStatus = '품절'; groupStatusColor = 'bg-gray-800 text-white'; }
                else if (g.children.some(c => c.status === '위험')) { groupStatus = '위험'; groupStatusColor = 'bg-red-100 text-red-800'; }
                else if (g.children.some(c => c.status === '부족')) { groupStatus = '부족'; groupStatusColor = 'bg-yellow-100 text-yellow-800'; }

                return (
                  <React.Fragment key={g.name}>
                    {/* Group Row */}
                    <tr className={`hover:bg-gray-50/50 transition-colors border-b border-gray-100 group ${isExpanded ? 'bg-blue-50/30' : ''}`} onClick={() => toggleGroup(g.name)}>
                      <td className={`px-2 py-2 text-center sticky z-20 ${W_TOGGLE} ${L_TOGGLE} ${stickyBg} border-b border-gray-100 cursor-pointer`}>
                        {isExpanded ? <ChevronDown size={14} className="text-gray-500 mx-auto" /> : <ChevronRight size={14} className="text-gray-400 mx-auto" />}
                      </td>
                      <td className={`px-2 py-2 text-center sticky z-20 ${W_IMG} ${L_IMG} ${stickyBg} border-b border-gray-100`}>
                        {g.imageUrl ? <img src={g.imageUrl} alt="" className="w-8 h-8 rounded mx-auto object-cover bg-gray-100 border border-gray-200" /> : <div className="w-8 h-8 rounded mx-auto bg-gray-100 border border-gray-200" />}
                      </td>
                      <td className={`px-4 py-2 font-bold text-gray-900 text-sm whitespace-nowrap sticky z-20 shadow-[4px_0_4px_-4px_rgba(0,0,0,0.1)] ${W_NAME} ${L_NAME} ${stickyBg} border-b border-gray-100`}>
                        {g.name}
                        <span className="ml-1 text-xs font-normal text-gray-500">[{g.children.length}]</span>
                      </td>

                      <td className="px-4 py-2 text-right text-gray-900 font-mono bg-blue-50/50 whitespace-nowrap">{g.hqStock.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-gray-900 font-mono bg-green-50/50 font-bold whitespace-nowrap">{g.coupangStock.toLocaleString()}</td>

                      <td className="px-4 py-2 text-right text-gray-500 whitespace-nowrap">{g.sales14Days.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right font-bold text-gray-800 whitespace-nowrap">{g.sales7Days.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-gray-600 whitespace-nowrap">{g.salesYesterday.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-gray-600 whitespace-nowrap">{g.avgDailySales.toFixed(1)}</td>

                      <td className="px-4 py-2 text-right text-blue-600 font-medium whitespace-nowrap">{g.estimatedSales7d.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right font-bold text-red-600 whitespace-nowrap">{g.minDaysOfInventory > 365 ? '1년+' : `${g.minDaysOfInventory}일`}</td>
                      <td className={`px-4 py-2 text-right font-bold whitespace-nowrap ${g.shortage > 0 ? 'text-red-600' : 'text-gray-300'}`}>
                        {g.shortage > 0 ? `-${g.shortage.toLocaleString()}` : '-'}
                      </td>
                      <td className="px-4 py-2 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center justify-center px-2 py-1 rounded text-xs font-bold ${groupStatusColor}`}>
                          {groupStatus}
                        </span>
                      </td>
                    </tr>

                    {/* Children Rows */}
                    {isExpanded && g.children.map(child => (
                      <tr key={child.barcode} className="bg-gray-50 border-b border-gray-100 text-xs">
                        <td className={`sticky z-20 bg-gray-50 ${W_TOGGLE} ${L_TOGGLE}`}></td>
                        <td className={`sticky z-20 bg-gray-50 ${W_IMG} ${L_IMG}`}></td>
                        <td className={`px-4 py-1.5 pl-8 font-mono text-gray-600 whitespace-nowrap sticky z-20 bg-gray-50 shadow-[4px_0_4px_-4px_rgba(0,0,0,0.1)] ${W_NAME} ${L_NAME}`}>
                          └ {child.barcode}
                        </td>

                        <td className="px-4 py-1.5 text-right text-gray-500 whitespace-nowrap">{child.hqStock.toLocaleString()}</td>
                        <td className="px-4 py-1.5 text-right text-gray-500 whitespace-nowrap">{child.coupangStock.toLocaleString()}</td>

                        <td className="px-4 py-1.5 text-right text-gray-400 whitespace-nowrap">{child.sales14Days.toLocaleString()}</td>
                        <td className="px-4 py-1.5 text-right text-gray-600 whitespace-nowrap">{child.sales7Days.toLocaleString()}</td>
                        <td className="px-4 py-1.5 text-right text-gray-400 whitespace-nowrap">{child.salesYesterday.toLocaleString()}</td>
                        <td className="px-4 py-1.5 text-right text-gray-400 whitespace-nowrap">{child.avgDailySales.toFixed(1)}</td>

                        <td className="px-4 py-1.5 text-right text-blue-400 whitespace-nowrap">{child.estimatedSales7d.toLocaleString()}</td>
                        <td className="px-4 py-1.5 text-right text-red-400 whitespace-nowrap">{child.daysOfInventory > 365 ? '1년+' : `${child.daysOfInventory}일`}</td>
                        <td className={`px-4 py-1.5 text-right whitespace-nowrap ${child.shortage > 0 ? 'text-red-500 font-bold' : 'text-gray-300'}`}>
                          {child.shortage > 0 ? `-${child.shortage.toLocaleString()}` : '-'}
                        </td>
                        <td className="px-4 py-1.5 text-center whitespace-nowrap">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] ${child.statusColor}`}>
                            {child.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
              {filteredGroups.length === 0 && (
                <tr><td colSpan={13} className="px-6 py-10 text-center text-gray-400 bg-white">
                  {showShortageOnly ? "부족한 상품이 없습니다. (필터를 해제해보세요)" : "데이터가 없습니다."}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        {visibleCount < filteredGroups.length && (
          <div className="flex justify-center py-4 bg-gray-50 border-t border-gray-200 flex-none">
            <button onClick={() => setVisibleCount(prev => prev + 50)} className="px-8 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              더 보기 (+50) <span className="ml-2 text-gray-400 text-xs">({visibleCount} / {filteredGroups.length})</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
