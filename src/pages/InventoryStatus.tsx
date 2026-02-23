import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../lib/api';
import type { ProductStats } from '../lib/api';
import { Search, ArrowUpDown, Loader2, ChevronRight, ChevronDown, Copy } from 'lucide-react';


interface InventoryGroup {
  name: string;
  imageUrl?: string;
  hqStock: number;
  coupangStock: number;
  sales14Days: number;
  sales7Days: number;
  prevSales7Days: number; // sales 8-14 days ago
  trend: 'up' | 'down' | 'flat';
  minDaysOfInventory: number; // Worst case in group
  children: (ProductStats & {
    prevSales7Days: number;
    trend: 'hot' | 'cold' | 'up' | 'down' | 'flat';
    status: string;
    statusColor: string
  })[];
}

export default function InventoryStatus() {
  const [products, setProducts] = useState<ProductStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'minDaysOfInventory', direction: 'asc' });
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(20);

  useEffect(() => {
    loadData();
  }, []);

  // Reset pagination when search/filter/sort changes
  useEffect(() => {
    setVisibleCount(20);
  }, [search, sortConfig]);

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
      // Metrics
      const prevSales7Days = p.sales14Days - p.sales7Days;

      // Trend Logic
      let trend: 'up' | 'down' | 'flat' = 'flat';
      const diff = p.sales7Days - prevSales7Days;
      if (diff > 0) trend = 'up';
      else if (diff < 0) trend = 'down';

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

      const processedItem = { ...p, prevSales7Days, trend, status, statusColor };

      if (!groups.has(p.name)) {
        groups.set(p.name, {
          name: p.name,
          imageUrl: p.imageUrl,
          hqStock: 0,
          coupangStock: 0,
          sales14Days: 0,
          sales7Days: 0,
          prevSales7Days: 0,
          trend: 'flat',
          minDaysOfInventory: 9999,
          children: []
        });
      }

      const g = groups.get(p.name)!;
      g.hqStock += p.hqStock;
      g.coupangStock += p.coupangStock;
      g.sales14Days += p.sales14Days;
      g.sales7Days += p.sales7Days;
      g.prevSales7Days += prevSales7Days;

      if (p.daysOfInventory < g.minDaysOfInventory) g.minDaysOfInventory = p.daysOfInventory;

      g.children.push(processedItem);
    });

    // Calculate Group Trend
    for (const g of groups.values()) {
      const diff = g.sales7Days - g.prevSales7Days;
      if (diff > 0) g.trend = 'up';
      else if (diff < 0) g.trend = 'down';
      else g.trend = 'flat';
    }

    return Array.from(groups.values());
  }, [products]);

  // 2. Filter & Sort
  const filteredGroups = useMemo(() => {
    let result = groupedData.filter(g => {
      const matchSearch = g.name.toLowerCase().includes(search.toLowerCase()) ||
        g.children.some(c => c.barcode.includes(search));

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

    return result.map(g => ({
      ...g,
      children: g.children.sort((a, b) => a.barcode.localeCompare(b.barcode))
    }));
  }, [groupedData, search, sortConfig]);

  const toggleGroup = (name: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(name)) newExpanded.delete(name);
    else newExpanded.add(name);
    setExpandedGroups(newExpanded);
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'desc';
    if ((key === 'minDaysOfInventory') && (!sortConfig || sortConfig.key !== key)) {
      direction = 'asc'; // Default asc for days
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
      {/* Alert Banner Removed */}
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
            <h3 className="font-semibold text-gray-800 flex items-center">
              재고 흐름 모니터링
              <span className="text-sm font-normal text-gray-500 ml-2">
                (상위 {visibleCount}개 / 전체 {filteredGroups.length}개)
              </span>
            </h3>
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

        <div className="overflow-auto relative max-h-[calc(100vh-200px)]">
          <table className="min-w-full text-sm text-left border-separate border-spacing-0">
            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100 sticky top-0 z-30 shadow-sm">
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
                  </div>
                </th>
                <th className="px-4 py-3 text-right bg-green-50 cursor-pointer hover:bg-green-100 whitespace-nowrap">
                  <div className="flex items-center justify-end">
                    <span onClick={() => handleSort('coupangStock')}>쿠팡재고 <ArrowUpDown size={12} className="inline ml-1 opacity-50" /></span>
                  </div>
                </th>

                <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100 font-bold whitespace-nowrap">
                  <div className="flex items-center justify-end">
                    <span onClick={() => handleSort('sales7Days')}>7일 판매 <ArrowUpDown size={12} className="inline ml-1 opacity-50" /></span>
                  </div>
                </th>

                <th className="px-4 py-3 text-center cursor-pointer hover:bg-gray-100 whitespace-nowrap">
                  <div className="flex items-center justify-center">
                    <span onClick={() => handleSort('trend')}>주간 추세 <ArrowUpDown size={12} className="inline ml-1 opacity-50" /></span>
                  </div>
                </th>

                <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100 text-red-600 whitespace-nowrap">
                  <div className="flex items-center justify-end">
                    <span onClick={() => handleSort('minDaysOfInventory')}>소진 예상 <ArrowUpDown size={12} className="inline ml-1 opacity-50" /></span>
                    <Copy size={14} className="text-gray-400 hover:text-blue-600 ml-2 cursor-pointer" onClick={(e) => { e.stopPropagation(); handleCopyColumn('minDaysOfInventory', '소진 예상'); }} />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredGroups.slice(0, visibleCount).map((g) => {
                const isExpanded = expandedGroups.has(g.name);
                const stickyBg = isExpanded ? 'bg-blue-50/30' : 'bg-white hover:bg-gray-50';

                // Trend Icon
                let TrendIcon = <span className="text-gray-400">-</span>;
                if (g.trend === 'up') TrendIcon = <span className="text-red-500 font-bold flex items-center justify-center">▲ 증가</span>;
                else if (g.trend === 'down') TrendIcon = <span className="text-blue-500 flex items-center justify-center">▼ 감소</span>;

                // Burn Rate Badge
                let BurnRateBadge = (
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                    3달+
                  </span>
                );
                if (g.minDaysOfInventory <= 7) {
                  BurnRateBadge = <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-red-100 text-red-700 animate-pulse">D-{Math.floor(g.minDaysOfInventory)}</span>;
                } else if (g.minDaysOfInventory <= 14) {
                  BurnRateBadge = <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-orange-100 text-orange-800">2주 이내</span>;
                } else if (g.minDaysOfInventory <= 30) {
                  BurnRateBadge = <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">1달 이내</span>;
                } else if (g.minDaysOfInventory <= 90) {
                  BurnRateBadge = <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">3달 이내</span>;
                }

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

                      <td className="px-4 py-2 text-right font-bold text-gray-800 whitespace-nowrap">{g.sales7Days.toLocaleString()}</td>

                      <td className="px-4 py-2 text-center text-xs whitespace-nowrap">
                        {TrendIcon}
                      </td>

                      <td className="px-4 py-2 text-center whitespace-nowrap">
                        {BurnRateBadge}
                      </td>
                    </tr>

                    {/* Children Rows */}
                    {isExpanded && g.children.map(child => {
                      let ChildTrend = <span className="text-gray-300">-</span>;
                      if (child.trend === 'hot') ChildTrend = <span className="text-red-500 font-bold text-[10px]">🔥 급상승</span>;
                      else if (child.trend === 'cold') ChildTrend = <span className="text-blue-500 font-bold text-[10px]">❄️ 급하락</span>;
                      else if (child.trend === 'up') ChildTrend = <span className="text-red-400 text-[10px]">▲ 상승</span>;
                      else if (child.trend === 'down') ChildTrend = <span className="text-blue-400 text-[10px]">▼ 하락</span>;

                      return (
                        <tr key={child.barcode} className="bg-gray-50 border-b border-gray-100 text-xs">
                          <td className={`sticky z-20 bg-gray-50 ${W_TOGGLE} ${L_TOGGLE}`}></td>
                          <td className={`sticky z-20 bg-gray-50 ${W_IMG} ${L_IMG}`}></td>
                          <td className={`px-4 py-1.5 pl-8 text-xs whitespace-nowrap sticky z-20 bg-gray-50 shadow-[4px_0_4px_-4px_rgba(0,0,0,0.1)] ${W_NAME} ${L_NAME}`}>
                            <div className="flex flex-col">
                              <span className="font-mono text-gray-400">{child.barcode}</span>
                              <span className="text-gray-600 font-medium">{child.option || '-'}</span>
                            </div>
                          </td>

                          <td className="px-4 py-1.5 text-right text-gray-500 whitespace-nowrap">{child.hqStock.toLocaleString()}</td>
                          <td className="px-4 py-1.5 text-right text-gray-500 whitespace-nowrap">{child.coupangStock.toLocaleString()}</td>

                          <td className="px-4 py-1.5 text-right text-gray-600 whitespace-nowrap">{child.sales7Days.toLocaleString()}</td>

                          <td className="px-4 py-1.5 text-center whitespace-nowrap">
                            {ChildTrend}
                          </td>

                          <td className="px-4 py-1.5 text-right text-red-400 whitespace-nowrap">{child.daysOfInventory > 365 ? '1년+' : `${child.daysOfInventory.toFixed(1)}일`}</td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
              {filteredGroups.length === 0 && (
                <tr><td colSpan={8} className="px-6 py-10 text-center text-gray-400 bg-white">
                  데이터가 없습니다.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        {visibleCount < filteredGroups.length && (
          <div className="flex justify-center py-4 bg-gray-50 border-t border-gray-200 flex-none">
            <button onClick={() => setVisibleCount(prev => prev + 20)} className="px-8 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              더 보기 (+20) <span className="ml-2 text-gray-400 text-xs">({visibleCount} / {filteredGroups.length})</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
