import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import type { ProductStats } from '../lib/api';
import { Search, ArrowUpDown, Loader2, ChevronRight, ChevronDown } from 'lucide-react';

interface GroupedProduct {
  name: string;
  season: string;
  imageUrl?: string;
  totalSales: number;
  currentStock: number; // Coupang Stock
  hqStock: number;      // HQ Stock
  dailySales: Record<string, number>;
  children: ProductStats[];
}

export default function ProductStatus() {
  const [products, setProducts] = useState<ProductStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'totalSales', direction: 'desc' });
  const [selectedSeason, setSelectedSeason] = useState('all');

  // Column Widths State (Removed)

  const [visibleCount, setVisibleCount] = useState(50);

  // Persistence Effects - Keep sort only
  useEffect(() => {
    localStorage.setItem('productStatus_sortHelper', JSON.stringify(sortConfig));
  }, [sortConfig]);

  useEffect(() => {
    setVisibleCount(50);
  }, [search, sortConfig]);

  useEffect(() => {
    loadData();
  }, []);

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

  // Group products by name
  const groupedProducts: GroupedProduct[] = useMemo(() => {
    const groups = new Map<string, GroupedProduct>();

    products.forEach(p => {
      const existing = groups.get(p.name);
      if (existing) {
        existing.totalSales += p.totalSales;
        existing.currentStock += p.coupangStock; // coupangStock alias
        existing.hqStock += p.hqStock;

        // Aggregate daily sales
        Object.entries(p.dailySales).forEach(([date, qty]) => {
          existing.dailySales[date] = (existing.dailySales[date] || 0) + qty;
        });

        existing.children.push(p);
      } else {
        groups.set(p.name, {
          name: p.name,
          season: p.season,
          imageUrl: p.imageUrl,
          totalSales: p.totalSales,
          currentStock: p.coupangStock,
          hqStock: p.hqStock,
          dailySales: { ...p.dailySales },
          children: [p]
        });
      }
    });

    return Array.from(groups.values());
  }, [products]);

  const uniqueSeasons = useMemo(() => {
    const seasons = new Set<string>();
    groupedProducts.forEach(p => {
      if (p.season && p.season !== '정보없음' && p.season.trim() !== '') {
        seasons.add(p.season);
      }
    });
    return Array.from(seasons).sort();
  }, [groupedProducts]);

  // Extract all unique dates from products for dynamic columns, sorted
  const uniqueDates = useMemo(() => {
    const dates = new Set<string>();
    products.forEach(p => Object.keys(p.dailySales).forEach(d => dates.add(d)));
    return Array.from(dates).sort();
  }, [products]);

  const filteredGroups = groupedProducts.filter(g => {
    const matchSeason = selectedSeason === 'all' || g.season === selectedSeason;
    const matchSearch = g.name.toLowerCase().includes(search.toLowerCase()) ||
      g.children.some(c => c.barcode.includes(search)) ||
      g.season.includes(search);
    return matchSeason && matchSearch;
  }).sort((a, b) => {
    if (!sortConfig) return 0;
    const key = sortConfig.key;

    // Check if sorting by dynamic date
    if (uniqueDates.includes(key)) {
      const aVal = a.dailySales[key] || 0;
      const bVal = b.dailySales[key] || 0;
      return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
    }

    // Standard columns
    const aValue = a[key as keyof GroupedProduct];
    const bValue = b[key as keyof GroupedProduct];

    if (aValue === undefined || bValue === undefined) return 0;

    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'desc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const toggleGroup = (name: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(name)) {
      newExpanded.delete(name);
    } else {
      newExpanded.add(name);
    }
    setExpandedGroups(newExpanded);
  };

  // Helper for Date Header (M/D)
  const formatDateHeader = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
    return dateStr;
  };

  // Calculate Totals
  const totalStats = useMemo(() => {
    const stats = {
      hqStock: 0,
      currentStock: 0,
      totalSales: 0,
      dailySales: {} as Record<string, number>
    };
    filteredGroups.forEach(g => {
      stats.hqStock += g.hqStock;
      stats.currentStock += g.currentStock;
      stats.totalSales += g.totalSales;
      Object.entries(g.dailySales).forEach(([date, qty]) => {
        stats.dailySales[date] = (stats.dailySales[date] || 0) + qty;
      });
    });
    return stats;
  }, [filteredGroups]);

  // Constants for Sticky Columns
  const W_TOGGLE = 'w-10 min-w-[2.5rem]';
  const W_IMAGE = 'w-12 min-w-[3rem]';
  const W_SEASON = 'w-24 min-w-[6rem]';
  const W_NAME = 'w-64 min-w-[16rem]'; // Extended for readability

  // Left Offsets (Tailwind arbitrary values)
  const L_TOGGLE = 'left-0';
  const L_IMAGE = 'left-[2.5rem]';
  const L_SEASON = 'left-[5.5rem]';
  const L_NAME = 'left-[11.5rem]';

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-blue-500" /></div>;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col h-[calc(100vh-100px)]">
      {/* Top Bar */}
      <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 flex-none">
        <h3 className="font-semibold text-gray-800">
          상품별 판매 현황
          <span className="text-sm font-normal text-gray-500 ml-2">
            (총 {filteredGroups.length}개 중 {Math.min(visibleCount, filteredGroups.length)}개 표시)
          </span>
        </h3>
        <div className="flex items-center space-x-3">
          <select
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 bg-white min-w-[120px]"
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(e.target.value)}
          >
            <option value="all">전체 시즌</option>
            {uniqueSeasons.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="상품명, 바코드, 시즌 검색..."
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 w-64"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Table Container - Auto Layout with Sticky Columns */}
      <div className="overflow-auto flex-1 relative">
        <table className="min-w-full text-sm text-left border-collapse table-auto">
          <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100 sticky top-0 z-30 shadow-sm">
            <tr className="h-[50px]">
              <th className={`px-2 py-3 bg-gray-50 sticky z-30 ${W_TOGGLE} ${L_TOGGLE}`}></th>
              <th className={`px-2 py-3 hover:bg-gray-100 cursor-pointer select-none whitespace-nowrap bg-gray-50 sticky z-30 ${W_IMAGE} ${L_IMAGE}`} onClick={() => handleSort('imageUrl')}>이미지</th>
              <th className={`px-4 py-3 hover:bg-gray-100 cursor-pointer select-none whitespace-nowrap bg-gray-50 sticky z-30 ${W_SEASON} ${L_SEASON}`} onClick={() => handleSort('season')}>시즌 <ArrowUpDown size={12} className="inline ml-1 opacity-50" /></th>
              <th className={`px-4 py-3 hover:bg-gray-100 cursor-pointer select-none whitespace-nowrap bg-gray-50 sticky z-30 shadow-[4px_0_4px_-4px_rgba(0,0,0,0.1)] ${W_NAME} ${L_NAME}`} onClick={() => handleSort('name')}>상품명 <ArrowUpDown size={12} className="inline ml-1 opacity-50" /></th>

              <th className="px-4 py-3 hover:bg-gray-100 cursor-pointer text-right bg-blue-50 select-none whitespace-nowrap" onClick={() => handleSort('hqStock')}>본사재고 <ArrowUpDown size={12} className="inline ml-1 opacity-50" /></th>
              <th className="px-4 py-3 hover:bg-gray-100 cursor-pointer text-right bg-green-50 select-none whitespace-nowrap" onClick={() => handleSort('currentStock')}>쿠팡재고 <ArrowUpDown size={12} className="inline ml-1 opacity-50" /></th>
              <th className="px-4 py-3 hover:bg-gray-100 cursor-pointer text-right font-bold select-none whitespace-nowrap bg-gray-50" onClick={() => handleSort('totalSales')}>누적판매 <ArrowUpDown size={12} className="inline ml-1 opacity-50" /></th>
              {uniqueDates.map(date => (
                <th key={date} className="px-2 py-3 hover:bg-gray-100 cursor-pointer text-center whitespace-nowrap bg-gray-50 group min-w-[50px]" onClick={() => handleSort(date)}>
                  {formatDateHeader(date)}
                </th>
              ))}
            </tr>
            {/* Total Row */}
            <tr className="bg-gray-100 font-bold border-b border-gray-200">
              <th className={`px-2 py-2 sticky z-30 bg-gray-100 ${W_TOGGLE} ${L_TOGGLE}`}></th>
              <th className={`px-2 py-2 sticky z-30 bg-gray-100 ${W_IMAGE} ${L_IMAGE}`}></th>
              <th className={`px-2 py-2 sticky z-30 bg-gray-100 ${W_SEASON} ${L_SEASON}`}></th>
              <th className={`px-4 py-2 sticky z-30 bg-gray-100 text-center shadow-[4px_0_4px_-4px_rgba(0,0,0,0.1)] ${W_NAME} ${L_NAME}`}>합계</th>

              <th className="px-4 py-2 text-right bg-blue-100">{totalStats.hqStock.toLocaleString()}</th>
              <th className="px-4 py-2 text-right bg-green-100">{totalStats.currentStock.toLocaleString()}</th>
              <th className="px-4 py-2 text-right bg-gray-100">{totalStats.totalSales.toLocaleString()}</th>
              {uniqueDates.map(date => (
                <th key={date} className="px-2 py-2 text-center text-xs bg-gray-100">
                  {totalStats.dailySales[date]?.toLocaleString() || '-'}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredGroups.slice(0, visibleCount).map((group) => {
              const isExpanded = expandedGroups.has(group.name);
              // Dynamic BG for sticky columns based on state
              const stickyBg = isExpanded ? 'bg-[#ecf3ff]' : 'bg-white hover:bg-gray-50'; // Match row hover/active

              return (
                <React.Fragment key={group.name}>
                  {/* Group Row */}
                  <tr className={`hover:bg-gray-50/50 transition-colors cursor-pointer border-b border-gray-100 group ${isExpanded ? 'bg-blue-50/30' : ''}`} onClick={() => toggleGroup(group.name)}>
                    <td className={`px-2 py-2 text-center sticky z-20 ${W_TOGGLE} ${L_TOGGLE} ${stickyBg} border-b border-gray-100`}>
                      {isExpanded ? <ChevronDown size={14} className="text-gray-500 mx-auto" /> : <ChevronRight size={14} className="text-gray-400 mx-auto" />}
                    </td>
                    <td className={`px-2 py-2 text-center sticky z-20 ${W_IMAGE} ${L_IMAGE} ${stickyBg} border-b border-gray-100`}>
                      {group.imageUrl ? <img src={group.imageUrl} alt="" className="w-8 h-8 rounded mx-auto object-cover bg-gray-100 border border-gray-200" /> : <div className="w-8 h-8 rounded mx-auto bg-gray-100 border border-gray-200" />}
                    </td>
                    <td className={`px-4 py-2 text-gray-500 text-xs truncate sticky z-20 ${W_SEASON} ${L_SEASON} ${stickyBg} border-b border-gray-100`}>{group.season}</td>
                    <td className={`px-4 py-2 font-bold text-gray-900 text-sm whitespace-nowrap sticky z-20 shadow-[4px_0_4px_-4px_rgba(0,0,0,0.1)] ${W_NAME} ${L_NAME} ${stickyBg} border-b border-gray-100`}>
                      {group.name}
                      <span className="ml-1 text-xs font-normal text-gray-500">[{group.children.length}]</span>
                    </td>

                    <td className="px-4 py-2 text-right text-gray-900 font-mono bg-blue-50 whitespace-nowrap">{group.hqStock.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-gray-900 font-mono bg-green-50 whitespace-nowrap">{group.currentStock.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right font-bold text-blue-600 font-mono whitespace-nowrap">{group.totalSales.toLocaleString()}</td>
                    {uniqueDates.map(date => (
                      <td key={date} className={`px-2 py-2 text-center text-xs min-w-[50px] ${group.dailySales[date] ? 'font-bold text-gray-900' : 'text-gray-300'}`}>
                        {group.dailySales[date] || '-'}
                      </td>
                    ))}
                  </tr>
                  {/* Child Rows */}
                  {isExpanded && group.children.map(child => (
                    <tr key={child.barcode} className="bg-gray-50 border-b border-gray-100 text-xs">
                      {/* Separate sticky cells for child row to maintain layout */}
                      <td className={`px-2 py-1 sticky z-20 bg-gray-50 border-b border-gray-100 ${W_TOGGLE} ${L_TOGGLE}`}></td>
                      <td className={`px-2 py-1 sticky z-20 bg-gray-50 border-b border-gray-100 ${W_IMAGE} ${L_IMAGE}`}></td>
                      <td className={`px-4 py-1 text-gray-400 text-center sticky z-20 bg-gray-50 border-b border-gray-100 ${W_SEASON} ${L_SEASON}`}>-</td>
                      <td className={`px-4 py-1 text-gray-600 pl-8 font-mono whitespace-nowrap sticky z-20 bg-gray-50 border-b border-gray-100 shadow-[4px_0_4px_-4px_rgba(0,0,0,0.1)] ${W_NAME} ${L_NAME}`}>
                        {child.barcode}
                      </td>

                      <td className="px-4 py-1 text-right text-gray-500 whitespace-nowrap">{child.hqStock.toLocaleString()}</td>
                      <td className="px-4 py-1 text-right text-gray-500 whitespace-nowrap">{child.coupangStock.toLocaleString()}</td>
                      <td className="px-4 py-1 text-right text-gray-600 font-medium whitespace-nowrap">{child.totalSales.toLocaleString()}</td>
                      {uniqueDates.map(date => (
                        <td key={date} className={`px-2 py-1 text-center min-w-[50px] ${child.dailySales[date] ? 'text-gray-700' : 'text-gray-200'}`}>
                          {child.dailySales[date] || '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
            {filteredGroups.length === 0 && (
              <tr><td colSpan={7 + uniqueDates.length} className="px-6 py-10 text-center text-gray-400">데이터가 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {visibleCount < filteredGroups.length && (
        <div className="flex justify-center py-4 bg-gray-50 border-t border-gray-200">
          <button onClick={() => setVisibleCount(prev => prev + 50)} className="px-8 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            더 보기 (+50) <span className="ml-2 text-gray-400 text-xs">({visibleCount} / {filteredGroups.length})</span>
          </button>
        </div>
      )}
    </div>
  );
}
