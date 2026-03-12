import { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import { TrendingUp, Package, CheckCircle, Truck, Calendar } from 'lucide-react';

interface OrderStat {
    order_date: string;
    barcode: string;
    order_qty: number;
    confirmed_qty: number;
    received_qty: number;
    unit_cost: number;
}

export default function SupplyStatus() {
    const [orders, setOrders] = useState<OrderStat[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewType, setViewType] = useState<'weekly' | 'monthly'>('weekly');

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

    const aggregatedData = useMemo(() => {
        if (!orders.length) return [];

        const groups: Record<string, any> = {};

        orders.forEach(o => {
            let key = '';
            const d = new Date(o.order_date);
            
            if (viewType === 'monthly') {
                key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            } else {
                // Weekly: Fri to Thu
                // If day is Fri, Sat, Sun, Mon, Tue, Wed, Thu
                // Day (0=Sun, 5=Fri)
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

        return Object.values(groups).sort((a, b) => b.key.localeCompare(a.key));
    }, [orders, viewType]);

    if (loading) return <div className="p-8 text-center text-gray-500">데이터를 불러오는 중...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div className="flex bg-white p-1 rounded-lg border border-gray-200">
                    <button
                        onClick={() => setViewType('weekly')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${viewType === 'weekly' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        주별 (금~목)
                    </button>
                    <button
                        onClick={() => setViewType('monthly')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${viewType === 'monthly' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        월별
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatCard title="누적 발주액" value={aggregatedData.reduce((sum, item) => sum + item.orderAmount, 0)} unit="원" icon={<Package className="text-blue-500" />} />
                <StatCard title="누적 공급액(확정)" value={aggregatedData.reduce((sum, item) => sum + item.confirmedAmount, 0)} unit="원" icon={<CheckCircle className="text-purple-500" />} />
                <StatCard title="누적 입고액" value={aggregatedData.reduce((sum, item) => sum + item.receivedAmount, 0)} unit="원" icon={<Truck className="text-emerald-500" />} />
                <StatCard 
                    title="평균 공급률" 
                    value={aggregatedData.reduce((sum, item) => sum + (item.orderQty > 0 ? (item.confirmedQty / item.orderQty) * 100 : 0), 0) / (aggregatedData.length || 1)} 
                    unit="%" 
                    icon={<TrendingUp className="text-rose-500" />} 
                    isPercent 
                />
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">기간</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">발주수량</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">확정수량</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">입고수량</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">발주액</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">공급액(확정)</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">입고액</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">공급률</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">입고율</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {aggregatedData.map((item) => (
                                <tr key={item.key} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 flex items-center">
                                        <Calendar size={14} className="mr-2 text-gray-400" />
                                        <span className="font-medium text-gray-900">{item.key}</span>
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">{item.orderQty.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-gray-600">{item.confirmedQty.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-gray-600">{item.receivedQty.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-gray-900 font-semibold">{item.orderAmount.toLocaleString()}원</td>
                                    <td className="px-6 py-4 text-purple-600 font-semibold">{item.confirmedAmount.toLocaleString()}원</td>
                                    <td className="px-6 py-4 text-emerald-600 font-semibold">{item.receivedAmount.toLocaleString()}원</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center">
                                            <div className="w-16 h-2 bg-gray-100 rounded-full mr-2 overflow-hidden">
                                                <div 
                                                    className={`h-full rounded-full ${item.confirmedQty / item.orderQty >= 0.9 ? 'bg-emerald-500' : 'bg-orange-500'}`} 
                                                    style={{ width: `${Math.min(100, (item.confirmedQty / item.orderQty) * 100)}%` }}
                                                />
                                            </div>
                                            <span className="text-sm font-medium">{((item.confirmedQty / item.orderQty) * 100).toFixed(1)}%</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`text-sm font-medium ${item.receivedQty / item.confirmedQty >= 0.95 ? 'text-emerald-600' : 'text-gray-500'}`}>
                                            {((item.receivedQty / (item.confirmedQty || 1)) * 100).toFixed(1)}%
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, unit, icon, isPercent = false }: { title: string, value: number, unit: string, icon: React.ReactNode, isPercent?: boolean }) {
    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-gray-50 rounded-lg">{icon}</div>
            </div>
            <div>
                <p className="text-sm text-gray-500 mb-1">{title}</p>
                <div className="flex items-baseline space-x-1">
                    <h3 className="text-2xl font-bold text-gray-900">
                        {isPercent ? value.toFixed(1) : Math.round(value).toLocaleString()}
                    </h3>
                    <span className="text-sm text-gray-400 font-normal">{unit}</span>
                </div>
            </div>
        </div>
    );
}
