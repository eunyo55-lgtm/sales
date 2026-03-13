import { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import { TrendingUp, Package, CheckCircle, Truck, Calendar, BarChart2, Search } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface OrderStat {
    order_date: string;
    barcode: string;
    order_qty: number;
    confirmed_qty: number;
    received_qty: number;
    unit_cost: number;
    center: string;
}

export default function SupplyStatus() {
    const [orders, setOrders] = useState<OrderStat[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewType, setViewType] = useState<'weekly' | 'monthly'>('weekly');
    const [centerFilter, setCenterFilter] = useState<'ALL' | 'FC' | 'VF164'>('ALL');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadData();

        const handleRefresh = () => loadData();
        window.addEventListener('refresh-order-data', handleRefresh);
        return () => window.removeEventListener('refresh-order-data', handleRefresh);
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const data = await api.getCoupangOrderStats();
            setOrders(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // Filtered orders based on center
    const filteredOrders = useMemo(() => {
        return orders.filter(o => centerFilter === 'ALL' || o.center === centerFilter);
    }, [orders, centerFilter]);

    const aggregatedData = useMemo(() => {
        if (!filteredOrders.length) return [];

        const groups: Record<string, any> = {};

        filteredOrders.forEach(o => {
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
                    receivedAmount: 0
                };
            }

            groups[key].orderQty += o.order_qty;
            groups[key].confirmedQty += o.confirmed_qty;
            groups[key].receivedQty += o.received_qty;
            groups[key].orderAmount += (o.order_qty * o.unit_cost);
            groups[key].confirmedAmount += (o.confirmed_qty * o.unit_cost);
            groups[key].receivedAmount += (o.received_qty * o.unit_cost);
        });

        return Object.values(groups).sort((a: any, b: any) => a.key.localeCompare(b.key)); // ASC for chart
    }, [filteredOrders, viewType]);

    // Descending for table
    const tableData = useMemo(() => [...aggregatedData].reverse(), [aggregatedData]);

    // Product performance analysis
    const productPerformance = useMemo(() => {
        const stats: Record<string, any> = {};
        
        filteredOrders.forEach(o => {
            if (!stats[o.barcode]) {
                stats[o.barcode] = {
                    barcode: o.barcode,
                    orderQty: 0,
                    confirmedQty: 0,
                    receivedQty: 0,
                    orderAmount: 0
                };
            }
            stats[o.barcode].orderQty += o.order_qty;
            stats[o.barcode].confirmedQty += o.confirmed_qty;
            stats[o.barcode].receivedQty += o.received_qty;
            stats[o.barcode].orderAmount += (o.order_qty * o.unit_cost);
        });

        return Object.values(stats)
            .map((s: any) => ({
                ...s,
                supplyRate: s.orderQty > 0 ? (s.confirmedQty / s.orderQty) * 100 : 0,
                receiveRate: s.confirmedQty > 0 ? (s.receivedQty / s.confirmedQty) * 100 : 0
            }))
            .filter(s => s.barcode.includes(searchTerm))
            .sort((a, b) => a.supplyRate - b.supplyRate); // Worst first
    }, [filteredOrders, searchTerm]);

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
                    <div className="flex bg-gray-50 p-1 rounded-lg border border-gray-200">
                        <button
                            onClick={() => setCenterFilter('ALL')}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${centerFilter === 'ALL' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            전체
                        </button>
                        <button
                            onClick={() => setCenterFilter('FC')}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${centerFilter === 'FC' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            FC 전용
                        </button>
                        <button
                            onClick={() => setCenterFilter('VF164')}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${centerFilter === 'VF164' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            VF164 전용
                        </button>
                    </div>

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
                        <LineChart data={aggregatedData}>
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Summary Table */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                        <h3 className="font-bold text-gray-900 flex items-center">
                            <Calendar size={18} className="mr-2 text-gray-500" />
                            기간별 요약 데이터
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-white border-b border-gray-100">
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">기간</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">발주액</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase text-center">공급률</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase text-center">입고율</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {tableData.map((item) => (
                                    <tr key={item.key} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <span className="font-medium text-gray-900">{item.key}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-semibold text-gray-900">{item.orderAmount.toLocaleString()}원</div>
                                            <div className="text-[10px] text-gray-400">수량: {item.orderQty.toLocaleString()}개</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col items-center">
                                                <span className={`text-sm font-bold ${item.confirmedQty / item.orderQty >= 0.9 ? 'text-emerald-600' : 'text-orange-500'}`}>
                                                    {((item.confirmedQty / item.orderQty) * 100).toFixed(1)}%
                                                </span>
                                                <div className="w-16 h-1 bg-gray-100 rounded-full mt-1 overflow-hidden">
                                                    <div 
                                                        className={`h-full ${item.confirmedQty / item.orderQty >= 0.9 ? 'bg-emerald-500' : 'bg-orange-500'}`} 
                                                        style={{ width: `${Math.min(100, (item.confirmedQty / item.orderQty) * 100)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col items-center">
                                                <span className={`text-sm font-bold ${item.receivedQty / (item.confirmedQty || 1) >= 0.95 ? 'text-blue-600' : 'text-gray-500'}`}>
                                                    {((item.receivedQty / (item.confirmedQty || 1)) * 100).toFixed(1)}%
                                                </span>
                                                <div className="w-16 h-1 bg-gray-100 rounded-full mt-1 overflow-hidden">
                                                    <div 
                                                        className="h-full bg-blue-500" 
                                                        style={{ width: `${Math.min(100, (item.receivedQty / (item.confirmedQty || 1)) * 100)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Right: Item Performance Analysis */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                        <h3 className="font-bold text-gray-900 flex items-center mb-3">
                            <TrendingUp size={18} className="mr-2 text-rose-500" />
                            공급 부진 품목 (Top 50)
                        </h3>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                            <input 
                                type="text"
                                placeholder="바코드 검색..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto max-h-[500px]">
                        <div className="divide-y divide-gray-50">
                            {productPerformance.slice(0, 50).map((p: any) => (
                                <div key={p.barcode} className="px-6 py-4 hover:bg-red-50 transition-colors">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-xs font-bold text-gray-800 break-all">{p.barcode}</span>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${p.supplyRate < 50 ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                                            공급 {p.supplyRate.toFixed(1)}%
                                        </span>
                                    </div>
                                    <div className="flex items-center text-[10px] text-gray-500 space-x-3">
                                        <span>발주: {p.orderQty}</span>
                                        <span>확정: {p.confirmedQty}</span>
                                        <span>미공급: {Math.max(0, p.orderQty - p.confirmedQty)}</span>
                                    </div>
                                    <div className="mt-2 w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full ${p.supplyRate < 50 ? 'bg-red-500' : 'bg-orange-500'}`}
                                            style={{ width: `${p.supplyRate}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                            {productPerformance.length === 0 && (
                                <div className="p-10 text-center text-xs text-gray-400">데이터가 없습니다.</div>
                            )}
                        </div>
                    </div>
                </div>
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
