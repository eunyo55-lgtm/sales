import { useState, useEffect, useMemo } from 'react';
import React from 'react';
import { api, type ProductStats } from '../lib/api';
import { TrendingUp, Package, CheckCircle, Truck, Calendar, BarChart2, Search, ChevronDown, ChevronRight, ArrowUpDown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

function SortIcon({ currentSort, targetKey }: { currentSort: { key: string, direction: 'asc' | 'desc' }, targetKey: string }) {
    const isActive = currentSort.key === targetKey;
    return (
        <ArrowUpDown 
            size={12} 
            className={`transition-colors ${isActive ? 'text-blue-600' : 'text-gray-300 opacity-50 hover:opacity-100'}`} 
        />
    );
}

export default function SupplyStatus() {
    const [orders, setOrders] = useState<any[]>([]);
    const [products, setProducts] = useState<ProductStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewType, setViewType] = useState<'weekly' | 'monthly'>('weekly');
    const [productPeriod, setProductPeriod] = useState<'week' | 'month' | 'all'>('week');
    const [searchTerm, setSearchTerm] = useState('');
    const [visibleCount, setVisibleCount] = useState(10);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    
    // Sorting States
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
            const [orderData, productData] = await Promise.all([
                api.getCoupangOrderStats(),
                api.getProductStats()
            ]);
            setOrders(orderData || []);
            setProducts(productData || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
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
                groups[key] = {
                    key,
                    orderQty: 0,
                    confirmedQty: 0,
                    receivedQty: 0,
                    orderAmount: 0,
                    confirmedAmount: 0,
                    receivedAmount: 0,
                    unpaidQty: 0,
                    unpaidAmount: 0
                };
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

        // Apply sorting
        result.sort((a: any, b: any) => {
            const valA = a[summarySort.key];
            const valB = b[summarySort.key];
            if (typeof valA === 'string') {
                return summarySort.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            return summarySort.direction === 'asc' ? valA - valB : valB - valA;
        });

        return result;
    }, [orders, viewType, summarySort]);

    // Trend chart should use time-sequential data
    const sortedAggregatedData = useMemo(() => {
        return [...aggregatedData].sort((a, b) => a.key.localeCompare(b.key));
    }, [aggregatedData]);

    const tableData = useMemo(() => aggregatedData, [aggregatedData]);

    // Product performance analysis grouped by NAME
    const groupedPerformance = useMemo(() => {
        const nameGroups: Record<string, any> = {};
        
        // Filter orders based on productPeriod
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
                nameGroups[name] = {
                    name,
                    orderQty: 0,
                    confirmedQty: 0,
                    receivedQty: 0,
                    unpaidQty: 0,
                    orderAmount: 0,
                    confirmedAmount: 0,
                    receivedAmount: 0,
                    unpaidAmount: 0,
                    image: meta?.image,
                    children: {} as Record<string, any>
                };
            }

            const g = nameGroups[name];
            if (!g.image && meta?.image) g.image = meta?.image;
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
                g.children[o.barcode] = {
                    barcode: o.barcode,
                    option,
                    orderQty: 0,
                    confirmedQty: 0,
                    receivedQty: 0,
                    unpaidQty: 0,
                    orderAmount: 0,
                    confirmedAmount: 0,
                    receivedAmount: 0,
                    unpaidAmount: 0
                };
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

        let result = Object.values(nameGroups)
            .map((g: any) => ({
                ...g,
                supplyRate: g.orderQty > 0 ? (g.confirmedQty / g.orderQty) * 100 : 0,
                receiveRate: g.confirmedQty > 0 ? (g.receivedQty / g.confirmedQty) * 100 : 0,
                children: Object.values(g.children).map((c: any) => ({
                    ...c,
                    supplyRate: c.orderQty > 0 ? (c.confirmedQty / c.orderQty) * 100 : 0,
                    receiveRate: c.confirmedQty > 0 ? (c.receivedQty / c.confirmedQty) * 100 : 0
                }))
            }))
            .filter(g => 
                g.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                g.children.some((c: any) => (c.barcode || '').includes(searchTerm))
            );

        // Apply sorting
        result.sort((a: any, b: any) => {
            const valA = a[productSort.key];
            const valB = b[productSort.key];
            if (typeof valA === 'string') {
                return productSort.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            return productSort.direction === 'asc' ? valA - valB : valB - valA;
        });

        return result;
    }, [orders, barcodeMap, searchTerm, productSort, productPeriod]);

    const visibleGroups = useMemo(() => groupedPerformance.slice(0, visibleCount), [groupedPerformance, visibleCount]);

    const toggleGroup = (name: string) => {
        const newExpanded = new Set(expandedGroups);
        if (newExpanded.has(name)) {
            newExpanded.delete(name);
        } else {
            newExpanded.add(name);
        }
        setExpandedGroups(newExpanded);
    };

    const handleSortSummary = (key: string) => {
        setSummarySort(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const handleSortProduct = (key: string) => {
        setProductSort(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    if (loading) return <div className="p-8 text-center text-gray-500">데이터를 불러오는 중...</div>;

    const totalOrderAmount = aggregatedData.reduce((sum, item) => sum + item.orderAmount, 0);
    const totalConfirmedAmount = aggregatedData.reduce((sum, item) => sum + item.confirmedAmount, 0);
    const totalReceivedAmount = aggregatedData.reduce((sum, item) => sum + item.receivedAmount, 0);
    const avgSupplyRate = aggregatedData.length > 0 
        ? aggregatedData.reduce((sum, item) => sum + (item.orderQty > 0 ? (item.confirmedQty / item.orderQty) : 0), 0) / aggregatedData.length * 100 
        : 0;

    return (
        <div className="space-y-6 pb-20">
            {/* Header & Main Filters */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div className="flex items-center space-x-2">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                        <BarChart2 size={20} />
                    </div>
                    <h1 className="text-xl font-bold text-gray-900">공급/입고 성과 대시보드</h1>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        <button
                            onClick={() => setViewType('weekly')}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${viewType === 'weekly' ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            주차별
                        </button>
                        <button
                            onClick={() => setViewType('monthly')}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${viewType === 'monthly' ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            월별
                        </button>
                    </div>
                </div>
            </div>

            {/* Stat Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatCard title="총 발주액" value={totalOrderAmount} unit="원" icon={<Package className="text-blue-500" />} />
                <StatCard title="확정 공급액" value={totalConfirmedAmount} unit="원" icon={<CheckCircle className="text-purple-500" />} />
                <StatCard title="실 입고액" value={totalReceivedAmount} unit="원" icon={<Truck className="text-emerald-500" />} />
                <StatCard 
                    title="평균 공급률" 
                    value={avgSupplyRate} 
                    unit="%" 
                    icon={<TrendingUp className="text-rose-500" />} 
                    isPercent 
                />
            </div>

            {/* Visualization: Trend Chart */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center">
                        <TrendingUp size={18} className="mr-2 text-blue-500" />
                        수량 기준 공급/입고 트렌드
                    </h3>
                </div>
                <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={sortedAggregatedData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis dataKey="key" tick={{fontSize: 10}} tickMargin={10} />
                            <YAxis tick={{fontSize: 10}} width={40} />
                            <Tooltip 
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                formatter={(value: any) => [Number(value || 0).toLocaleString() + " 개", ""]}
                            />
                            <Legend wrapperStyle={{ paddingTop: 20 }} />
                            <Line name="발주수량" type="monotone" dataKey="orderQty" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                            <Line name="확정수량" type="monotone" dataKey="confirmedQty" stroke="#a855f7" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                            <Line name="입고수량" type="monotone" dataKey="receivedQty" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Summary Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                    <h3 className="font-bold text-gray-900 flex items-center">
                        <Calendar size={18} className="mr-2 text-gray-500" />
                        기간별 요약 데이터
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50/50 border-b border-gray-100">
                            <tr>
                                <th className="px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSortSummary('key')}>
                                    <div className="flex items-center space-x-1">
                                        <span>기간</span>
                                        <SortIcon currentSort={summarySort} targetKey="key" />
                                    </div>
                                </th>
                                <th className="px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSortSummary('orderQty')}>
                                    <div className="flex items-center space-x-1">
                                        <span>발주수량</span>
                                        <SortIcon currentSort={summarySort} targetKey="orderQty" />
                                    </div>
                                </th>
                                <th className="px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSortSummary('confirmedQty')}>
                                    <div className="flex items-center space-x-1">
                                        <span>공급수량</span>
                                        <SortIcon currentSort={summarySort} targetKey="confirmedQty" />
                                    </div>
                                </th>
                                <th className="px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSortSummary('receivedQty')}>
                                    <div className="flex items-center space-x-1">
                                        <span>입고수량</span>
                                        <SortIcon currentSort={summarySort} targetKey="receivedQty" />
                                    </div>
                                </th>
                                <th className="px-4 py-3 font-semibold text-blue-600 cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => handleSortSummary('unpaidQty')}>
                                    <div className="flex items-center space-x-1">
                                        <span>미납수량</span>
                                        <SortIcon currentSort={summarySort} targetKey="unpaidQty" />
                                    </div>
                                </th>
                                <th className="px-4 py-3 font-semibold text-gray-600 text-right cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSortSummary('orderAmount')}>
                                    <div className="flex items-center justify-end space-x-1">
                                        <span>발주액</span>
                                        <SortIcon currentSort={summarySort} targetKey="orderAmount" />
                                    </div>
                                </th>
                                <th className="px-4 py-3 font-semibold text-gray-600 text-right cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSortSummary('confirmedAmount')}>
                                    <div className="flex items-center justify-end space-x-1">
                                        <span>확정액</span>
                                        <SortIcon currentSort={summarySort} targetKey="confirmedAmount" />
                                    </div>
                                </th>
                                <th className="px-4 py-3 font-semibold text-gray-600 text-right cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSortSummary('receivedAmount')}>
                                    <div className="flex items-center justify-end space-x-1">
                                        <span>입고액</span>
                                        <SortIcon currentSort={summarySort} targetKey="receivedAmount" />
                                    </div>
                                </th>
                                <th className="px-4 py-3 font-semibold text-blue-600 text-right cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => handleSortSummary('unpaidAmount')}>
                                    <div className="flex items-center justify-end space-x-1">
                                        <span>미납액</span>
                                        <SortIcon currentSort={summarySort} targetKey="unpaidAmount" />
                                    </div>
                                </th>
                                <th className="px-4 py-3 font-semibold text-gray-600 text-center cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSortSummary('supplyRate')}>
                                    <div className="flex items-center justify-center space-x-1">
                                        <span>공급률</span>
                                        <SortIcon currentSort={summarySort} targetKey="supplyRate" />
                                    </div>
                                </th>
                                <th className="px-4 py-3 font-semibold text-gray-600 text-center cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSortSummary('receiveRate')}>
                                    <div className="flex items-center justify-center space-x-1">
                                        <span>입고율</span>
                                        <SortIcon currentSort={summarySort} targetKey="receiveRate" />
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {tableData.map((item) => (
                                <tr key={item.key} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{item.key}</td>
                                    <td className="px-4 py-3">{item.orderQty.toLocaleString()}</td>
                                    <td className="px-4 py-3">{item.confirmedQty.toLocaleString()}</td>
                                    <td className="px-4 py-3">{item.receivedQty.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-blue-600 font-bold">{item.unpaidQty.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-right">{item.orderAmount.toLocaleString()}원</td>
                                    <td className="px-4 py-3 text-right">{item.confirmedAmount.toLocaleString()}원</td>
                                    <td className="px-4 py-3 text-right">{item.receivedAmount.toLocaleString()}원</td>
                                    <td className="px-4 py-3 text-right text-blue-600 font-bold">{item.unpaidAmount.toLocaleString()}원</td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`px-2 py-1 rounded-md text-xs font-bold ${item.supplyRate >= 90 ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}`}>
                                            {item.supplyRate.toFixed(1)}%
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`px-2 py-1 rounded-md text-xs font-bold ${item.receiveRate >= 95 ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-500'}`}>
                                            {item.receiveRate.toFixed(1)}%
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Product Performance Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <h3 className="font-bold text-gray-900 flex items-center">
                            <TrendingUp size={18} className="mr-2 text-rose-500" />
                            공급 부진 품목 분석 (제품별 그룹)
                        </h3>
                        <div className="flex flex-wrap items-center gap-4">
                            <div className="flex bg-gray-100 p-1 rounded-lg">
                                <button
                                    onClick={() => setProductPeriod('week')}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${productPeriod === 'week' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    주간
                                </button>
                                <button
                                    onClick={() => setProductPeriod('month')}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${productPeriod === 'month' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    월간
                                </button>
                                <button
                                    onClick={() => setProductPeriod('all')}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${productPeriod === 'all' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    누적
                                </button>
                            </div>
                            <div className="relative w-full md:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                <input 
                                    type="text"
                                    placeholder="제품명, 바코드 검색..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                                />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-separate border-spacing-0">
                        <thead className="bg-gray-50/50 border-b border-gray-100 sticky top-0 z-10">
                            <tr>
                                <th className="px-4 py-3 font-semibold text-gray-600 w-10"></th>
                                <th className="px-4 py-3 font-semibold text-gray-600 w-16 text-center">이미지</th>
                                <th className="px-4 py-3 font-semibold text-gray-600 min-w-[200px] cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSortProduct('name')}>
                                    <div className="flex items-center space-x-1">
                                        <span>제품명 / 바코드</span>
                                        <SortIcon currentSort={productSort} targetKey="name" />
                                    </div>
                                </th>
                                <th className="px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSortProduct('orderQty')}>
                                    <div className="flex items-center space-x-1">
                                        <span>발주수량</span>
                                        <SortIcon currentSort={productSort} targetKey="orderQty" />
                                    </div>
                                </th>
                                <th className="px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSortProduct('confirmedQty')}>
                                    <div className="flex items-center space-x-1">
                                        <span>공급수량</span>
                                        <SortIcon currentSort={productSort} targetKey="confirmedQty" />
                                    </div>
                                </th>
                                <th className="px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSortProduct('receivedQty')}>
                                    <div className="flex items-center space-x-1">
                                        <span>입고수량</span>
                                        <SortIcon currentSort={productSort} targetKey="receivedQty" />
                                    </div>
                                </th>
                                <th className="px-4 py-3 font-semibold text-blue-600 cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => handleSortProduct('unpaidQty')}>
                                    <div className="flex items-center space-x-1">
                                        <span>미납수량</span>
                                        <SortIcon currentSort={productSort} targetKey="unpaidQty" />
                                    </div>
                                </th>
                                <th className="px-4 py-3 font-semibold text-gray-600 text-right cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSortProduct('orderAmount')}>
                                    <div className="flex items-center justify-end space-x-1">
                                        <span>발주액</span>
                                        <SortIcon currentSort={productSort} targetKey="orderAmount" />
                                    </div>
                                </th>
                                <th className="px-4 py-3 font-semibold text-gray-600 text-right cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSortProduct('confirmedAmount')}>
                                    <div className="flex items-center justify-end space-x-1">
                                        <span>확정액</span>
                                        <SortIcon currentSort={productSort} targetKey="confirmedAmount" />
                                    </div>
                                </th>
                                <th className="px-4 py-3 font-semibold text-gray-600 text-right cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSortProduct('receivedAmount')}>
                                    <div className="flex items-center justify-end space-x-1">
                                        <span>입고액</span>
                                        <SortIcon currentSort={productSort} targetKey="receivedAmount" />
                                    </div>
                                </th>
                                <th className="px-4 py-3 font-semibold text-blue-600 text-right cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => handleSortProduct('unpaidAmount')}>
                                    <div className="flex items-center justify-end space-x-1">
                                        <span>미납액</span>
                                        <SortIcon currentSort={productSort} targetKey="unpaidAmount" />
                                    </div>
                                </th>
                                <th className="px-4 py-3 font-semibold text-gray-600 text-center cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSortProduct('supplyRate')}>
                                    <div className="flex items-center justify-center space-x-1">
                                        <span>공급률</span>
                                        <SortIcon currentSort={productSort} targetKey="supplyRate" />
                                    </div>
                                </th>
                                <th className="px-4 py-3 font-semibold text-gray-600 text-center cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSortProduct('receiveRate')}>
                                    <div className="flex items-center justify-center space-x-1">
                                        <span>입고율</span>
                                        <SortIcon currentSort={productSort} targetKey="receiveRate" />
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {visibleGroups.map((g) => (
                                <React.Fragment key={g.name}>
                                    <tr 
                                        className={`hover:bg-gray-50 transition-colors cursor-pointer ${expandedGroups.has(g.name) ? 'bg-blue-50/30 font-bold' : ''}`}
                                        onClick={() => toggleGroup(g.name)}
                                    >
                                        <td className="px-4 py-3 text-center">
                                            {expandedGroups.has(g.name) ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                                        </td>
                                        <td className="px-2 py-2 text-center">
                                            <div className="w-12 h-12 bg-gray-50 rounded-lg overflow-hidden flex items-center justify-center border border-gray-100 mx-auto">
                                                {g.image ? (
                                                    <img src={g.image} alt={g.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <Package size={20} className="text-gray-200" />
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 font-bold text-gray-900">{g.name}</td>
                                        <td className="px-4 py-3">{g.orderQty.toLocaleString()}</td>
                                        <td className="px-4 py-3">{g.confirmedQty.toLocaleString()}</td>
                                        <td className="px-4 py-3">{g.receivedQty.toLocaleString()}</td>
                                        <td className="px-4 py-3 text-blue-600 font-bold">{g.unpaidQty.toLocaleString()}</td>
                                        <td className="px-4 py-3 text-right">{g.orderAmount.toLocaleString()}원</td>
                                        <td className="px-4 py-3 text-right">{g.confirmedAmount.toLocaleString()}원</td>
                                        <td className="px-4 py-3 text-right">{g.receivedAmount.toLocaleString()}원</td>
                                        <td className="px-4 py-3 text-right text-blue-600 font-bold">{g.unpaidAmount.toLocaleString()}원</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-1 rounded-md text-xs font-bold ${g.supplyRate < 50 ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                                                {g.supplyRate.toFixed(1)}%
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="px-2 py-1 bg-gray-50 text-gray-500 rounded-md text-xs font-bold">
                                                {g.receiveRate.toFixed(1)}%
                                            </span>
                                        </td>
                                    </tr>
                                    {expandedGroups.has(g.name) && g.children.map((c: any) => (
                                        <tr key={c.barcode} className="bg-gray-50/50 text-[11px] border-b border-gray-100/50">
                                            <td className="px-4 py-2"></td>
                                            <td className="px-4 py-2"></td>
                                            <td className="px-4 py-2 pl-8">
                                                <div className="flex flex-col">
                                                    <span className="text-gray-400 font-mono">{c.barcode}</span>
                                                    <span className="text-gray-600 font-medium">{c.option}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-2 text-gray-500">{c.orderQty.toLocaleString()}</td>
                                            <td className="px-4 py-2 text-gray-500">{c.confirmedQty.toLocaleString()}</td>
                                            <td className="px-4 py-2 text-gray-500">{c.receivedQty.toLocaleString()}</td>
                                            <td className="px-4 py-2 text-blue-500 font-medium">{c.unpaidQty.toLocaleString()}</td>
                                            <td className="px-4 py-2 text-right text-gray-400">{c.orderAmount.toLocaleString()}원</td>
                                            <td className="px-4 py-2 text-right text-gray-400">{c.confirmedAmount.toLocaleString()}원</td>
                                            <td className="px-4 py-2 text-right text-gray-400">{c.receivedAmount.toLocaleString()}원</td>
                                            <td className="px-4 py-2 text-right text-blue-400 font-medium">{c.unpaidAmount.toLocaleString()}원</td>
                                            <td className="px-4 py-2 text-center text-gray-500">{c.supplyRate.toFixed(1)}%</td>
                                            <td className="px-4 py-2 text-center text-gray-500">{c.receiveRate.toFixed(1)}%</td>
                                        </tr>
                                    ))}
                                </React.Fragment>
                            ))}
                            {groupedPerformance.length === 0 && (
                                <tr>
                                    <td colSpan={11} className="px-4 py-10 text-center text-gray-400">데이터가 없습니다.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {visibleCount < groupedPerformance.length && (
                    <div className="p-4 bg-gray-50 border-t border-gray-100 text-center">
                        <button 
                            onClick={() => setVisibleCount(prev => prev + 10)}
                            className="px-6 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
                        >
                            품목 더보기 ({visibleCount} / {groupedPerformance.length})
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

function StatCard({ title, value, unit, icon, isPercent = false }: { title: string, value: number, unit: string, icon: React.ReactNode, isPercent?: boolean }) {
    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
            <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-gray-50 rounded-lg shadow-inner">{icon}</div>
            </div>
            <div>
                <p className="text-xs text-gray-400 font-medium mb-1">{title}</p>
                <div className="flex items-baseline space-x-1">
                    <h3 className="text-2xl font-black text-gray-900 tracking-tight">
                        {isPercent ? value.toFixed(1) : Math.round(value).toLocaleString()}
                    </h3>
                    <span className="text-sm text-gray-400 font-normal">{unit}</span>
                </div>
            </div>
        </div>
    );
}
