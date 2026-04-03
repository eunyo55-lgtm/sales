import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../lib/api';
import type { ProductStats } from '../lib/api';
import { Search, Loader2, ChevronRight, ChevronDown, Copy, X, TrendingUp, Archive } from 'lucide-react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, LineChart, Line
} from 'recharts';
import { isRedDay } from '../lib/dateUtils';

interface InventoryGroup {
  name: string;
  season?: string;
  abcGrade?: string;
  imageUrl?: string;
  hqStock: number;
  coupangStock: number;
  fcStock: number;
  vfStock: number;
  sales14Days: number;
  sales7Days: number;
  prevSales7Days: number;
  totalSales: number;
  dailyStock: Record<string, number>;
  trend: 'up' | 'down' | 'flat';
  minDaysOfInventory: number;
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
  const [chartModalOpen, setChartModalOpen] = useState(false);
  const [selectedGroupForChart, setSelectedGroupForChart] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'qty' | 'amount'>('qty');
  const [selectedSeason, setSelectedSeason] = useState('all');
  const [selectedGrade, setSelectedGrade] = useState('all');
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
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const groupedData = useMemo(() => {
    const groups = new Map<string, InventoryGroup>();
    const VALID_SEASONS = ['겨울', '봄/가을', '사계절', '여름'];

    products.forEach(p => {
      if (!p.season || !VALID_SEASONS.includes(p.season.trim())) return;

      const prevSales7Days = p.sales14Days - p.sales7Days;
      let trend: 'up' | 'down' | 'flat' = 'flat';
      const diff = p.sales7Days - prevSales7Days;
      if (diff > 0) trend = 'up'; else if (diff < 0) trend = 'down';

      let status = '양호';
      let statusColor = 'text-green-600';
      if (p.coupangStock === 0) { status = '품절'; statusColor = 'text-gray-800 font-bold'; }
      else if (p.daysOfInventory < 7) { status = '위험'; statusColor = 'text-rose-600 font-bold underline underline-offset-4'; }
      else if (p.daysOfInventory < 14) { status = '부족'; statusColor = 'text-yellow-600 font-bold'; }

      const processedItem = { ...p, prevSales7Days, trend, status, statusColor, season: p.season.trim() };

      if (!groups.has(p.name)) {
        groups.set(p.name, {
          name: p.name, season: p.season.trim(), abcGrade: p.abcGrade, imageUrl: p.imageUrl,
          hqStock: 0, coupangStock: 0, fcStock: 0, vfStock: 0, sales14Days: 0, sales7Days: 0,
          prevSales7Days: 0, totalSales: 0, dailyStock: {}, trend: 'flat', minDaysOfInventory: 9999,
          children: []
        });
      }

      const g = groups.get(p.name)!;
      g.hqStock += p.hqStock;
      g.coupangStock += p.coupangStock;
      g.fcStock += (p.fcStock || 0);
      g.vfStock += (p.vfStock || 0);
      g.sales14Days += p.sales14Days;
      g.sales7Days += p.sales7Days;
      g.prevSales7Days += prevSales7Days;
      g.totalSales += p.totalSales;

      Object.entries(p.dailyStock || {}).forEach(([date, stock]) => {
        g.dailyStock[date] = (g.dailyStock[date] || 0) + stock;
      });

      if (p.daysOfInventory < g.minDaysOfInventory) g.minDaysOfInventory = p.daysOfInventory;
      g.children.push(processedItem);
    });

    for (const g of groups.values()) {
      if (g.children.some(c => c.abcGrade === 'A')) g.abcGrade = 'A';
      else if (g.children.some(c => c.abcGrade === 'B')) g.abcGrade = 'B';
      else if (g.children.some(c => c.abcGrade === 'C')) g.abcGrade = 'C';
      else g.abcGrade = 'D';
    }
    return Array.from(groups.values());
  }, [products]);

  const uniqueDates = useMemo(() => {
    if (products.length === 0) return [];
    let latestDateStr = '';
    groupedData.forEach(p => {
      Object.keys(p.dailyStock || {}).forEach(d => {
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
  }, [groupedData, products.length]);

  const filteredGroups = useMemo(() => {
    let result = groupedData.filter(g => {
      const matchSeason = selectedSeason === 'all' || g.season === selectedSeason;
      const matchGrade = selectedGrade === 'all' || g.abcGrade === selectedGrade;
      const matchSearch = g.name.toLowerCase().includes(search.toLowerCase()) ||
        g.children.some(c => c.barcode.includes(search)) ||
        (g.season && g.season.includes(search));
      return matchSeason && matchGrade && matchSearch;
    });

    if (sortConfig) {
      result.sort((a, b) => {
        const aVal = uniqueDates.includes(sortConfig.key) ? (a.dailyStock[sortConfig.key] || 0) : (a as any)[sortConfig.key];
        const bVal = uniqueDates.includes(sortConfig.key) ? (b.dailyStock[sortConfig.key] || 0) : (b as any)[sortConfig.key];
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
    if (newExpanded.has(name)) newExpanded.delete(name); else newExpanded.add(name);
    setExpandedGroups(newExpanded);
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'desc';
    if ((key === 'minDaysOfInventory') && (!sortConfig || sortConfig.key !== key)) direction = 'asc';
    else if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') direction = 'asc';
    setSortConfig({ key, direction });
  };

  const [toast, setToast] = useState<{ show: boolean, message: string }>({ show: false, message: '' });
  const showToast = (message: string) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: '' }), 2000);
  };

  const COLORS = ['#0066FF', '#10B981', '#F59E0B', '#EF4444', '#6366F1', '#EC4899', '#06B6D4'];

  const seasonStock = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach(p => {
      const s = p.season || '기타';
      map.set(s, (map.get(s) || 0) + (p.coupangStock || 0));
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [products]);

  const handleCopyColumn = (key: string, label: string) => {
    const values = filteredGroups.map(g => (g as any)[key] !== undefined ? (g as any)[key] : '');
    const text = values.join('\n');
    navigator.clipboard.writeText(text).then(() => showToast(`${label} 복사 완료 (${values.length}행)`)).catch(() => alert('복사 실패'));
  };

  const totalStats = useMemo(() => {
    const stats = {
      hqStock: 0, coupangStock: 0, fcStock: 0, vfStock: 0, totalSales: 0,
      hqStockValue: 0, coupangStockValue: 0, fcStockValue: 0, vfStockValue: 0, totalSalesValue: 0,
      dailyStock: {} as Record<string, number>, dailyStockValue: {} as Record<string, number>,
    };
    filteredGroups.forEach(g => {
      g.children.forEach(child => {
        const cost = child.cost || 0;
        stats.hqStock += (child.hqStock || 0);
        stats.coupangStock += (child.coupangStock || 0);
        stats.fcStock += (child.fcStock || 0);
        stats.vfStock += (child.vfStock || 0);
        stats.totalSales += (child.totalSales || 0);
        stats.hqStockValue += (child.hqStock || 0) * cost;
        stats.coupangStockValue += (child.coupangStock || 0) * cost;
        stats.fcStockValue += (child.fcStock || 0) * cost;
        stats.vfStockValue += (child.vfStock || 0) * cost;
        stats.totalSalesValue += (child.totalSales || 0) * cost;
        Object.entries(child.dailyStock || {}).forEach(([date, qty]) => {
          stats.dailyStock[date] = (stats.dailyStock[date] || 0) + (qty || 0);
          stats.dailyStockValue[date] = (stats.dailyStockValue[date] || 0) + ((qty || 0) * cost);
        });
      });
    });
    return stats;
  }, [filteredGroups]);

  const W_TOGGLE = "w-12 min-w-[3rem]";
  const W_NAME = "w-72 min-w-[18rem]";

  if (loading) return (
    <div className="flex flex-col justify-center items-center h-[calc(100vh-100px)]">
      <Loader2 className="animate-spin text-primary mb-4" size={48} strokeWidth={2.5} />
      <p className="text-caption font-bold text-text-disabled">재고 현황을 분석 중입니다...</p>
    </div>
  );

  return (
    <div className="space-y-8 pb-20">
      {/* Visual Intelligence Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="p-8 border border-slate-100 rounded-3xl lg:col-span-1 h-[320px] flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-card-title text-text-primary tracking-tighter flex items-center font-semibold">
              <Archive size={18} className="mr-3 text-primary" />
              시즌별 재고 비중
            </h3>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={seasonStock} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} stroke="none">
                  {seasonStock.map((_: any, index: number) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', fontSize: '11px', fontWeight: 'bold' }} />
                <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="p-8 border border-slate-100 rounded-3xl lg:col-span-2 h-[320px] flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-card-title text-text-primary tracking-tighter flex items-center font-semibold">
              <TrendingUp size={18} className="mr-3 text-primary" />
              전체 재고 흐름 추이
            </h3>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={uniqueDates.map(d => ({ date: d.substring(5), stock: totalStats.dailyStock[d] || 0 }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
                <Line type="monotone" dataKey="stock" stroke="#0066FF" strokeWidth={4} dot={false} activeDot={{ r: 6, strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Main Inventory Board */}
      <div className="p-0 overflow-hidden relative border-0">
        {toast.show && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-text-primary text-white px-8 py-4 rounded-3xl z-[100] font-bold text-xs">
            {toast.message}
          </div>
        )}

        <div className="px-8 py-6 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-6 bg-slate-50/80">
          <div>
            <h3 className="text-section-title text-text-primary flex items-center uppercase tracking-tighter font-bold">
              <Archive size={20} className="mr-3 text-primary" strokeWidth={3} />
              재고 흐름 모니터링
            </h3>
            <p className="text-caption text-text-disabled font-bold mt-1 uppercase">{filteredGroups.length}개 재고 그룹 추적 중</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200">
              <select className="px-3 py-1.5 text-xs font-bold text-text-secondary bg-transparent uppercase tracking-wider outline-none" value={selectedSeason} onChange={(e) => setSelectedSeason(e.target.value)}>
                <option value="all">시즌: 전체</option>
                <option value="여름">여름</option><option value="사계절">사계절</option><option value="봄/가을">봄/가을</option><option value="겨울">겨울</option>
              </select>
              <div className="h-4 w-px bg-slate-200"></div>
              <select className="px-3 py-1.5 text-xs font-bold text-text-secondary bg-transparent uppercase tracking-wider outline-none" value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value)}>
                <option value="all">등급: 전체</option>
                <option value="A">A등급</option><option value="B">B등급</option><option value="C">C등급</option><option value="D">D등급</option>
              </select>
            </div>
            
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-disabled" size={16} />
              <input type="text" placeholder="재고 상품 검색..." className="pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-xs font-bold focus:ring-4 focus:ring-primary/10 w-56 outline-none bg-white" value={search} onChange={(e) => setSearch(e.target.value)} />
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
                <th className={`sticky left-[3rem] z-50 bg-slate-50 border-b border-slate-200 px-6 border-r ${W_NAME} text-[10px] font-bold text-text-disabled uppercase tracking-widest cursor-pointer hover:text-primary`} onClick={() => handleSort('name')}>
                  <div className="flex items-center justify-between">
                    <span>상품명</span>
                    <Copy size={13} className="text-text-disabled opacity-30 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); handleCopyColumn('name', '상품명'); }} />
                  </div>
                </th>
                <th className="px-4 py-4 text-table-header text-primary border-b-2 border-primary text-right cursor-pointer bg-primary/[0.02]" onClick={() => handleSort('totalSales')}>판매량</th>
                <th className="px-4 py-4 text-table-header border-b border-slate-100 text-right cursor-pointer" onClick={() => handleSort('hqStock')}>본사</th>
                <th className="px-4 py-4 text-table-header border-b border-slate-100 text-right cursor-pointer" onClick={() => handleSort('coupangStock')}>쿠팡합계</th>
                <th className="px-4 py-4 text-table-header border-b border-slate-100 text-right">전담재고</th>
                <th className="px-4 py-4 text-table-header border-b border-slate-100 text-right">밀크재고</th>
                <th className="px-4 py-4 text-table-header text-success border-b border-slate-100 text-right cursor-pointer" onClick={() => handleSort('sales7Days')}>7일 판매</th>
                <th className="px-4 py-4 text-table-header border-b border-slate-100 text-right cursor-pointer" onClick={() => handleSort('minDaysOfInventory')}>소진 예측</th>
                {uniqueDates.map(date => (
                  <th key={date} className={`px-2 py-4 text-center border-b border-slate-100 min-w-[65px] ${isRedDay(date) ? 'text-error' : 'text-text-disabled'} text-table-header tracking-tighter`} onClick={() => handleSort(date)}>
                    {date.substring(5).replace('-', '/')}
                  </th>
                ))}
              </tr>
              <tr className="bg-slate-50 font-bold text-[10px] text-text-primary uppercase tracking-widest">
                <th className="sticky left-0 z-30 bg-slate-100 border-b border-slate-200"></th>
                <th className="sticky left-[3rem] z-30 bg-slate-100 border-b border-slate-200 border-r text-center">합계</th>
                <th className="text-right px-4 border-b border-slate-200 text-primary">{viewMode === 'qty' ? totalStats.totalSales.toLocaleString() : totalStats.totalSalesValue.toLocaleString()}</th>
                <th className="text-right px-4 border-b border-slate-200">{viewMode === 'qty' ? totalStats.hqStock.toLocaleString() : totalStats.hqStockValue.toLocaleString()}</th>
                <th className="text-right px-4 border-b border-slate-200">{viewMode === 'qty' ? totalStats.coupangStock.toLocaleString() : totalStats.coupangStockValue.toLocaleString()}</th>
                <th className="text-right px-4 border-b border-slate-200">{viewMode === 'qty' ? totalStats.fcStock.toLocaleString() : totalStats.fcStockValue.toLocaleString()}</th>
                <th className="text-right px-4 border-b border-slate-200">{viewMode === 'qty' ? totalStats.vfStock.toLocaleString() : totalStats.vfStockValue.toLocaleString()}</th>
                <th className="text-right px-4 border-b border-slate-200 text-success">{viewMode === 'qty' ? filteredGroups.reduce((acc, g) => acc + g.sales7Days, 0).toLocaleString() : '-'}</th>
                <th className="border-b border-slate-200"></th>
                {uniqueDates.map(date => (
                  <th key={date} className="text-center px-2 border-b border-slate-200">
                    {totalStats.dailyStock[date] ? (viewMode === 'qty' ? totalStats.dailyStock[date].toLocaleString() : totalStats.dailyStockValue[date].toLocaleString()) : '-'}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredGroups.slice(0, visibleCount).map((g) => {
                const isExpanded = expandedGroups.has(g.name);
                const stickyBg = isExpanded ? 'bg-primary/[0.03]' : 'bg-white group-hover/tr:bg-slate-50';
                
                let BurnBadge = <span className="text-[9px] font-bold text-text-disabled uppercase">보통</span>;
                if (g.minDaysOfInventory <= 7) BurnBadge = <span className="text-[9px] font-bold text-error uppercase animate-pulse">D-{Math.floor(g.minDaysOfInventory)}</span>;
                else if (g.minDaysOfInventory <= 14) BurnBadge = <span className="text-[9px] font-bold text-warning uppercase">D-{Math.floor(g.minDaysOfInventory)}</span>;
                else if (g.minDaysOfInventory <= 30) BurnBadge = <span className="text-[9px] font-bold text-primary uppercase">D-{Math.floor(g.minDaysOfInventory)}</span>;

                return (
                  <React.Fragment key={g.name}>
                    <tr className={`group/tr transition-colors cursor-pointer ${isExpanded ? 'bg-primary/[0.03]' : ''}`} onClick={() => toggleGroup(g.name)}>
                      <td className={`sticky left-0 z-20 ${stickyBg} border-b border-r border-slate-100 text-center py-5`}>
                        {isExpanded ? <ChevronDown size={14} className="text-primary mx-auto" /> : <ChevronRight size={14} className="text-text-disabled mx-auto" />}
                      </td>
                      <td className={`sticky left-[3rem] z-20 ${stickyBg} border-b border-slate-100 border-r px-6 py-5`}>
                        <div className="flex flex-col">
                          <span className="text-item-main text-text-primary leading-tight group-hover/tr:text-primary transition-colors" onClick={(e) => openChartModal(g.name, e)}>{g.name}</span>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[11px] font-bold text-text-disabled uppercase tracking-widest">{g.season || 'SAAS CORE'}</span>
                            <span className={`text-[10px] font-bold uppercase tracking-tighter ${
                              g.abcGrade === 'A' ? 'text-success' :
                              g.abcGrade === 'B' ? 'text-warning' :
                              g.abcGrade === 'C' ? 'text-primary' : 'text-text-disabled'
                            }`}>{g.abcGrade}</span>
                          </div>
                        </div>
                      </td>
                      <td className="text-right px-4 text-item-data text-primary bg-primary/[0.01]">{viewMode === 'qty' ? g.totalSales.toLocaleString() : g.children.reduce((acc, c) => acc + (c.totalSales * (c.cost || 0)), 0).toLocaleString()}</td>
                      <td className="text-right px-4 text-item-data text-text-secondary">{viewMode === 'qty' ? g.hqStock.toLocaleString() : (g.children.reduce((acc, c) => acc + (c.hqStock * (c.cost || 0)), 0)).toLocaleString()}</td>
                      <td className="text-right px-4 text-item-data text-text-secondary">{viewMode === 'qty' ? g.coupangStock.toLocaleString() : (g.children.reduce((acc, c) => acc + (c.coupangStock * (c.cost || 0)), 0)).toLocaleString()}</td>
                      <td className="text-right px-4 text-item-data text-text-disabled">{viewMode === 'qty' ? g.fcStock.toLocaleString() : '-'}</td>
                      <td className="text-right px-4 text-item-data text-text-disabled">{viewMode === 'qty' ? g.vfStock.toLocaleString() : '-'}</td>
                      <td className="text-right px-4 text-item-data text-success">{viewMode === 'qty' ? g.sales7Days.toLocaleString() : '-'}</td>
                      <td className="text-right px-4">{BurnBadge}</td>
                      {uniqueDates.map(date => (
                        <td key={date} className={`text-center py-5 text-item-data ${g.dailyStock[date] ? 'text-text-primary' : 'text-slate-100'}`}>
                          {g.dailyStock[date] ? (viewMode === 'qty' ? g.dailyStock[date].toLocaleString() : (g.children.reduce((acc, c) => acc + ((c.dailyStock[date] || 0) * (c.cost || 0)), 0)).toLocaleString()) : '-'}
                        </td>
                      ))}
                    </tr>
                    {isExpanded && g.children.map(child => (
                      <tr key={child.barcode} className="bg-slate-50/50 text-item-sub group/sub transition-colors hover:bg-slate-100/50">
                        <td className="sticky left-0 bg-slate-50/50 border-b border-slate-100"></td>
                        <td className="sticky left-[3rem] bg-slate-50/50 border-b border-slate-100 border-r px-8 py-3">
                          <div className="flex flex-col">
                            <span className="text-item-sub text-text-disabled font-mono tracking-tighter mb-0.5">{child.barcode}</span>
                            <span className="text-item-sub text-text-secondary font-bold uppercase">{child.option || '-'}</span>
                          </div>
                        </td>
                        <td className="text-right px-4 text-text-secondary">{viewMode === 'qty' ? child.totalSales.toLocaleString() : (child.totalSales * (child.cost || 0)).toLocaleString()}</td>
                        <td className="text-right px-4 text-text-disabled">{viewMode === 'qty' ? child.hqStock.toLocaleString() : (child.hqStock * (child.cost || 0)).toLocaleString()}</td>
                        <td className="text-right px-4 text-text-disabled">{viewMode === 'qty' ? child.coupangStock.toLocaleString() : (child.coupangStock * (child.cost || 0)).toLocaleString()}</td>
                        <td className="text-right px-4 text-text-disabled/40">{viewMode === 'qty' ? (child.fcStock || 0).toLocaleString() : '-'}</td>
                        <td className="text-right px-4 text-text-disabled/40">{viewMode === 'qty' ? (child.vfStock || 0).toLocaleString() : '-'}</td>
                        <td className="text-right px-4 text-success/70 font-medium">{viewMode === 'qty' ? child.sales7Days.toLocaleString() : '-'}</td>
                        <td className="text-right px-4 text-error font-medium">{child.daysOfInventory > 365 ? '1YR+' : `D-${Math.floor(child.daysOfInventory)}`}</td>
                        {uniqueDates.map(date => (
                          <td key={date} className={`text-center text-item-sub font-medium ${child.dailyStock && child.dailyStock[date] ? 'text-text-secondary' : 'text-slate-100'}`}>
                            {child.dailyStock && child.dailyStock[date] ? (viewMode === 'qty' ? child.dailyStock[date].toLocaleString() : (child.dailyStock[date] * (child.cost || 0)).toLocaleString()) : '-'}
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
            <button onClick={() => setVisibleCount(prev => prev + 20)} className="btn-secondary px-8 font-bold uppercase tracking-[0.2em]">재고 데이터 더보기 (+20) <span className="ml-4 opacity-40">{visibleCount} / {filteredGroups.length}</span></button>
          </div>
        )}
      </div>

      {/* Analytics Modal */}
      {chartModalOpen && selectedGroupForChart && (
        <div className="fixed inset-0 bg-text-primary/70 backdrop-blur-md z-[100] flex justify-center items-center p-4" onClick={() => setChartModalOpen(false)}>
          <div className="bg-white rounded-3xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-text-primary uppercase tracking-tighter flex items-center">
                <TrendingUp size={22} className="text-primary mr-3" strokeWidth={3} />
                재고 흐름 분석: {selectedGroupForChart}
              </h3>
              <button onClick={() => setChartModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-all"><X size={20} /></button>
            </div>
            <div className="p-10 h-[450px]">
              {loadingHistory ? <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-primary" size={40} strokeWidth={3} /></div> :
               modalHistory && Object.keys(modalHistory.stock).length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={Object.keys(modalHistory.stock).sort().map(d => ({ date: d.substring(5).replace('-', '/'), stock: modalHistory.stock[d] }))}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: '16px', border: 'none' }} />
                    <Line type="monotone" dataKey="stock" name="실재고" stroke="#0066FF" strokeWidth={4} dot={false} activeDot={{ r: 6, strokeWidth: 0 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <div className="h-full flex items-center justify-center text-text-disabled font-bold uppercase">분석 가능한 흐름 데이터가 없습니다.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
