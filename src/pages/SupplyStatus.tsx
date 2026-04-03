import { useState, useEffect, useMemo } from 'react';
import React from 'react';
import { api, type ProductStats } from '../lib/api';
import { TrendingUp, Package, CheckCircle, Truck, Calendar, BarChart2, Search, ChevronDown, ChevronRight, ArrowUpDown, Loader2, Activity, Zap } from 'lucide-react';
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
    const [incomingOrders, setIncomingOrders] = useState<any[]>([]);
    const [orders, setOrders] = useState<any[]>([]);
    const [products, setProducts] = useState<ProductStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [viewType, setViewType] = useState<'weekly' | 'monthly'>('weekly');
    const [productPeriod, setProductPeriod] = useState<'week' | 'month' | 'all'>('week');
    const [searchTerm, setSearchTerm] = useState('');
    const [visibleCount, setVisibleCount] = useState(10);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    
    const [summarySort, setSummarySort] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'key', direction: 'desc' });
    const [productSort, setProductSort] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'unpaidQty', direction: 'desc' });

    useEffect(() => {
        loadData();
        const handleRefresh = () => loadData();
        window.addEventListener('refresh-order-data', handleRefresh);
        return () => window.removeEventListener('refresh-order-data', handleRefresh);
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [incomingData, productData] = await Promise.all([
                api.getIncomingOrders(),
                api.getProductStats()
            ]);
            setIncomingOrders(incomingData || []);
            setProducts(productData || []);
            setLoading(false);

            setHistoryLoading(true);
            const historicalData = await api.getCoupangOrderStats(24);
            setOrders(historicalData || []);
            setHistoryLoading(false);
        } catch (e) {
            console.error(e);
            setLoading(false);
            setHistoryLoading(false);
        }
    };

    const barcodeMap = useMemo(() => {
        const map = new Map<string, { name: string, option?: string, image?: string }>();
        products.forEach(p => {
            if (p.barcode) {
                map.set(p.barcode.trim(), { name: p.name, option: p.option, image: p.imageUrl });
            }
        });
        return map;
    }, [products]);

    const aggregatedData = useMemo(() => {
        if (!orders.length) return [];
        const groups: Record<string, any> = {};
        orders.forEach(o => {
            let key = '';
            const d = new Date(o.order_date);
            if (viewType === 'monthly') {
                key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            } else {
                const day = d.getDay();
                const diff = (day >= 5 ? day - 5 : day + 2);
                const fri = new Date(d);
                fri.setDate(d.getDate() - diff);
                const thu = new Date(fri);
                thu.setDate(fri.getDate() + 6);
                key = `${fri.toISOString().split('T')[0]} ~ ${thu.toISOString().split('T')[0]}`;
            }
            if (!groups[key]) {
                groups[key] = { key, orderQty: 0, confirmedQty: 0, receivedQty: 0, orderAmount: 0, confirmedAmount: 0, receivedAmount: 0, unpaidQty: 0, unpaidAmount: 0 };
            }
            const amount = (o.order_qty || 0) * (o.unit_cost || 0);
            const confAmount = (o.confirmed_qty || 0) * (o.unit_cost || 0);
            const recvAmount = (o.received_qty || 0) * (o.unit_cost || 0);
            groups[key].orderQty += (o.order_qty || 0);
            groups[key].confirmedQty += (o.confirmed_qty || 0);
            groups[key].receivedQty += (o.received_qty || 0);
            groups[key].orderAmount += amount;
            groups[key].confirmedAmount += confAmount;
            groups[key].receivedAmount += recvAmount;
            groups[key].unpaidQty += ((o.order_qty || 0) - (o.confirmed_qty || 0));
            groups[key].unpaidAmount += (amount - confAmount);
        });
        let result = Object.values(groups).map((g: any) => ({
            ...g,
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
    }, [orders, viewType, summarySort]);

    const sortedAggregatedData = useMemo(() => [...aggregatedData].sort((a, b) => a.key.localeCompare(b.key)), [aggregatedData]);

    const groupedPerformance = useMemo(() => {
        const nameGroups: Record<string, any> = {};
        let filteredOrders = orders;
        if (productPeriod !== 'all') {
            const latestDateStr = orders.length > 0 ? orders.reduce((max, o) => o.order_date > max ? o.order_date : max, orders[0].order_date) : '';
            if (latestDateStr) {
                const refDate = new Date(latestDateStr);
                const days = productPeriod === 'week' ? 7 : 30;
                const threshold = new Date(refDate);
                threshold.setDate(refDate.getDate() - days);
                const thresholdStr = threshold.toISOString().split('T')[0];
                filteredOrders = orders.filter(o => o.order_date >= thresholdStr);
            }
        }
        filteredOrders.forEach(o => {
            const meta = barcodeMap.get((o.barcode || '').trim());
            const name = meta?.name || o.barcode || 'Unknown';
            const option = meta?.option || '-';
            if (!nameGroups[name]) {
                nameGroups[name] = { name, orderQty: 0, confirmedQty: 0, receivedQty: 0, unpaidQty: 0, orderAmount: 0, confirmedAmount: 0, receivedAmount: 0, unpaidAmount: 0, image: meta?.image, children: {} as Record<string, any> };
            }
            const g = nameGroups[name];
            const amount = (o.order_qty || 0) * (o.unit_cost || 0);
            const confAmount = (o.confirmed_qty || 0) * (o.unit_cost || 0);
            const recvAmount = (o.received_qty || 0) * (o.unit_cost || 0);
            g.orderQty += (o.order_qty || 0);
            g.confirmedQty += (o.confirmed_qty || 0);
            g.receivedQty += (o.received_qty || 0);
            g.orderAmount += amount;
            g.confirmedAmount += confAmount;
            g.receivedAmount += recvAmount;
            g.unpaidQty += ((o.order_qty || 0) - (o.confirmed_qty || 0));
            g.unpaidAmount += (amount - confAmount);
            if (!g.children[o.barcode]) {
                g.children[o.barcode] = { barcode: o.barcode, option, orderQty: 0, confirmedQty: 0, receivedQty: 0, unpaidQty: 0, orderAmount: 0, confirmedAmount: 0, receivedAmount: 0, unpaidAmount: 0 };
            }
            const c = g.children[o.barcode];
            c.orderQty += (o.order_qty || 0);
            c.confirmedQty += (o.confirmed_qty || 0);
            c.receivedQty += (o.received_qty || 0);
            c.orderAmount += amount;
            c.confirmedAmount += confAmount;
            c.receivedAmount += recvAmount;
            c.unpaidQty += ((o.order_qty || 0) - (o.confirmed_qty || 0));
            c.unpaidAmount += (amount - confAmount);
        });
        let result = Object.values(nameGroups).map((g: any) => ({
            ...g,
            supplyRate: g.orderQty > 0 ? (g.confirmedQty / g.orderQty) * 100 : 0,
            receiveRate: g.confirmedQty > 0 ? (g.receivedQty / g.confirmedQty) * 100 : 0,
            children: Object.values(g.children).map((c: any) => ({
                ...c,
                supplyRate: c.orderQty > 0 ? (c.confirmedQty / c.orderQty) * 100 : 0,
                receiveRate: c.confirmedQty > 0 ? (c.receivedQty / c.confirmedQty) * 100 : 0
            }))
        })).filter(g => g.name.toLowerCase().includes(searchTerm.toLowerCase()) || g.children.some((c: any) => (c.barcode || '').includes(searchTerm)));
        result.sort((a: any, b: any) => {
            const valA = a[productSort.key];
            const valB = b[productSort.key];
            if (typeof valA === 'string') return productSort.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            return productSort.direction === 'asc' ? valA - valB : valB - valA;
        });
        return result;
    }, [orders, barcodeMap, searchTerm, productSort, productPeriod]);

    const visibleGroups = useMemo(() => groupedPerformance.slice(0, visibleCount), [groupedPerformance, visibleCount]);

    const toggleGroup = (name: string) => {
        const newExpanded = new Set(expandedGroups);
        if (newExpanded.has(name)) newExpanded.delete(name); else newExpanded.add(name);
        setExpandedGroups(newExpanded);
    };

    if (loading) return (
        <div className="flex flex-col justify-center items-center h-[calc(100vh-200px)]">
            <Loader2 className="animate-spin text-primary mb-4" size={48} strokeWidth={2.5} />
            <p className="text-caption font-bold text-text-disabled uppercase tracking-[0.2em]">공급망 데이터를 동기화 중입니다...</p>
        </div>
    );

    const totalOrderAmount = aggregatedData.reduce((sum, item) => sum + item.orderAmount, 0);
    const totalConfirmedAmount = aggregatedData.reduce((sum, item) => sum + item.confirmedAmount, 0);
    const totalReceivedAmount = aggregatedData.reduce((sum, item) => sum + item.receivedAmount, 0);
    const avgSupplyRate = aggregatedData.length > 0 ? aggregatedData.reduce((sum, item) => sum + (item.orderQty > 0 ? (item.confirmedQty / item.orderQty) : 0), 0) / aggregatedData.length * 100 : 0;

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

    const tableData = aggregatedData;

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

            <div className="p-8 border border-slate-100 rounded-3xl bg-white">
                <h3 className="text-caption font-bold text-text-disabled mb-10 flex items-center">
                    <TrendingUp size={16} className="mr-3 text-primary" strokeWidth={2.5} />
                    공급 이행 파이프라인
                </h3>
                <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={sortedAggregatedData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                            <XAxis dataKey="key" tick={{fontSize: 10, fill: '#94A3B8', fontWeight: 800}} axisLine={false} tickLine={false} />
                            <YAxis tick={{fontSize: 10, fill: '#94A3B8', fontWeight: 800}} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', fontSize: '11px', fontWeight: 'bold' }} />
                            <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: 20, fontSize: 10, fontWeight: 900, textTransform: 'uppercase' }} />
                            <Line name="발주" type="monotone" dataKey="orderQty" stroke="#386ED9" strokeWidth={4} dot={false} activeDot={{ r: 6 }} />
                            <Line name="수주" type="monotone" dataKey="confirmedQty" stroke="#10B981" strokeWidth={4} dot={false} activeDot={{ r: 6 }} />
                            <Line name="입고" type="monotone" dataKey="receivedQty" stroke="#F59E0B" strokeWidth={4} dot={false} activeDot={{ r: 6 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <IncomingUnifiedWidget orders={incomingOrders} barcodeMap={barcodeMap} />

            <div className="p-0 overflow-hidden relative border-0">
                <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="text-card-title text-text-primary tracking-tighter font-semibold flex items-center">
                        <Calendar size={18} className="mr-3 text-primary" strokeWidth={2.5} />
                        주차/월별 입고 요약
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="saas-table">
                        <thead>
                            <tr className="h-[52px] bg-white">
                                <th className="px-8 text-table-header cursor-pointer hover:text-primary transition-colors" onClick={() => handleSortSummary('key')}><div className="flex items-center gap-2">기간 <SortIcon currentSort={summarySort} targetKey="key" /></div></th>
                                <th className="px-4 text-table-header text-right cursor-pointer hover:text-primary" onClick={() => handleSortSummary('orderQty')}><div className="flex items-center justify-end gap-2">발주량 <SortIcon currentSort={summarySort} targetKey="orderQty" /></div></th>
                                <th className="px-4 text-table-header text-right cursor-pointer hover:text-primary" onClick={() => handleSortSummary('confirmedQty')}><div className="flex items-center justify-end gap-2">수주량 <SortIcon currentSort={summarySort} targetKey="confirmedQty" /></div></th>
                                <th className="px-4 text-table-header text-right cursor-pointer hover:text-primary" onClick={() => handleSortSummary('receivedQty')}><div className="flex items-center justify-end gap-2">입고량 <SortIcon currentSort={summarySort} targetKey="receivedQty" /></div></th>
                                <th className="px-4 text-table-header text-primary text-right cursor-pointer bg-primary/[0.02]" onClick={() => handleSortSummary('unpaidQty')}><div className="flex items-center justify-end gap-2">미입고 <SortIcon currentSort={summarySort} targetKey="unpaidQty" /></div></th>
                                <th className="px-4 text-table-header text-right cursor-pointer hover:text-primary" onClick={() => handleSortSummary('orderAmount')}><div className="flex items-center justify-end gap-2">발주금액 <SortIcon currentSort={summarySort} targetKey="orderAmount" /></div></th>
                                <th className="px-8 text-table-header text-center">이행상태</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {tableData.map((item) => (
                                <tr key={item.key} className="hover:bg-slate-50 transition-all duration-200 group">
                                    <td className="px-8 py-5 text-item-data text-text-primary tracking-tighter">{item.key}</td>
                                    <td className="px-4 py-5 text-right text-item-data text-text-secondary">{item.orderQty.toLocaleString()}</td>
                                    <td className="px-4 py-5 text-right text-item-data text-text-secondary">{item.confirmedQty.toLocaleString()}</td>
                                    <td className="px-4 py-5 text-right text-item-data text-success">{item.receivedQty.toLocaleString()}</td>
                                    <td className="px-4 py-5 text-right text-item-data text-primary bg-primary/[0.01]">{item.unpaidQty.toLocaleString()}</td>
                                    <td className="px-4 py-5 text-right text-item-data text-text-secondary tracking-tighter">{Math.round(item.orderAmount / 10000).toLocaleString()}만</td>
                                    <td className="px-8 py-5 text-center">
                                        <div className="flex flex-col items-center gap-1">
                                            <span className={`text-[10px] font-bold uppercase tracking-tighter px-2 py-0.5 rounded-full ${item.supplyRate >= 90 ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>수주 {item.supplyRate.toFixed(0)}%</span>
                                            <span className={`text-[10px] font-bold uppercase tracking-tighter px-2 py-0.5 rounded-full ${item.receiveRate >= 95 ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-text-disabled'}`}>입고 {item.receiveRate.toFixed(0)}%</span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="p-0 border-0 overflow-hidden">
                <div className="px-8 py-8 border-b border-slate-100 bg-slate-50/50 flex flex-col xl:flex-row xl:items-center justify-between gap-8">
                    <div>
                        <h3 className="text-card-title text-text-primary uppercase tracking-tighter font-bold flex items-center">
                            <Zap size={18} className="mr-3 text-primary" strokeWidth={3} />
                            상품별 공급 이행 매트릭스
                        </h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex bg-white p-1 rounded-xl border border-slate-200">
                            {(['week', 'month', 'all'] as const).map(p => (
                                <button key={p} onClick={() => setProductPeriod(p)} className={`px-4 py-1.5 text-[9px] font-bold rounded-lg transition-all uppercase tracking-widest ${productPeriod === p ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-text-disabled hover:text-text-secondary'}`}>
                                    {p === 'week' ? '관심 7일' : p === 'month' ? '관심 30일' : '전체'}
                                </button>
                            ))}
                        </div>
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-disabled" size={14} />
                            <input type="text" placeholder="검색..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-12 pr-6 py-2.5 bg-white border border-slate-200 rounded-2xl text-[11px] font-bold focus:ring-4 focus:ring-primary/10 w-64 outline-none tracking-widest" />
                        </div>
                    </div>
                </div>
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="saas-table border-separate border-spacing-0">
                        <thead className="bg-white sticky top-0 z-40">
                            <tr className="h-[52px]">
                                <th className="px-8 py-3 text-table-header w-16 border-b border-slate-100"></th>
                                <th className="px-4 py-3 text-table-header border-b border-slate-100 min-w-[300px] cursor-pointer hover:text-primary transition-colors" onClick={() => handleSortProduct('name')}><div className="flex items-center gap-2">상품명 <SortIcon currentSort={productSort} targetKey="name" /></div></th>
                                <th className="px-4 py-3 text-table-header text-right border-b border-slate-100 cursor-pointer" onClick={() => handleSortProduct('orderQty')}><div className="flex items-center justify-end gap-2">발주수량 <SortIcon currentSort={productSort} targetKey="orderQty" /></div></th>
                                <th className="px-4 py-3 text-table-header text-right border-b border-slate-100 cursor-pointer" onClick={() => handleSortProduct('confirmedQty')}><div className="flex items-center justify-end gap-2">수주수량 <SortIcon currentSort={productSort} targetKey="confirmedQty" /></div></th>
                                <th className="px-4 py-3 text-table-header text-primary text-right border-b-2 border-primary/20 bg-primary/[0.01] cursor-pointer" onClick={() => handleSortProduct('unpaidQty')}><div className="flex items-center justify-end gap-2">미입고 <SortIcon currentSort={productSort} targetKey="unpaidQty" /></div></th>
                                <th className="px-8 py-3 text-table-header text-center border-b border-slate-100">공급 효율</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {visibleGroups.map((g) => (
                                <React.Fragment key={g.name}>
                                    <tr className={`hover:bg-slate-50 transition-all cursor-pointer group/tr h-[68px] ${expandedGroups.has(g.name) ? 'bg-primary/5' : ''}`} onClick={() => toggleGroup(g.name)}>
                                        <td className="px-8 text-center text-text-disabled group-hover/tr:text-primary">
                                            {expandedGroups.has(g.name) ? <ChevronDown size={14} className="mx-auto" strokeWidth={3} /> : <ChevronRight size={14} className="mx-auto" strokeWidth={3} />}
                                        </td>
                                        <td className="px-4 py-5">
                                            <div className="flex flex-col">
                                                <span className="text-item-main text-text-primary tracking-tighter line-clamp-1 group-hover/tr:text-primary transition-colors">{g.name}</span>
                                                <span className="text-item-sub font-medium text-text-disabled mt-1 opacity-40">{g.children.length} variation items</span>
                                            </div>
                                        </td>
                                        <td className="px-4 text-right text-item-data text-text-secondary">{g.orderQty.toLocaleString()}</td>
                                        <td className="px-4 text-right text-item-data text-text-secondary">{g.confirmedQty.toLocaleString()}</td>
                                        <td className="px-4 text-right text-item-main text-primary bg-primary/[0.01]">{g.unpaidQty.toLocaleString()}</td>
                                        <td className="px-8 text-center">
                                            <span className={`text-[10px] font-bold uppercase tracking-widest ${g.supplyRate < 50 ? 'text-error animate-pulse' : g.supplyRate < 80 ? 'text-warning' : 'text-success'}`}>
                                                {g.supplyRate.toFixed(0)}% 이행 완료
                                            </span>
                                        </td>
                                    </tr>
                                    {expandedGroups.has(g.name) && g.children.map((c: any) => (
                                        <tr key={c.barcode} className="bg-slate-100/30 text-item-sub group/sub h-[52px]">
                                            <td className="px-4"></td>
                                            <td className="px-4 py-3 pl-12">
                                                <div className="flex flex-col">
                                                    <span className="text-text-disabled font-mono tracking-widest leading-none mb-1">{c.barcode}</span>
                                                    <span className="text-text-secondary uppercase tracking-tighter">{c.option}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 text-right text-text-disabled">{c.orderQty.toLocaleString()}</td>
                                            <td className="px-4 text-right text-text-disabled">{c.confirmedQty.toLocaleString()}</td>
                                            <td className="px-4 text-right font-medium text-primary/70">{c.unpaidQty.toLocaleString()}</td>
                                            <td className="px-8 text-center text-text-disabled font-medium uppercase tracking-widest opacity-40">{c.supplyRate.toFixed(0)}% ACC</td>
                                        </tr>
                                    ))}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
                {visibleCount < groupedPerformance.length && (
                    <div className="p-10 bg-slate-50 border-t border-slate-100">
                        <button onClick={() => setVisibleCount(prev => prev + 10)} className="btn-secondary w-full max-w-sm mx-auto font-bold uppercase tracking-[0.3em] h-14">매트릭스 결과 더보기 ({visibleCount} / {groupedPerformance.length})</button>
                    </div>
                )}
            </div>

            {historyLoading && (
                <div className="fixed bottom-10 right-10 bg-slate-900 text-white px-8 py-4 rounded-3xl z-50 flex items-center space-x-4 animate-in slide-in-from-right duration-500 scale-90 border border-white/10">
                    <Loader2 className="animate-spin text-primary" size={20} strokeWidth={3} />
                    <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/80">과거 공급 이력 데이터를 불러오는 중...</span>
                </div>
            )}
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
        <div className="p-8 border border-slate-100 rounded-3xl group hover:translate-y-[-4px] transition-all duration-300 bg-white">
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

function IncomingUnifiedWidget({ orders, barcodeMap }: { orders: any[], barcodeMap: Map<string, any> }) {
    const timelineData = useMemo(() => {
        const groups: Record<string, any[]> = {};
        const kstNow = new Date(Date.now() + (9 * 60 * 60 * 1000));
        kstNow.setHours(0, 0, 0, 0);
        orders.forEach(o => {
            const confirmedQty = Number(o.confirmed_qty || 0);
            const receivedQty = Number(o.received_qty || 0);
            const orderDateStr = (o.order_date || '').replace(/\./g, '-');
            const orderDate = new Date(orderDateStr);
            orderDate.setHours(0, 0, 0, 0);
            if (receivedQty === 0 && confirmedQty >= 1 && orderDate >= kstNow) {
                const dateKey = orderDateStr;
                const meta = barcodeMap.get(o.barcode);
                const name = meta?.name || o.barcode || 'Unknown';
                if (!groups[dateKey]) groups[dateKey] = [];
                const existing = groups[dateKey].find(item => item.name === name);
                if (existing) {
                    existing.confirmed_qty += confirmedQty;
                    existing.details.push({ option: meta?.option || 'Default', qty: confirmedQty, barcode: o.barcode });
                } else {
                    groups[dateKey].push({ ...o, name, confirmed_qty: confirmedQty, imageUrl: meta?.image, details: [{ option: meta?.option || 'Default', qty: confirmedQty, barcode: o.barcode }] });
                }
            }
        });
        return Object.entries(groups).map(([date, items]) => ({ date, items })).sort((a, b) => a.date.localeCompare(b.date));
    }, [orders, barcodeMap]);

    if (timelineData.length === 0) return null;

    return (
        <div className="bg-slate-900 p-12 rounded-[3.5rem] relative my-16 overflow-hidden group/container border-4 border-white/5">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(56,110,217,0.1),transparent)] pointer-events-none"></div>
            <div className="flex items-center justify-between mb-12 relative z-10">
                <h3 className="text-2xl font-bold text-white flex items-center tracking-tighter uppercase">
                    <div className="w-16 h-16 rounded-[2rem] bg-primary/20 flex items-center justify-center mr-6 border border-white/10">
                        <Truck size={32} className="text-primary animate-[pulse_2s_infinite]" strokeWidth={2.5} />
                    </div>
                    물류 <span className="text-primary mx-3">입고 예정</span> 파이프라인
                </h3>
            </div>

            <div className="space-y-8 relative z-10">
                {timelineData.map((group) => (
                    <div key={group.date} className="flex flex-col lg:flex-row lg:items-center gap-10 bg-white/5 backdrop-blur-3xl p-6 rounded-[3rem] border border-white/5 transition-all hover:bg-white/10 hover:border-primary/30 group/row">
                        <div className="lg:w-40 flex-shrink-0 flex lg:flex-col items-center justify-center px-4 py-6 bg-white/5 border border-white/10 rounded-[2.5rem]">
                           <p className="text-[10px] text-white/30 font-bold mb-2">도착 예정</p>
                           <p className="text-3xl font-bold text-white tracking-tighter">{group.date.substring(5, 10).replace('-', '/')}</p>
                           <p className="text-[11px] text-primary font-bold mt-3 uppercase px-4 py-1 bg-primary/20 rounded-full">{new Date(group.date).toLocaleDateString('ko-KR', {weekday: 'short'})}</p>
                        </div>
                        <div className="flex-1 overflow-x-auto pb-6 custom-scrollbar-horizontal flex items-center min-h-[160px]">
                            <div className="flex space-x-8 px-2">
                                {group.items.map((item, idx) => (
                                    <div key={`${item.name}-${idx}`} className="group/card relative flex-shrink-0 bg-white/5 border border-white/5 p-6 rounded-[2.5rem] flex items-center space-x-6 min-w-[320px] max-w-[360px] hover:border-primary/50 transition-all cursor-crosshair">
                                        <div className="w-20 h-20 bg-slate-800 rounded-3xl overflow-hidden flex-shrink-0 border border-white/10 p-1 flex items-center justify-center">
                                            <Package size={32} className="text-white/20" strokeWidth={2.5} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[15px] font-bold text-white uppercase tracking-tighter truncate mb-2">{item.name}</p>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                   <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                                                </div>
                                                <span className="text-[18px] font-bold text-primary bg-primary/10 px-4 py-1 rounded-[1.2rem] border border-primary/20 tracking-tighter">
                                                    +{item.confirmed_qty.toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="invisible group-hover/card:visible absolute bottom-full left-0 mb-8 z-[100] bg-white text-slate-900 p-8 rounded-[3rem] min-w-[320px] animate-in slide-in-from-bottom-2 duration-300 pointer-events-none border border-slate-100">
                                            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                                                <p className="text-[11px] font-bold text-primary uppercase tracking-[0.3em] flex items-center"><Truck size={14} className="mr-3" strokeWidth={3} /> 화물 상세 정보</p>
                                                <div className="bg-slate-100 px-3 py-1 rounded-full text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.details.length}개 옵션</div>
                                            </div>
                                            <div className="space-y-3 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                                                {item.details.map((d: any, dIdx: number) => (
                                                    <div key={dIdx} className="flex justify-between items-center text-[12px] py-1">
                                                        <span className="text-slate-500 font-bold uppercase tracking-tight truncate max-w-[180px]">{d.option}</span>
                                                        <span className="font-bold text-slate-900 ml-4 tracking-tighter">+{d.qty.toLocaleString()}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="mt-6 pt-6 border-t border-slate-100 flex justify-between items-baseline">
                                                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-widest">전체 합계</span>
                                                <span className="text-3xl font-bold text-slate-900 tracking-tighter">{item.confirmed_qty.toLocaleString()}<span className="text-[12px] ml-1 opacity-20 uppercase">개</span></span>
                                            </div>
                                            <div className="absolute top-full left-14 w-0 h-0 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent border-t-[15px] border-t-white"></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            <div className="mt-16 pt-8 flex flex-col items-center opacity-10">
                <p className="text-[10px] font-bold tracking-[1em] text-white uppercase">자동화된 물류 관리 매트릭스</p>
            </div>
        </div>
    );
}
