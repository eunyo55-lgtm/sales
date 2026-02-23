import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import type { ProductStats } from '../lib/api';
import { Search, ArrowUpDown, Loader2, ChevronRight, ChevronDown, HelpCircle } from 'lucide-react';
import { isRedDay } from '../lib/dateUtils';

interface GroupedProduct {
  name: string;
  season: string;
  imageUrl?: string;
  totalSales: number;
  sales7Days: number;
  currentStock: number; // Coupang Stock
  hqStock: number;      // HQ Stock
  dailySales: Record<string, number>;
  abcGrade: 'A' | 'B' | 'C' | 'D'; // Representative grade (usually max of children or recalculated)
  children: ProductStats[];
}

export default function ProductStatus() {
  const [products, setProducts] = useState<ProductStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'totalSales', direction: 'desc' });
  const [selectedSeason, setSelectedSeason] = useState('all');
  const [selectedGrade, setSelectedGrade] = useState('all'); // ABC Filter

  const [visibleCount, setVisibleCount] = useState(20);

  useEffect(() => {
    localStorage.setItem('productStatus_sortHelper', JSON.stringify(sortConfig));
  }, [sortConfig]);

  useEffect(() => {
    setVisibleCount(20);
  }, [search, sortConfig, selectedSeason, selectedGrade]);

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

  const groupedProducts: GroupedProduct[] = useMemo(() => {
    const groups = new Map<string, GroupedProduct>();

    products.forEach(p => {
      const existing = groups.get(p.name);
      if (existing) {
        existing.totalSales += p.totalSales;
        existing.sales7Days += p.sales7Days;
        existing.currentStock += p.coupangStock;
        existing.hqStock += p.hqStock;

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
          sales7Days: p.sales7Days,
          currentStock: p.coupangStock,
          hqStock: p.hqStock,
          dailySales: { ...p.dailySales },
          abcGrade: p.abcGrade,
          children: [p]
        });
      }
    });

    // Re-evaluate Group ABC Grade (Take the best grade from children or calculate based on group total)
    // Here we simply take the grade of the group leader (first item) or re-logic.
    // Better: Re-calculate per group? No, individual item grade is more important.
    // Let's assume the group grade is the grade of the main item (usually same barocde logic).
    // Or just use 'A' if any child is 'A'.

    // Simple logic: Group inherits the best grade (A < B < C < D)
    for (const g of groups.values()) {
      if (g.children.some(c => c.abcGrade === 'A')) g.abcGrade = 'A';
      else if (g.children.some(c => c.abcGrade === 'B')) g.abcGrade = 'B';
      else if (g.children.some(c => c.abcGrade === 'C')) g.abcGrade = 'C';
      else g.abcGrade = 'D';
    }

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

  const uniqueDates = useMemo(() => {
    const dates = new Set<string>();
    products.forEach(p => Object.keys(p.dailySales).forEach(d => dates.add(d)));
    return Array.from(dates).sort();
  }, [products]);

  const filteredGroups = groupedProducts.filter(g => {
    const matchSeason = selectedSeason === 'all' || g.season === selectedSeason;
    const matchGrade = selectedGrade === 'all' || g.abcGrade === selectedGrade;
    const matchSearch = g.name.toLowerCase().includes(search.toLowerCase()) ||
      g.children.some(c => c.barcode.includes(search)) ||
      g.season.includes(search);
    return matchSeason && matchGrade && matchSearch;
  }).sort((a, b) => {
    if (!sortConfig) return 0;
    const key = sortConfig.key;

    if (uniqueDates.includes(key)) {
      const aVal = a.dailySales[key] || 0;
      const bVal = b.dailySales[key] || 0;
      return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
    }

    const aValue = a[key as keyof GroupedProduct];
    const bValue = b[key as keyof GroupedProduct];

    if (aValue === undefined || bValue === undefined) return 0;

    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  }).map(g => ({
    ...g,
    children: g.children.sort((a, b) => a.barcode.localeCompare(b.barcode))
  }));

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

  const formatDateHeader = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
    return dateStr;
  };

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

  const W_TOGGLE = "w-10 min-w-[2.5rem]";
  const W_IMAGE = "w-12 min-w-[3rem]";
  const W_SEASON = 'w-24 min-w-[6rem]';
  const W_TREND = "w-20 min-w-[5rem]";
  const W_NAME = "w-64 min-w-[16rem]";

  const L_TOGGLE = "left-0";
  const L_IMAGE = "left-[2.5rem]";
  const L_SEASON = 'left-[5.5rem]';
  const L_TREND = 'left-[11.5rem]';
  const L_NAME = 'left-[16.5rem]';

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-blue-500" /></div>;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col relative">
      <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 flex-none">
        <h3 className="font-semibold text-gray-800">
          상품별 판매 현황 (20개씩 보기)
          <span className="text-sm font-normal text-gray-500 ml-2">
            (총 {filteredGroups.length}개 중 {Math.min(visibleCount, filteredGroups.length)}개 표시)
          </span>
          <div className="group relative ml-2 inline-flex items-center top-0.5">
            <HelpCircle size={16} className="text-gray-400 hover:text-gray-600 cursor-help" />
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-64 p-3 bg-gray-800 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none">
              <div className="font-bold mb-2 pb-1 border-b border-gray-600">ABC 등급 기준 (판매량 상위 %)</div>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="font-bold text-red-300">A등급</span>
                  <span>상위 0% ~ 10%</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-orange-300">B등급</span>
                  <span>상위 10% ~ 30%</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-yellow-300">C등급</span>
                  <span>상위 30% ~ 70%</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-gray-300">D등급</span>
                  <span>상위 70% ~ 100% (또는 0)</span>
                </div>
              </div>
              {/* Triangle Pointer */}
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-800 rotate-45"></div>
            </div>
          </div>
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
          <select
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 bg-white min-w-[100px]"
            value={selectedGrade}
            onChange={(e) => setSelectedGrade(e.target.value)}
          >
            <option value="all">전체 등급</option>
            <option value="A">A등급 (상위 20%)</option>
            <option value="B">B등급 (20~50%)</option>
            <option value="C">C등급 (50~100%)</option>
            <option value="D">D등급 (판매 0)</option>
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

      <div className="overflow-auto flex-1 relative max-h-[calc(100vh-240px)]">
        <table className="min-w-full text-sm text-left border-separate border-spacing-0 table-auto">
          <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100 sticky top-0 z-40 shadow-sm">
            <tr className="h-[50px] relative z-40">
              <th className={`px-2 py-3 bg-gray-50 sticky z-40 ${W_TOGGLE} ${L_TOGGLE}`}></th>
              <th className={`px-2 py-3 hover:bg-gray-100 cursor-pointer select-none whitespace-nowrap bg-gray-50 sticky z-40 ${W_IMAGE} ${L_IMAGE}`} onClick={() => handleSort('imageUrl')}>이미지</th>
              <th className={`px-4 py-3 hover:bg-gray-100 cursor-pointer select-none whitespace-nowrap bg-gray-50 sticky z-40 ${W_SEASON} ${L_SEASON}`} onClick={() => handleSort('season')}>시즌 <ArrowUpDown size={12} className="inline ml-1 opacity-50" /></th>
              <th className={`px-4 py-3 hover:bg-gray-100 cursor-pointer select-none whitespace-nowrap bg-gray-50 sticky z-40 ${W_TREND} ${L_TREND}`} onClick={() => handleSort('trend')}>
                <div className="flex items-center">
                  트렌드 <ArrowUpDown size={12} className="inline ml-1 opacity-50" />
                  <div className="group relative ml-1" onClick={(e) => e.stopPropagation()}>
                    <HelpCircle size={14} className="text-gray-400 hover:text-gray-600 cursor-help" />
                    <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-80 p-3 bg-gray-800 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none">
                      <div className="font-bold mb-2 pb-1 border-b border-gray-600">트렌드 아이콘 기준</div>
                      <div className="space-y-2">
                        <div className="flex items-start">
                          <span className="text-lg mr-2 shrink-0">🔥</span>
                          <div>
                            <div className="font-bold text-red-300 mb-0.5">급상승 (HOT)</div>
                            <div className="text-gray-300 leading-tight">
                              최근 7일 판매량이 전주 대비 <span className="text-white font-bold">50% 이상 증가</span>
                              <br /><span className="text-gray-400 text-[10px]">(단, 최근 7일간 10개 이상 판매된 상품)</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-start">
                          <span className="text-lg mr-2 shrink-0">❄️</span>
                          <div>
                            <div className="font-bold text-blue-300 mb-0.5">급하락 (COLD)</div>
                            <div className="text-gray-300 leading-tight">
                              최근 7일 판매량이 전주 대비 <span className="text-white font-bold">50% 이상 감소</span>
                              <br /><span className="text-gray-400 text-[10px]">(단, 직전 7일간 10개 이상 판매된 상품)</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      {/* Triangle Pointer */}
                      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-800 rotate-45"></div>
                    </div>
                  </div>
                </div>
              </th>
              <th className={`px-4 py-3 hover:bg-gray-100 cursor-pointer select-none whitespace-nowrap bg-gray-50 sticky z-40 shadow-[4px_0_4px_-4px_rgba(0,0,0,0.1)] ${W_NAME} ${L_NAME}`} onClick={() => handleSort('name')}>상품명 <ArrowUpDown size={12} className="inline ml-1 opacity-50" /></th>

              <th className="px-4 py-3 hover:bg-gray-100 cursor-pointer text-right bg-blue-50 select-none whitespace-nowrap" onClick={() => handleSort('hqStock')}>본사재고 <ArrowUpDown size={12} className="inline ml-1 opacity-50" /></th>
              <th className="px-4 py-3 hover:bg-gray-100 cursor-pointer text-right bg-green-50 select-none whitespace-nowrap" onClick={() => handleSort('currentStock')}>쿠팡재고 <ArrowUpDown size={12} className="inline ml-1 opacity-50" /></th>
              <th className="px-4 py-3 hover:bg-gray-100 cursor-pointer text-right font-bold select-none whitespace-nowrap bg-gray-50" onClick={() => handleSort('totalSales')}>누적판매 <ArrowUpDown size={12} className="inline ml-1 opacity-50" /></th>
              {uniqueDates.map(date => (
                <th key={date} className={`px-2 py-3 hover:bg-gray-100 cursor-pointer text-center whitespace-nowrap bg-gray-50 group min-w-[50px] ${isRedDay(date) ? 'text-red-600' : ''}`} onClick={() => handleSort(date)}>
                  {formatDateHeader(date)}
                </th>
              ))}
            </tr>
            <tr className="bg-gray-100 font-bold border-b border-gray-200">
              <th className={`px-2 py-2 sticky z-30 bg-gray-100 ${W_TOGGLE} ${L_TOGGLE}`}></th>
              <th className={`px-2 py-2 sticky z-30 bg-gray-100 ${W_IMAGE} ${L_IMAGE}`}></th>
              <th className={`px-2 py-2 sticky z-30 bg-gray-100 ${W_SEASON} ${L_SEASON}`}></th>
              <th className={`px-2 py-2 sticky z-30 bg-gray-100 ${W_TREND} ${L_TREND}`}></th>
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
              const stickyBg = isExpanded ? 'bg-[#ecf3ff]' : 'bg-white hover:bg-gray-50';

              return (
                <React.Fragment key={group.name}>
                  <tr className={`hover:bg-gray-50/50 transition-colors cursor-pointer border-b border-gray-100 group ${isExpanded ? 'bg-blue-50/30' : ''}`} onClick={() => toggleGroup(group.name)}>
                    <td className={`px-2 py-2 text-center sticky z-20 ${W_TOGGLE} ${L_TOGGLE} ${stickyBg} border-b border-gray-100`}>
                      {isExpanded ? <ChevronDown size={14} className="text-gray-500 mx-auto" /> : <ChevronRight size={14} className="text-gray-400 mx-auto" />}
                    </td>
                    <td className={`px-2 py-2 text-center sticky z-20 ${W_IMAGE} ${L_IMAGE} ${stickyBg} border-b border-gray-100`}>
                      {group.imageUrl ? <img src={group.imageUrl} alt="" className="w-8 h-8 rounded mx-auto object-cover bg-gray-100 border border-gray-200" /> : <div className="w-8 h-8 rounded mx-auto bg-gray-100 border border-gray-200" />}
                    </td>
                    <td className={`px-4 py-2 text-gray-500 text-xs truncate sticky z-20 ${W_SEASON} ${L_SEASON} ${stickyBg} border-b border-gray-100`}>{group.season}</td>
                    <td className={`px-4 py-2 text-gray-500 text-xs truncate sticky z-20 ${W_TREND} ${L_TREND} ${stickyBg} border-b border-gray-100`}>-</td>
                    <td className={`px-4 py-2 font-bold text-gray-900 text-sm whitespace-nowrap sticky z-20 shadow-[4px_0_4px_-4px_rgba(0,0,0,0.1)] ${W_NAME} ${L_NAME} ${stickyBg} border-b border-gray-100`}>
                      {group.name}
                      <span className="ml-1 text-xs font-normal text-gray-500">[{group.children.length}]</span>
                      <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded border ${group.abcGrade === 'A' ? 'bg-red-50 text-red-600 border-red-200 font-bold' :
                        group.abcGrade === 'B' ? 'bg-green-50 text-green-600 border-green-200 font-medium' :
                          group.abcGrade === 'C' ? 'bg-gray-50 text-gray-500 border-gray-200' :
                            'bg-gray-50 text-gray-400 border-gray-100'
                        }`}>
                        {group.abcGrade}
                      </span>
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
                  {isExpanded && group.children.map(child => (
                    <tr key={child.barcode} className="bg-gray-50 border-b border-gray-100 text-xs">
                      <td className={`px-2 py-1 sticky z-20 bg-gray-50 border-b border-gray-100 ${W_TOGGLE} ${L_TOGGLE}`}></td>
                      <td className={`px-2 py-1 sticky z-20 bg-gray-50 border-b border-gray-100 ${W_IMAGE} ${L_IMAGE}`}></td>
                      <td className={`px-4 py-1 text-gray-500 font-medium text-xs text-center sticky z-20 bg-gray-50 border-b border-gray-100 ${W_SEASON} ${L_SEASON}`}>
                        {child.season || '-'}
                      </td>
                      <td className={`px-4 py-1 text-gray-500 font-medium text-xs text-center sticky z-20 bg-gray-50 border-b border-gray-100 ${W_TREND} ${L_TREND}`}>
                        {child.trend === 'hot' ? <span className="text-red-500 font-bold">🔥 급상승</span> :
                          child.trend === 'cold' ? <span className="text-blue-500 font-bold">❄️ 급하락</span> :
                            child.trend === 'up' ? <span className="text-red-400">▲ 상승</span> :
                              child.trend === 'down' ? <span className="text-blue-400">▼ 하락</span> :
                                <span className="text-gray-300">-</span>}
                      </td>
                      <td className={`px-4 py-1 pl-8 text-xs whitespace-nowrap sticky z-20 bg-gray-50 border-b border-gray-100 shadow-[4px_0_4px_-4px_rgba(0,0,0,0.1)] ${W_NAME} ${L_NAME}`}>
                        <div className="flex flex-col">
                          <span className="font-mono text-gray-400">{child.barcode}</span>
                          <span className="text-gray-600 font-medium">{child.option || '-'}</span>
                        </div>
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
          <button onClick={() => setVisibleCount(prev => prev + 20)} className="px-8 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            더 보기 (+20) <span className="ml-2 text-gray-400 text-xs">({visibleCount} / {filteredGroups.length})</span>
          </button>
        </div>
      )}
    </div>
  );
}
