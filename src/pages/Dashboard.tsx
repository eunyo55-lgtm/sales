import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { TrendingUp, Calendar, Trophy, Activity, AlertCircle, Package, Loader2 } from 'lucide-react';
import { isRedDay } from '../lib/dateUtils';

export default function Dashboard() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 60000); // 1 min refresh
        return () => clearInterval(interval);
    }, []);

    const loadData = async () => {
        try {
            const result = await api.getDashboardAnalytics();
            console.log("Dashboard Data:", result);
            setData(result);
        } catch (error) {
            console.error("Failed to load dashboard data", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-[calc(100vh-100px)]">
                <Loader2 className="animate-spin text-blue-500" size={48} />
            </div>
        );
    }

    if (!data) {
        return (
            <div className="flex flex-col justify-center items-center h-[calc(100vh-100px)] text-gray-400">
                <AlertCircle size={48} className="mb-4" />
                <p>데이터를 불러올 수 없습니다.</p>
                <p className="text-sm">엑셀 파일을 업로드해주세요.</p>
            </div>
        );
    }

    const { metrics, trends, rankings, anchorDate } = data;

    const StatCard = ({ title, value, sub, icon: Icon, colorClass }: any) => (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
                <h3 className="text-gray-500 text-sm font-medium mb-1">{title}</h3>
                <div className="flex items-baseline space-x-2">
                    <p className="text-3xl font-bold text-gray-900">{value.toLocaleString()}</p>
                    <span className="text-sm font-normal text-gray-400">건</span>
                </div>
                {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
            </div>
            <div className={`p-3 rounded-full ${colorClass}`}>
                <Icon size={24} />
            </div>
        </div>
    );

    const RankingList = ({ title, items, icon: Icon }: any) => (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col h-full">
            <div className="p-4 border-b border-gray-50 flex items-center space-x-2">
                <Icon size={18} className="text-gray-400" />
                <h3 className="font-bold text-gray-800">{title}</h3>
            </div>
            <div className="flex-1 overflow-auto p-2">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 bg-gray-50">
                        <tr>
                            <th className="px-3 py-2 text-center w-12">순위</th>
                            <th className="px-3 py-2">상품명</th>
                            <th className="px-3 py-2 text-right">판매량</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {items.length > 0 ? items.map((item: any) => (
                            <tr key={item.barcode} className="hover:bg-gray-50">
                                <td className="px-3 py-3 text-center font-medium text-gray-600">
                                    {item.rank <= 3 ? (
                                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs text-white ${item.rank === 1 ? 'bg-yellow-400' : item.rank === 2 ? 'bg-gray-400' : 'bg-orange-400'
                                            }`}>
                                            {item.rank}
                                        </span>
                                    ) : item.rank}
                                </td>
                                <td className="px-3 py-3">
                                    <div className="flex items-center space-x-3">
                                        {item.imageUrl ? (
                                            <img src={item.imageUrl} alt="" className="w-8 h-8 rounded bg-gray-100 object-cover flex-none" />
                                        ) : (
                                            <div className="w-8 h-8 rounded bg-gray-100 flex-none" />
                                        )}
                                        <div className="min-w-0">
                                            <p className="font-medium text-gray-900 truncate" title={item.name}>{item.name}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-3 py-3 text-right font-bold text-gray-900">
                                    {item.quantity.toLocaleString()}
                                    {item.trend !== undefined && item.trend !== null && (
                                        <div className={`text-xs ${item.trend > 0 ? 'text-red-500' : item.trend < 0 ? 'text-blue-500' : 'text-gray-400'}`}>
                                            {item.trend > 0 ? '▲' : item.trend < 0 ? '▼' : '-'} {Math.abs(item.trend).toLocaleString()}
                                        </div>
                                    )}
                                </td>
                            </tr>
                        )) : (
                            <tr><td colSpan={3} className="text-center py-10 text-gray-400">데이터 없음</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    return (
        <div className="space-y-6 pb-10 relative">
            {/* Top Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard
                    title="최신 일자 판매량"
                    value={metrics.yesterday}
                    sub={anchorDate ? `${anchorDate} 기준 (FC: ${metrics.fcYesterday?.toLocaleString() || 0} / VF: ${metrics.vfYesterday?.toLocaleString() || 0})` : "데이터 없음"}
                    icon={TrendingUp}
                    colorClass="bg-blue-50 text-blue-600"
                />
                <StatCard
                    title="주간 판매량 (금~목)"
                    value={metrics.weekly}
                    sub={`FC: ${metrics.fcWeekly?.toLocaleString() || 0} / VF: ${metrics.vfWeekly?.toLocaleString() || 0}`}
                    icon={Calendar}
                    colorClass="bg-green-50 text-green-600"
                />
                <StatCard
                    title="연간 판매량 (올해)"
                    value={metrics.yearly}
                    sub={`${anchorDate ? anchorDate.substring(0, 4) : '올해'}년 누적`}
                    icon={Trophy}
                    colorClass="bg-yellow-50 text-yellow-600"
                />
            </div>
            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Daily Trend */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-[350px]">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center">
                        <Activity size={18} className="mr-2 text-blue-500" />
                        일별 판매 추이 (최근 30일)
                    </h3>
                    <ResponsiveContainer width="100%" height="90%">
                        <LineChart data={trends.daily} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                            <CartesianGrid stroke="#f0f0f0" vertical={false} />
                            <XAxis
                                dataKey="date"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tick={({ x, y, payload }) => (
                                    <text x={x} y={y} dy={16} textAnchor="middle" fill={isRedDay(payload.value) ? "#dc2626" : "#666"} fontSize={12}>
                                        {payload.value}
                                    </text>
                                )}
                            />
                            <YAxis fontSize={12} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                            <Legend />
                            <Line type="monotone" dataKey="quantity" name="판매량" stroke="#3b82f6" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Weekly Trend */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-[350px]">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center">
                        <Calendar size={18} className="mr-2 text-green-500" />
                        주간 판매 추이 (최근 12주)
                    </h3>
                    <ResponsiveContainer width="100%" height="90%">
                        <BarChart data={trends.weekly} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                            <CartesianGrid stroke="#f0f0f0" vertical={false} />
                            <CartesianGrid stroke="#f0f0f0" vertical={false} />
                            <XAxis
                                dataKey="date"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tick={({ x, y, payload }) => (
                                    <text x={x} y={y} dy={16} textAnchor="middle" fill={isRedDay(payload.value) ? "#dc2626" : "#666"} fontSize={12}>
                                        {payload.value}
                                    </text>
                                )}
                            />
                            <YAxis fontSize={12} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} cursor={{ fill: '#f3f4f6' }} />
                            <Legend />
                            <Bar dataKey="quantity" name="주간 판매량" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Rankings Row */}
            {/* Rankings Row - 2x2 Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 h-auto">
                <RankingList title="🔥 최신 일자 베스트 10" items={rankings.yesterday} icon={TrendingUp} />
                <RankingList title="📅 주간 베스트 10" items={rankings.weekly} icon={Calendar} />
                <RankingList title="🏆 연간 베스트 10 (누적)" items={rankings.yearly} icon={Trophy} />
                <RankingList title="📦 쿠팡 재고 보유 상위 10" items={rankings.inventory} icon={Package} />
            </div>
        </div>
    );
}
