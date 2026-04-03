import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import type { ProductStats } from '../lib/api';
import { Search, Loader2, ChevronRight, ChevronDown, TrendingUp, Filter, LayoutGrid, X } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { isRedDay } from '../lib/dateUtils';

interface GroupedProduct {
  name: string;
  season: string;
  imageUrl?: string;
  currentStock: number;
  fcStock: number;
  vfStock: number;
  hqStock: number;
  totalSales: number;
  sales7Days: number;
  fcSales: number;
  vfSales: number;
  dailySales: Record<string, number>;
  dailyStock: Record<string, number>;
  abcGrade: 'A' | 'B' | 'C' | 'D';
  children: ProductStats[];
}

export default function ProductStatus() {
  const [products, setProducts] = useState<ProductStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'totalSales', direction: 'desc' });
  const [selectedSeason, setSelectedSeason] = useState('all');
  const [selectedGrade, setSelectedGrade] = useState('all');
  const [viewMode, setViewMode] = useState<'qty' | 'amount'>('qty');

  const [visibleCount, setVisibleCount] = useState(20);
  const [chartModalOpen, setChartModalOpen] = useState(false);
  const [selectedGroupForChart, setSelectedGroupForChart] = useState<string | null>(null);
  const [modalHistory, setModalHistory] = useState<{sales: Record<string, number>, stock: Record<string, number>} | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const openChartModal = async (groupName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedGroupForChart(groupName);
    setChartModalOpen(true);
    setModalHistory(null);
    setLoadingHistory(true);

    try {
      const group = filteredGroups.find(g => g.name === groupName);
      if (!group) return;

      const historyData = { sales: {} as Record<string, number>, stock: {} as Record<string, number> };
      const promises = group.children.map(c => api.getProductHistory(c.barcode, 90));
      const results = await Promise.all(promises);

      results.forEach(res => {
        Object.keys(res.sales).forEach(date => {
          historyData.sales[date] = (historyData.sales[date] || 0) + res.sales[date];
        });
        Object.keys(res.stock).forEach(date => {
          historyData.stock[date] = (historyData.stock[date] || 0) + res.stock[date];
        });
      });

      setModalHistory(historyData);
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await api.getProductStats();
      setProducts(data);
    } catch (error: any) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const groupedProducts: GroupedProduct[] = useMemo(() => {
    const groups = new Map<string, GroupedProduct>();
    const VALID_SEASONS = ['겨울', '봄/가을', '사계절', '여름'];

    products.forEach(p => {
      if (!p.season || !VALID_SEASONS.includes(p.season.trim())) return;

      const existing = groups.get(p.name);
      if (existing) {
        existing.totalSales += p.totalSales;
        existing.fcSales += p.fcSales;
        existing.vfSales += p.vfSales;
        existing.sales7Days += p.sales7Days;
        existing.currentStock += p.coupangStock;
        existing.fcStock += p.fcStock;
        existing.vfStock += p.vfStock;
        existing.hqStock += p.hqStock;

        Object.entries(p.dailySales).forEach(([date, qty]) => {
          existing.dailySales[date] = (existing.dailySales[date] || 0) + qty;
        });
        Object.entries(p.dailyStock).forEach(([date, stock]) => {
          if (stock !== undefined && stock !== null) {
            existing.dailyStock[date] = (existing.dailyStock[date] || 0) + stock;
          }
        });
        existing.children.push(p);
      } else {
        groups.set(p.name, {
          name: p.name,
          season: p.season.trim(),
          imageUrl: p.imageUrl,
          totalSales: p.totalSales,
          fcSales: p.fcSales,
          vfSales: p.vfSales,
          sales7Days: p.sales7Days,
          currentStock: p.coupangStock,
          fcStock: p.fcStock,
          vfStock: p.vfStock,
          hqStock: p.hqStock,
          dailySales: { ...p.dailySales },
          dailyStock: { ...p.dailyStock },
          abcGrade: p.abcGrade,
          children: [p]
        });
      }
    });

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
    if (products.length === 0) return [];
    let latestDateStr = '';
    groupedProducts.forEach(p => {
      Object.keys(p.dailySales).forEach(d => {
        if (d > latestDateStr) latestDateStr = d;
      });
    });
    if (!latestDateStr) latestDateStr = new Date().toISOString().split('T')[0];
    const startDate = new Date(latestDateStr);
    startDate.setDate(startDate.getDate() - 14);
    const endDate = new Date(latestDateStr);
    const dates = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  }, [groupedProducts, products.length]);

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
    const aValue = a[key as keyof GroupedProduct] as any;
    const bValue = b[key as keyof GroupedProduct] as any;
    if (aValue === undefined || bValue === undefined) return 0;
    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'desc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') direction = 'asc';
    setSortConfig({ key, direction });
  };

  const toggleGroup = (name: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(name)) newExpanded.delete(name); else newExpanded.add(name);
    setExpandedGroups(newExpanded);
  };

  const totalStats = useMemo(() => {
    const stats = {
      hqStock: 0, currentStock: 0, fcStock: 0, vfStock: 0, totalSales: 0, fcSales: 0, vfSales: 0,
      hqStockValue: 0, currentStockValue: 0, totalSalesValue: 0, fcSalesValue: 0, vfSalesValue: 0,
      dailySales: {} as Record<string, number>, dailySalesValue: {} as Record<string, number>
    };
    filteredGroups.forEach(g => {
      g.children.forEach(child => {
        const cost = child.cost || 0;
        stats.hqStock += (child.hqStock || 0);
        stats.currentStock += (child.coupangStock || 0);
        stats.fcStock += (child.fcStock || 0);
        stats.vfStock += (child.vfStock || 0);
        stats.totalSales += (child.totalSales || 0);
        stats.fcSales += (child.fcSales || 0);
        stats.vfSales += (child.vfSales || 0);
        stats.hqStockValue += (child.hqStock || 0) * cost;
        stats.currentStockValue += (child.coupangStock || 0) * cost;
        stats.totalSalesValue += (child.totalSales || 0) * cost;
        stats.fcSalesValue += (child.fcSales || 0) * cost;
        stats.vfSalesValue += (child.vfSales || 0) * cost;
        Object.entries(child.dailySales || {}).forEach(([date, qty]) => {
          stats.dailySales[date] = (stats.dailySales[date] || 0) + (qty || 0);
          stats.dailySalesValue[date] = (stats.dailySalesValue[date] || 0) + ((qty || 0) * cost);
        });
      });
    });
    return stats;
  }, [filteredGroups]);

  const COLORS = ['#386ED9', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#10B981'];

  const seasonSales = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach(p => {
      const s = p.season || '기타';
      map.set(s, (map.get(s) || 0) + p.sales7Days);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [products]);

  const W_TOGGLE = "w-10 min-w-[2.5rem]";
  const W_NAME = "w-72 min-w-[18rem]";

  if (loading) return (
    <div className="flex flex-col justify-center items-center h-[calc(100vh-100px)]">
      <Loader2 className="animate-spin text-primary mb-4" size={48} strokeWidth={2.5} />
      <p className="text-caption font-bold text-text-disabled">상품 통계 데이터를 분석 중입니다...</p>
    </div>
  );

  return (
    <div className="space-y-8 pb-20">
      {/* Visual Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="p-8 border border-slate-100 rounded-3xl lg:col-span-1 h-[320px] flex flex-col bg-white">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-card-title text-text-primary tracking-tighter flex items-center font-semibold">
              <Filter size={18} className="mr-3 text-primary" />
              시즌별 판매 비중 (7일)
            </h3>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={seasonSales} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} stroke="none">
                  {seasonSales.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', fontSize: '12px', fontWeight: 'bold' }} />
                <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="p-8 border border-slate-100 rounded-3xl lg:col-span-2 h-[320px] flex flex-col bg-white">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-card-title text-text-primary tracking-tighter flex items-center font-semibold">
              <TrendingUp size={18} className="mr-3 text-primary" />
              전체 판매 추이 (최근 14일)
            </h3>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={uniqueDates.map(d => ({ date: d.substring(5), qty: totalStats.dailySales[d] || 0 }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
                <Bar dataKey="qty" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Main Table Section */}
      <div className="p-0 overflow-hidden relative border-0">
        <div className="px-8 py-6 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-6 bg-slate-50/80">
          <div>
            <h3 className="text-section-title text-text-primary flex items-center uppercase tracking-tighter font-bold">
              <LayoutGrid size={20} className="mr-3 text-primary" strokeWidth={3} />
              상품별 상세 실적 통계
            </h3>
            <p className="text-caption text-text-disabled font-bold mt-1 uppercase">{filteredGroups.length}개 상품 필터링됨</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200">
              <select className="px-3 py-1.5 text-xs font-bold text-text-secondary bg-transparent uppercase tracking-wider outline-none" value={selectedSeason} onChange={(e) => setSelectedSeason(e.target.value)}>
                <option value="all">시즌: 전체</option>
                {uniqueSeasons.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <div className="h-4 w-px bg-slate-200"></div>
              <select className="px-3 py-1.5 text-xs font-bold text-text-secondary bg-transparent uppercase tracking-wider outline-none" value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value)}>
                <option value="all">등급: 전체</option>
                <option value="A">A등급 (핵심)</option>
                <option value="B">B등급 (주력)</option>
                <option value="C">C등급 (일반)</option>
                <option value="D">D등급 (비주력)</option>
              </select>
            </div>
            
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-disabled" size={16} />
              <input type="text" placeholder="상품명, 바코드 검색..." className="pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-xs font-bold focus:ring-4 focus:ring-primary/10 w-56 outline-none bg-white" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button onClick={() => setViewMode('qty')} className={`px-4 py-1.5 text-[10px] font-bold rounded-lg transition-all ${viewMode === 'qty' ? 'bg-white text-primary' : 'text-text-disabled hover:text-text-secondary'}`}>수량</button>
              <button onClick={() => setViewMode('amount')} className={`px-4 py-1.5 text-[10px] font-bold rounded-lg transition-all ${viewMode === 'amount' ? 'bg-white text-primary' : 'text-text-disabled hover:text-text-secondary'}`}>금액</button>
            </div>
          </div>
        </div>

        <div className="overflow-auto max-h-[calc(100vh-320px)] relative custom-scrollbar">
          <table className="saas-table border-separate border-spacing-0">
            <thead className="sticky top-0 z-40 bg-white">
              <tr className="h-[52px]">
                <th className={`sticky left-0 z-50 bg-slate-50 ${W_TOGGLE} border-b border-r border-slate-200`}></th>
                <th className={`sticky left-[2.5rem] z-50 bg-slate-50 border-b border-slate-200 cursor-pointer text-[10px] font-bold text-text-disabled uppercase tracking-widest px-4`} onClick={() => handleSort('season')}>구분</th>
                <th className={`sticky left-[8.5rem] z-50 bg-slate-50 border-b border-slate-200 cursor-pointer text-[10px] font-bold text-text-disabled uppercase tracking-widest px-6 border-r ${W_NAME}`} onClick={() => handleSort('name')}>상품명</th>
                
                <th className="px-4 py-4 text-[10px] font-bold text-text-disabled uppercase tracking-widest border-b border-slate-100 text-right cursor-pointer" onClick={() => handleSort('hqStock')}>본사재고</th>
                <th className="px-4 py-4 text-[10px] font-bold text-text-disabled uppercase tracking-widest border-b border-slate-100 text-right cursor-pointer" onClick={() => handleSort('currentStock')}>쿠팡재고</th>
                <th className="px-4 py-4 text-[10px] font-bold text-primary uppercase tracking-widest border-b-2 border-primary text-right cursor-pointer bg-primary/[0.02]" onClick={() => handleSort('totalSales')}>판매합계</th>
                <th className="px-4 py-4 text-[10px] font-bold text-text-disabled uppercase tracking-widest border-b border-slate-100 text-right">전담판매</th>
                <th className="px-4 py-4 text-[10px] font-bold text-text-disabled uppercase tracking-widest border-b border-slate-100 text-right">밀크판매</th>
                {uniqueDates.map(date => (
                  <th key={date} className={`px-2 py-4 text-center border-b border-slate-100 min-w-[65px] ${isRedDay(date) ? 'text-error' : 'text-text-disabled'} text-[10px] font-bold uppercase tracking-tighter`} onClick={() => handleSort(date)}>
                    {date.substring(5).replace('-', '/')}
                  </th>
                ))}
              </tr>
              <tr className="bg-slate-50 font-bold text-[10px] text-text-primary uppercase tracking-widest">
                <th className="sticky left-0 z-30 bg-slate-100 border-b border-slate-200"></th>
                <th className="sticky left-8 z-30 bg-slate-100 border-b border-slate-200"></th>
                 <th className="sticky left-[8.5rem] z-30 bg-slate-100 border-b border-slate-200 border-r text-center">합계</th>
                <th className="text-right px-4 border-b border-slate-200">{viewMode === 'qty' ? totalStats.hqStock.toLocaleString() : totalStats.hqStockValue.toLocaleString()}</th>
                <th className="text-right px-4 border-b border-slate-200">{viewMode === 'qty' ? totalStats.currentStock.toLocaleString() : totalStats.currentStockValue.toLocaleString()}</th>
                <th className="text-right px-4 border-b border-slate-200 text-primary">{viewMode === 'qty' ? totalStats.totalSales.toLocaleString() : totalStats.totalSalesValue.toLocaleString()}</th>
                <th className="text-right px-4 border-b border-slate-200">{viewMode === 'qty' ? totalStats.fcSales.toLocaleString() : totalStats.fcSalesValue.toLocaleString()}</th>
                <th className="text-right px-4 border-b border-slate-200">{viewMode === 'qty' ? totalStats.vfSales.toLocaleString() : totalStats.vfSalesValue.toLocaleString()}</th>
                {uniqueDates.map(date => (
                  <th key={date} className="text-center px-2 border-b border-slate-200">
                    {totalStats.dailySales[date] ? (viewMode === 'qty' ? totalStats.dailySales[date].toLocaleString() : totalStats.dailySalesValue[date].toLocaleString()) : '-'}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredGroups.slice(0, visibleCount).map((group) => {
                const isExpanded = expandedGroups.has(group.name);
                const stickyBg = isExpanded ? 'bg-primary/[0.03]' : 'bg-white group-hover/tr:bg-slate-50';
                return (
                  <React.Fragment key={group.name}>
                    <tr className={`group/tr transition-colors cursor-pointer ${isExpanded ? 'bg-primary/[0.03]' : ''}`} onClick={() => toggleGroup(group.name)}>
                      <td className={`sticky left-0 z-20 ${stickyBg} border-b border-r border-slate-100 text-center py-5`}>
                        {isExpanded ? <ChevronDown size={14} className="text-primary mx-auto" /> : <ChevronRight size={14} className="text-text-disabled mx-auto" />}
                      </td>
                      <td className={`sticky left-[2.5rem] z-20 ${stickyBg} border-b border-slate-100 px-4 py-5 text-[11px] font-bold text-text-secondary uppercase tracking-widest`}>{group.season}</td>
                      <td className={`sticky left-[8.5rem] z-20 ${stickyBg} border-b border-slate-100 border-r px-6 py-5`}>
                        <div className="flex flex-col">
                          <span className="text-item-main text-text-primary leading-tight group-hover/tr:text-primary transition-colors" onClick={(e) => openChartModal(group.name, e)}>{group.name}</span>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[11px] font-bold text-text-disabled uppercase">{(group.children[0]?.cost || 0).toLocaleString()} KRW</span>
                            <span className={`text-[10px] font-bold uppercase tracking-tighter ${
                              group.abcGrade === 'A' ? 'text-success' :
                              group.abcGrade === 'B' ? 'text-warning' :
                              group.abcGrade === 'C' ? 'text-primary' : 'text-text-disabled'
                            }`}>{group.abcGrade}</span>
                          </div>
                        </div>
                      </td>
                      <td className="text-right px-4 text-item-data text-text-secondary">{viewMode === 'qty' ? group.hqStock.toLocaleString() : group.children.reduce((acc, c) => acc + (c.hqStock * (c.cost || 0)), 0).toLocaleString()}</td>
                      <td className="text-right px-4 text-item-data text-text-secondary">{viewMode === 'qty' ? group.currentStock.toLocaleString() : group.children.reduce((acc, c) => acc + (c.coupangStock * (c.cost || 0)), 0).toLocaleString()}</td>
                      <td className="text-right px-4 text-item-data text-primary bg-primary/[0.01]">{viewMode === 'qty' ? group.totalSales.toLocaleString() : group.children.reduce((acc, c) => acc + (c.totalSales * (c.cost || 0)), 0).toLocaleString()}</td>
                      <td className="text-right px-4 text-item-data text-text-disabled">{viewMode === 'qty' ? group.fcSales.toLocaleString() : group.children.reduce((acc, c) => acc + (c.fcSales * (c.cost || 0)), 0).toLocaleString()}</td>
                      <td className="text-right px-4 text-item-data text-text-disabled">{viewMode === 'qty' ? group.vfSales.toLocaleString() : group.children.reduce((acc, c) => acc + (c.vfSales * (c.cost || 0)), 0).toLocaleString()}</td>
                      {uniqueDates.map(date => (
                        <td key={date} className={`text-center py-5 text-item-data ${group.dailySales[date] ? 'text-text-primary' : 'text-slate-100'}`}>
                          {group.dailySales[date] ? (viewMode === 'qty' ? group.dailySales[date].toLocaleString() : group.children.reduce((acc, c) => acc + ((c.dailySales[date] || 0) * (c.cost || 0)), 0).toLocaleString()) : '-'}
                        </td>
                      ))}
                    </tr>
                    {isExpanded && group.children.map(child => (
                      <tr key={child.barcode} className="bg-slate-50/50 text-item-sub group/sub transition-colors hover:bg-slate-100/50">
                        <td className="sticky left-0 bg-slate-50/50 border-b border-slate-100"></td>
                        <td className="sticky left-[2.5rem] bg-slate-50/50 border-b border-slate-100"></td>
                        <td className="sticky left-[8.5rem] bg-slate-50/50 border-b border-slate-100 border-r px-8 py-3">
                          <div className="flex flex-col">
                            <span className="text-text-disabled font-mono tracking-tighter mb-0.5">{child.barcode}</span>
                            <span className="text-text-secondary uppercase">{child.option || '-'}</span>
                          </div>
                        </td>
                        <td className="text-right px-4 text-text-disabled">{viewMode === 'qty' ? child.hqStock.toLocaleString() : (child.hqStock * (child.cost || 0)).toLocaleString()}</td>
                        <td className="text-right px-4 text-text-disabled">{viewMode === 'qty' ? child.coupangStock.toLocaleString() : (child.coupangStock * (child.cost || 0)).toLocaleString()}</td>
                        <td className="text-right px-4 text-text-secondary">{viewMode === 'qty' ? child.totalSales.toLocaleString() : (child.totalSales * (child.cost || 0)).toLocaleString()}</td>
                        <td className="text-right px-4 text-text-disabled/50">{viewMode === 'qty' ? child.fcSales.toLocaleString() : (child.fcSales * (child.cost || 0)).toLocaleString()}</td>
                        <td className="text-right px-4 text-text-disabled/50">{viewMode === 'qty' ? child.vfSales.toLocaleString() : (child.vfSales * (child.cost || 0)).toLocaleString()}</td>
                        {uniqueDates.map(date => (
                          <td key={date} className={`text-center text-item-sub font-medium ${child.dailySales[date] ? 'text-text-secondary' : 'text-slate-100'}`}>
                            {child.dailySales[date] ? (viewMode === 'qty' ? child.dailySales[date].toLocaleString() : (child.dailySales[date] * (child.cost || 0)).toLocaleString()) : '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {visibleCount < filteredGroups.length && (
          <div className="flex justify-center py-10 bg-slate-50 border-t border-slate-100">
            <button onClick={() => setVisibleCount(prev => prev + 20)} className="btn-secondary px-8 font-bold uppercase tracking-[0.2em]">상품 데이터 더보기 (+20) <span className="ml-4 opacity-40">{visibleCount} / {filteredGroups.length}</span></button>
          </div>
        )}
      </div>

      {/* Chart Modal */}
      {chartModalOpen && selectedGroupForChart && (
        <div className="fixed inset-0 bg-text-primary/60 backdrop-blur-md z-[100] flex justify-center items-center p-4" onClick={() => setChartModalOpen(false)}>
          <div className="bg-white rounded-3xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-lg font-bold text-text-primary uppercase tracking-tighter flex items-center">
                  <TrendingUp size={22} className="text-primary mr-3" strokeWidth={3} />
                  {selectedGroupForChart} <span className="ml-2 text-primary">실시간 판매 추이</span>
                </h3>
              </div>
              <button onClick={() => setChartModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-all"><X size={20} /></button>
            </div>
            <div className="p-10 h-[450px]">
              {loadingHistory ? <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-primary" size={40} strokeWidth={3} /></div> :
               modalHistory && Object.keys(modalHistory.sales).length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={Object.keys(modalHistory.sales).sort().map(d => ({ date: d.substring(5).replace('-', '/'), sales: modalHistory.sales[d] || 0, stock: modalHistory.stock[d] || 0 }))}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: '16px', border: 'none' }} />
                    <Legend verticalAlign="top" height={50} iconType="circle" wrapperStyle={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase' }} />
                    <Line type="monotone" dataKey="sales" name="일일 판매량" stroke="#22C55E" strokeWidth={4} dot={false} activeDot={{ r: 6, strokeWidth: 0 }} />
                    <Line type="monotone" dataKey="stock" name="쿠팡 재고" stroke="#386ED9" strokeWidth={2} strokeDasharray="6 6" dot={false} opacity={0.5} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <div className="h-full flex items-center justify-center text-text-disabled font-bold uppercase">분석 데이터가 존재하지 않습니다.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
