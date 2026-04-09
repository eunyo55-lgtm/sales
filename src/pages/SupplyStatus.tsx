import { useState, useEffect, useMemo } from 'react';
import React from 'react';
import { api } from '../lib/api';
import { TrendingUp, Package, CheckCircle, Truck, BarChart2, Search, ChevronDown, ChevronRight, ArrowUpDown, Loader2, Activity } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

function SortIcon({ currentSort, targetKey }: { currentSort: { key: string, direction: 'asc' | 'desc' }, targetKey: string }) {
    const isActive = currentSort.key === targetKey;
    return (
        <ArrowUpDown 
            size={12} 
            className={`transition-colors ${isActive ? 'text-primary' : 'text-text-disabled opacity-30 hover:opacity-100'}`} 
            strokeWidth={isActive ? 3 : 2}
        />
    );
}

export default function SupplyStatus() {
    const [analytics, setAnalytics] = useState<{ timeline: any[], performance: any[], upcoming: any[] }>({ timeline: [], performance: [], upcoming: [] });
    const [loading, setLoading] = useState(true);
    const [viewType, setViewType] = useState<'weekly' | 'monthly'>('weekly');
    const [searchTerm, setSearchTerm] = useState('');
    const [visibleCount, setVisibleCount] = useState(10);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    
    const [summarySort, setSummarySort] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'key', direction: 'desc' });
    const [productSort, setProductSort] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'unpaidQty', direction: 'desc' });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const data = await api.getSupplyAnalytics(24);
            setAnalytics(data || { timeline: [], performance: [], upcoming: [] });
            setLoading(false);
        } catch (e) {
            console.error(e);
            setLoading(false);
        }
    };

    const aggregatedData = useMemo(() => {
        if (!analytics.timeline.length) return [];
        
        let base = analytics.timeline;
        
        if (viewType === 'monthly') {
            const monthly: Record<string, any> = {};
            analytics.timeline.forEach(t => {
                const monthKey = t.key.substring(0, 7); // YYYY-MM
                if (!monthly[monthKey]) {
                    monthly[monthKey] = { key: monthKey, orderQty: 0, confirmedQty: 0, receivedQty: 0, orderAmount: 0, confirmedAmount: 0, receivedAmount: 0 };
                }
                const m = monthly[monthKey];
                m.orderQty += t.orderQty;
                m.confirmedQty += t.confirmedQty;
                m.receivedQty += t.receivedQty;
                m.orderAmount += t.orderAmount;
                m.confirmedAmount += t.confirmedAmount;
                m.receivedAmount += t.receivedAmount;
            });
            base = Object.values(monthly);
        }

        let result = base.map((g: any) => ({
            ...g,
            unpaidQty: Math.max(0, g.orderQty - g.confirmedQty),
            unpaidAmount: Math.max(0, g.orderAmount - g.confirmedAmount),
            supplyRate: g.orderQty > 0 ? (g.confirmedQty / g.orderQty) * 100 : 0,
            receiveRate: g.confirmedQty > 0 ? (g.receivedQty / g.confirmedQty) * 100 : 0
        }));

        result.sort((a: any, b: any) => {
            const valA = a[summarySort.key];
            const valB = b[summarySort.key];
            if (typeof valA === 'string') return summarySort.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            return summarySort.direction === 'asc' ? valA - valB : valB - valA;
        });
        return result;
    }, [analytics.timeline, viewType, summarySort]);

    const sortedAggregatedData = useMemo(() => [...aggregatedData].sort((a, b) => a.key.localeCompare(b.key)), [aggregatedData]);

    const groupedPerformance = useMemo(() => {
        const result = analytics.performance.map((p: any) => ({
            ...p,
            unpaidQty: Math.max(0, p.orderQty - p.confirmedQty),
            unpaidAmount: Math.max(0, p.orderAmount - p.confirmedAmount),
            supplyRate: p.orderQty > 0 ? (p.confirmedQty / p.orderQty) * 100 : 0,
            receiveRate: p.confirmedQty > 0 ? (p.receivedQty / p.confirmedQty) * 100 : 0,
            children: [] 
        }));

        return result
            .filter(p => !searchTerm || p.name.toLowerCase().includes(searchTerm.toLowerCase()))
            .sort((a, b) => {
                const valA = a[productSort.key] || 0;
                const valB = b[productSort.key] || 0;
                return productSort.direction === 'asc' ? valA - valB : valB - valA;
            });
    }, [analytics.performance, productSort, searchTerm]);

    const visibleGroups = useMemo(() => groupedPerformance.slice(0, visibleCount), [groupedPerformance, visibleCount]);

    const toggleGroup = (name: string) => {
        const newExpanded = new Set(expandedGroups);
        if (newExpanded.has(name)) newExpanded.delete(name); else newExpanded.add(name);
        setExpandedGroups(newExpanded);
    };

    if (loading) return (
        <div className="flex flex-col justify-center items-center h-[calc(100vh-200px)]">
            <Loader2 className="animate-spin text-primary mb-4" size={48} strokeWidth={2.5} />
            <p className="text-caption font-bold text-text-disabled uppercase tracking-[0.2em]">공급망 데이터를 분석 중입니다...</p>
        </div>
    );

    const totalOrderAmount = aggregatedData.reduce((sum, item) => sum + item.orderAmount, 0);
    const totalConfirmedAmount = aggregatedData.reduce((sum, item) => sum + item.confirmedAmount, 0);
    const totalReceivedAmount = aggregatedData.reduce((sum, item) => sum + item.receivedAmount, 0);
    const avgSupplyRate = aggregatedData.length > 0 ? aggregatedData.reduce((sum, item) => sum + item.supplyRate, 0) / aggregatedData.length : 0;

    const handleSortSummary = (key: string) => {
        setSummarySort(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    const handleSortProduct = (key: string) => {
        setProductSort(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    return (
        <div className="space-y-8 pb-20 animate-in fade-in duration-700">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
                <div>
                    <h3 className="text-section-title text-text-primary tracking-tighter font-semibold flex items-center">
                        <BarChart2 size={20} className="mr-3 text-primary" strokeWidth={2.5} />
                        공급망 및 입고 현황
                    </h3>
                    <p className="text-caption text-text-disabled font-medium mt-1">풀필먼트 가시성 및 이행 실적 관리</p>
                </div>
                <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
                    <button onClick={() => setViewType('weekly')} className={`px-6 py-2 text-[11px] font-bold rounded-xl transition-all tracking-widest ${viewType === 'weekly' ? 'bg-white text-primary shadow-xl shadow-primary/5' : 'text-text-disabled hover:text-text-secondary'}`}>주차별</button>
                    <button onClick={() => setViewType('monthly')} className={`px-6 py-2 text-[11px] font-bold rounded-xl transition-all tracking-widest ${viewType === 'monthly' ? 'bg-white text-primary shadow-xl shadow-primary/5' : 'text-text-disabled hover:text-text-secondary'}`}>월별</button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatCard title="총 발주 금액" value={totalOrderAmount} unit="KRW" icon={<Package size={20} strokeWidth={2.5} />} color="primary" />
                <StatCard title="수주 확정 금액" value={totalConfirmedAmount} unit="KRW" icon={<CheckCircle size={20} strokeWidth={2.5} />} color="success" />
                <StatCard title="최종 입고 금액" value={totalReceivedAmount} unit="KRW" icon={<Truck size={20} strokeWidth={2.5} />} color="warning" />
                <StatCard title="평균 공급 이행율" value={avgSupplyRate} unit="%" icon={<Activity size={20} strokeWidth={2.5} />} color="error" isPercent />
            </div>

            <div className="p-8 border border-slate-100 rounded-3xl bg-white shadow-sm overflow-hidden">
                <h3 className="text-caption font-bold text-text-disabled mb-10 flex items-center">
                    <TrendingUp size={16} className="mr-3 text-primary" strokeWidth={2.5} />
                    공급 이행 파이프라인
                </h3>
                <div className="h-80 w-full mb-10">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={sortedAggregatedData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="key" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 'bold'}} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 'bold'}} dx={-10} tickFormatter={(val) => Math.round(val / 10000).toLocaleString() + '만'} />
                            <Tooltip 
                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px' }}
                                formatter={(value: any) => [Math.round(value).toLocaleString() + ' KRW', '']}
                            />
                            <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em' }} />
                            <Line type="monotone" dataKey="orderAmount" name="발주 금액" stroke="#386ed9" strokeWidth={4} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                            <Line type="monotone" dataKey="confirmedAmount" name="확정 금액" stroke="#10b981" strokeWidth={4} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                <div className="overflow-x-auto border-t border-slate-50 pt-8 mt-8">
                    <table className="saas-table border-0">
                        <thead className="bg-slate-50/50">
                            <tr>
                                <th className="cursor-pointer hover:text-primary transition-colors text-center" onClick={() => handleSortSummary('key')}>
                                    <div className="flex items-center justify-center gap-2">기간 <SortIcon currentSort={summarySort} targetKey="key" /></div>
                                </th>
                                <th className="text-right cursor-pointer hover:text-primary" onClick={() => handleSortSummary('orderQty')}>
                                    <div className="flex items-center justify-end gap-2">발주수량 <SortIcon currentSort={summarySort} targetKey="orderQty" /></div>
                                </th>
                                <th className="text-right cursor-pointer hover:text-primary" onClick={() => handleSortSummary('confirmedQty')}>
                                    <div className="flex items-center justify-end gap-2">확정수량 <SortIcon currentSort={summarySort} targetKey="confirmedQty" /></div>
                                </th>
                                <th className="text-right cursor-pointer hover:text-primary" onClick={() => handleSortSummary('orderAmount')}>
                                    <div className="flex items-center justify-end gap-2">발주금액 <SortIcon currentSort={summarySort} targetKey="orderAmount" /></div>
                                </th>
                                <th className="text-right cursor-pointer hover:text-primary" onClick={() => handleSortSummary('supplyRate')}>
                                    <div className="flex items-center justify-end gap-2">이행율 <SortIcon currentSort={summarySort} targetKey="supplyRate" /></div>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {aggregatedData.map((row) => (
                                <tr key={row.key} className="hover:bg-slate-50 transition-colors">
                                    <td className="text-center font-bold text-text-primary text-[11px] tracking-tighter uppercase">{row.key}</td>
                                    <td className="text-right text-item-data text-text-secondary">{row.orderQty.toLocaleString()} <span className="text-[10px] opacity-40 ml-1 font-bold">PCS</span></td>
                                    <td className="text-right text-item-data text-success font-bold">{row.confirmedQty.toLocaleString()} <span className="text-[10px] opacity-40 ml-1">PCS</span></td>
                                    <td className="text-right text-item-data text-text-secondary">₩{Math.round(row.orderAmount).toLocaleString()}</td>
                                    <td className="text-right">
                                        <span className={`text-[11px] font-bold px-3 py-1 rounded-full ${row.supplyRate >= 95 ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                                            {row.supplyRate.toFixed(1)}%
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm">
                <div className="px-8 py-8 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-6 bg-slate-50/50">
                    <h3 className="text-section-title text-text-primary font-bold uppercase tracking-tighter">상품별 상세 공급 실적</h3>
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-disabled" size={16} />
                        <input type="text" placeholder="상품명 검색..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-12 pr-6 py-3 border border-slate-200 rounded-2xl text-[11px] font-bold focus:ring-4 focus:ring-primary/10 w-80 outline-none bg-white uppercase tracking-widest" />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="saas-table">
                        <thead>
                            <tr>
                                <th className="w-16"></th>
                                <th className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleSortProduct('name')}>
                                    <div className="flex items-center gap-2">상품명 <SortIcon currentSort={productSort} targetKey="name" /></div>
                                </th>
                                <th className="text-right cursor-pointer hover:text-primary" onClick={() => handleSortProduct('orderQty')}>
                                    <div className="flex items-center justify-end gap-2">발주수량 <SortIcon currentSort={productSort} targetKey="orderQty" /></div>
                                </th>
                                <th className="text-right cursor-pointer hover:text-primary" onClick={() => handleSortProduct('confirmedQty')}>
                                    <div className="flex items-center justify-end gap-2">확정수량 <SortIcon currentSort={productSort} targetKey="confirmedQty" /></div>
                                </th>
                                <th className="text-right cursor-pointer hover:text-primary" onClick={() => handleSortProduct('unpaidQty')}>
                                    <div className="flex items-center justify-end gap-2">미발송 <SortIcon currentSort={productSort} targetKey="unpaidQty" /></div>
                                </th>
                                <th className="text-right cursor-pointer hover:text-primary" onClick={() => handleSortProduct('supplyRate')}>
                                    <div className="flex items-center justify-end gap-2">이행율 <SortIcon currentSort={productSort} targetKey="supplyRate" /></div>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleGroups.map((group) => {
                                const isExpanded = expandedGroups.has(group.name);
                                return (
                                    <React.Fragment key={group.name}>
                                        <tr className={`group/tr cursor-pointer transition-colors ${isExpanded ? 'bg-primary/[0.02]' : 'hover:bg-slate-50'}`} onClick={() => toggleGroup(group.name)}>
                                            <td className="text-center">
                                                {isExpanded ? <ChevronDown size={14} className="mx-auto text-primary" strokeWidth={3} /> : <ChevronRight size={14} className="mx-auto text-text-disabled" strokeWidth={3} />}
                                            </td>
                                            <td>
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 overflow-hidden flex-shrink-0">
                                                        {group.image && <img src={group.image} alt="" className="w-full h-full object-cover" />}
                                                    </div>
                                                    <span className="text-item-main text-text-primary font-bold group-hover/tr:text-primary transition-colors">{group.name}</span>
                                                </div>
                                            </td>
                                            <td className="text-right text-item-data text-text-secondary">{group.orderQty.toLocaleString()}</td>
                                            <td className="text-right text-item-data text-success font-bold">{group.confirmedQty.toLocaleString()}</td>
                                            <td className="text-right text-item-data text-error">{group.unpaidQty.toLocaleString()}</td>
                                            <td className="text-right">
                                                <span className={`text-[11px] font-bold px-3 py-1 rounded-full ${group.supplyRate >= 95 ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                                                    {group.supplyRate.toFixed(1)}%
                                                </span>
                                            </td>
                                        </tr>
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {groupedPerformance.length > visibleCount && (
                    <div className="p-8 text-center border-t border-slate-100">
                        <button onClick={() => setVisibleCount(prev => prev + 20)} className="btn-secondary px-10 py-3 text-[11px] font-bold uppercase tracking-widest">상품 데이터 더보기</button>
                    </div>
                )}
            </div>

            <IncomingUnifiedWidget items={analytics.upcoming} />
        </div>
    );
}

function StatCard({ title, value, unit, icon, isPercent = false, color = 'primary' }: { title: string, value: number, unit: string, icon: React.ReactNode, isPercent?: boolean, color?: string }) {
    const colorClasses: Record<string, string> = {
        primary: 'bg-primary/10 text-primary border-primary/20',
        success: 'bg-success/10 text-success border-success/20',
        warning: 'bg-warning/10 text-warning border-warning/20',
        error: 'bg-error/10 text-error border-error/20'
    };
    return (
        <div className="p-8 border border-slate-100 rounded-3xl group hover:translate-y-[-4px] transition-all duration-300 bg-white shadow-sm">
            <div className={`w-14 h-14 rounded-3xl ${colorClasses[color]} flex items-center justify-center mb-8 border transition-transform group-hover:rotate-6 group-hover:scale-105 shadow-sm`}>
                {icon}
            </div>
            <div>
                <p className="text-caption font-bold text-text-disabled uppercase tracking-[0.3em] mb-2">{title}</p>
                <div className="flex items-baseline gap-2">
                    <h3 className="text-page-title text-text-primary font-bold tracking-tighter">
                        {isPercent ? value.toFixed(1) : Math.round(value / 10000).toLocaleString() + (unit === 'KRW' ? '만' : '')}
                    </h3>
                    <span className="text-[10px] font-bold text-text-disabled uppercase tracking-widest opacity-40">{unit}</span>
                </div>
            </div>
        </div>
    );
}

function IncomingUnifiedWidget({ items }: { items: any[] }) {
    const timelineData = useMemo(() => {
        const groups: Record<string, any[]> = {};
        (items || []).forEach(o => {
            const dateKey = o.order_date;
            if (!groups[dateKey]) groups[dateKey] = [];
            
            const existing = groups[dateKey].find(item => item.name === o.prod_name);
            if (existing) {
                existing.confirmed_qty += o.confirmed_qty;
            } else {
                groups[dateKey].push({ 
                    name: o.prod_name, 
                    confirmed_qty: o.confirmed_qty, 
                    imageUrl: o.prod_image,
                    cost: o.prod_cost
                });
            }
        });
        return Object.entries(groups).map(([date, groupItems]) => {
            const groupQty = groupItems.reduce((sum, item) => sum + Number(item.confirmed_qty || 0), 0);
            const groupCost = groupItems.reduce((sum, item) => sum + (Number(item.confirmed_qty || 0) * (item.cost || 0)), 0);
            return { date, items: groupItems, groupQty, groupCost };
        }).sort((a, b) => a.date.localeCompare(b.date));
    }, [items]);

    const summary = useMemo(() => {
        let uniqueBarcodes = new Set((items || []).map(o => o.barcode));
        let qty = (items || []).reduce((sum, o) => sum + o.confirmed_qty, 0);
        let cost = (items || []).reduce((sum, o) => sum + (o.confirmed_qty * (o.prod_cost || 0)), 0);
        return { totalItems: uniqueBarcodes.size, totalQty: qty, totalCost: cost };
    }, [items]);

    if (!items || items.length === 0) return null;

    return (
        <div className="bg-white p-10 rounded-[2.5rem] relative my-12 overflow-hidden border border-slate-100 shadow-xl shadow-slate-200/40">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(56,110,217,0.03),transparent)] pointer-events-none"></div>
            
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6 relative z-10">
                <div className="flex items-center">
                    <Truck size={24} className="mr-4 text-primary animate-pulse" strokeWidth={2.5} />
                    <div>
                        <h3 className="text-xl font-bold text-text-secondary uppercase tracking-tighter">물류 <span className="text-primary">입고 예정</span> 파이프라인</h3>
                        <p className="text-[10px] text-text-disabled font-bold mt-1 tracking-widest uppercase">실시간 수주 및 입고 대기 현황</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-8 bg-slate-50/80 px-8 py-4 rounded-3xl border border-slate-100">
                    <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-text-disabled uppercase tracking-widest mb-1">입고 품목</span>
                        <span className="text-sm font-bold text-text-primary tracking-tighter">{summary.totalItems.toLocaleString()} <span className="text-[10px] text-text-disabled ml-1">SKU</span></span>
                    </div>
                    <div className="w-px h-8 bg-slate-200"></div>
                    <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-text-disabled uppercase tracking-widest mb-1">총 입고 수량</span>
                        <span className="text-sm font-bold text-primary tracking-tighter">{summary.totalQty.toLocaleString()} <span className="text-[10px] text-text-disabled ml-1">PCS</span></span>
                    </div>
                    <div className="w-px h-8 bg-slate-200"></div>
                    <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-text-disabled uppercase tracking-widest mb-1">총 입고 원가액</span>
                        <span className="text-sm font-bold text-text-primary tracking-tighter">₩{summary.totalCost.toLocaleString()}</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
                {timelineData.map((group) => (
                    <div key={group.date} className="bg-slate-50/50 backdrop-blur-xl p-6 rounded-3xl border border-slate-100 hover:border-primary/30 hover:bg-white transition-all group/row">
                        <div className="flex flex-col mb-6 pb-4 border-b border-slate-100 gap-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] text-text-disabled font-bold uppercase tracking-widest leading-none mb-1">도착 예정</p>
                                    <p className="text-xl font-bold text-text-primary tracking-tighter">{group.date.substring(5, 10).replace('-', '/')} ({new Date(group.date).toLocaleDateString('ko-KR', {weekday: 'short'})})</p>
                                </div>
                                <div className="bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
                                    <span className="text-[11px] font-bold text-primary">{group.items.length} SKU</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 bg-white/50 p-2.5 rounded-2xl border border-slate-100 shadow-sm">
                                <div className="flex flex-col">
                                    <span className="text-[8px] font-bold text-text-disabled uppercase tracking-widest leading-none mb-1">수량</span>
                                    <span className="text-[11px] font-bold text-primary leading-none">{group.groupQty.toLocaleString()} <span className="text-[9px] opacity-40">PCS</span></span>
                                </div>
                                <div className="w-px h-5 bg-slate-200"></div>
                                <div className="flex flex-col">
                                    <span className="text-[8px] font-bold text-text-disabled uppercase tracking-widest leading-none mb-1">원가액</span>
                                    <span className="text-[11px] font-bold text-text-primary leading-none">₩{group.groupCost.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-4">
                            {group.items.map((item, idx) => (
                                <div key={`${item.name}-${idx}`} className="group/card flex items-center gap-4 bg-white p-3 rounded-2xl border border-slate-100/50 hover:bg-slate-50 transition-all cursor-default">
                                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-50 border border-slate-200/60 flex-shrink-0">
                                        {item.imageUrl ? (
                                            <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center opacity-20">
                                                <Package size={20} className="text-text-disabled" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-item-main text-text-primary truncate font-bold">{item.name}</p>
                                        <p className="text-[11px] font-bold text-primary mt-1">+{item.confirmed_qty.toLocaleString()} <span className="text-text-disabled ml-1">PCS</span></p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
