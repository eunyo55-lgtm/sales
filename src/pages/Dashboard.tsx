import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell
} from 'recharts';
import { TrendingUp, Calendar, Trophy, Activity, AlertCircle, Package, Loader2 } from 'lucide-react';
import { isRedDay } from '../lib/dateUtils';

export default function Dashboard() {
    const [data, setData] = useState<any>(null);
    const [insights, setInsights] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 60000); // 1 min refresh
        return () => clearInterval(interval);
    }, []);

    const loadData = async () => {
        try {
            const [result, insightsResult] = await Promise.all([
                api.getDashboardAnalytics(),
                api.getDashboardInsights().catch(() => null)
            ]);
            console.log("Dashboard Data:", result);
            setData(result);
            setInsights(insightsResult);
        } catch (error: any) {
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

    const StatCard = ({ title, value, sub, icon: Icon, colorClass, yoyValue }: any) => {
        let yoyEl = null;
        if (yoyValue !== undefined && yoyValue !== null) {
            const diff = value - yoyValue;
            const rate = yoyValue > 0 ? (diff / yoyValue) * 100 : (value > 0 ? 100 : 0);
            const isUp = diff > 0;
            const isDown = diff < 0;

            yoyEl = (
                <div className={`mt-2 flex items-center text-xs font-medium ${isUp ? 'text-red-500' : isDown ? 'text-blue-500' : 'text-gray-400'}`}>
                    <span>전년 동기대비(요일기준)</span>
                    <span className="ml-1 flex items-center">
                        {isUp ? '▲' : isDown ? '▼' : '-'} {Math.abs(diff).toLocaleString()}건
                        {value > 0 || yoyValue > 0 ? ` (${isUp ? '+' : ''}${rate.toFixed(1)}%)` : ''}
                    </span>
                </div>
            );
        }

        return (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                <div>
                    <h3 className="text-gray-500 text-sm font-medium mb-1">{title}</h3>
                    <div className="flex items-baseline space-x-2">
                        <p className="text-3xl font-bold text-gray-900">{value.toLocaleString()}</p>
                        <span className="text-sm font-normal text-gray-400">건</span>
                    </div>
                    {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
                    {yoyEl}
                </div>
                <div className={`p-3 rounded-full ${colorClass}`}>
                    <Icon size={24} />
                </div>
            </div>
        );
    };

    const RankingList = ({ title, items, icon: Icon, valueLabel = '판매량', showDiff = false }: any) => (
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
                            <th className="px-3 py-2 text-right">{valueLabel}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {items && items.length > 0 ? items.map((item: any, idx: number) => (
                            <tr key={item.barcode || item.name || item.category || idx} className="hover:bg-gray-50">
                                <td className="px-3 py-3 text-center font-medium text-gray-600">
                                    {idx + 1 <= 3 ? (
                                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs text-white ${idx === 0 ? 'bg-yellow-400' : idx === 1 ? 'bg-gray-400' : 'bg-orange-400'
                                            }`}>
                                            {idx + 1}
                                        </span>
                                    ) : idx + 1}
                                </td>
                                <td className="px-3 py-3">
                                    <div className="flex items-center space-x-3">
                                        {item.imageUrl ? (
                                            <img src={item.imageUrl} alt="" className="w-8 h-8 rounded bg-gray-100 object-cover flex-none" />
                                        ) : (
                                            <div className="w-8 h-8 rounded bg-gray-100 flex-none" />
                                        )}
                                        <div className="min-w-0">
                                            <p className="font-medium text-gray-900 truncate" title={item.name || item.category}>{item.name || item.category}</p>
                                            {item.option_value && <p className="text-[10px] text-gray-400 truncate">{item.option_value}</p>}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-3 py-3 text-right font-bold text-gray-900">
                                    {(item.curr_qty || item.quantity || 0).toLocaleString()}건
                                    {(showDiff || item.diff !== undefined) && (
                                        <div className={`text-xs ${item.diff > 0 ? 'text-red-500' : item.diff < 0 ? 'text-blue-500' : 'text-gray-400'}`}>
                                            {item.diff > 0 ? '▲' : item.diff < 0 ? '▼' : '-'} {Math.abs(item.diff).toLocaleString()}
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
                    yoyValue={metrics.yesterdayPrevYear}
                    sub={anchorDate ? `${anchorDate} 기준 (FC: ${metrics.fcYesterday?.toLocaleString() || 0} / VF: ${metrics.vfYesterday?.toLocaleString() || 0})` : "데이터 없음"}
                    icon={TrendingUp}
                    colorClass="bg-blue-50 text-blue-600"
                />
                <StatCard
                    title="주간 판매량 (금~목)"
                    value={metrics.weekly}
                    yoyValue={metrics.weeklyPrevYear}
                    sub={`FC: ${metrics.fcWeekly?.toLocaleString() || 0} / VF: ${metrics.vfWeekly?.toLocaleString() || 0}`}
                    icon={Calendar}
                    colorClass="bg-green-50 text-green-600"
                />
                <StatCard
                    title="연간 판매량 (올해)"
                    value={metrics.yearly}
                    yoyValue={metrics.yearlyPrevYear}
                    sub={`${anchorDate ? anchorDate.substring(0, 4) : '올해'}년 누적`}
                    icon={Trophy}
                    colorClass="bg-yellow-50 text-yellow-600"
                />
            </div>

            {/* Daily Trend Chart */}
            <div className="grid grid-cols-1 gap-6">
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
                            <Line type="monotone" dataKey="quantity" name="판매량 (올해)" stroke="#3b82f6" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                            <Line type="monotone" dataKey="prevYearQuantity" name="판매량 (작년)" stroke="#a855f7" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 2 }} opacity={0.7} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Rankings Row (Best 10) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 h-auto">
                <RankingList title="🔥 최신 일자 베스트 10" items={rankings.yesterday} icon={TrendingUp} />
                <RankingList title="📅 주간 베스트 10" items={rankings.weekly} icon={Calendar} />
                <RankingList title="🏆 연간 베스트 10 (누적)" items={rankings.yearly} icon={Trophy} />
                <RankingList title="📦 쿠팡 재고 보유 상위 10" items={rankings.inventory} icon={Package} />
            </div>

            {/* Category Trend Chart */}
            <div className="grid grid-cols-1 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-[350px]">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center">
                        <Package size={18} className="mr-2 text-purple-500" />
                        카테고리별 전년 대비 성장 현황
                    </h3>
                    <ResponsiveContainer width="100%" height="90%">
                        <BarChart data={insights?.categories || []} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                            <XAxis type="number" fontSize={10} />
                            <YAxis type="category" dataKey="category" fontSize={10} width={80} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="diff" name="증감량" fill="#a855f7" radius={[0, 4, 4, 0]}>
                                {(insights?.categories || []).map((entry: any, index: number) => (
                                    <Cell key={`cell-${index}`} fill={entry.diff >= 0 ? '#10b981' : '#ef4444'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* YoY Winners/Losers (At bottom) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <RankingList title="📈 전년 대비 상승 TOP 10 (Winners)" items={insights?.winners} icon={TrendingUp} showDiff={true} valueLabel="올해 판매" />
                <RankingList title="📉 전년 대비 하락 TOP 10 (Losers)" items={insights?.losers} icon={AlertCircle} showDiff={true} valueLabel="올해 판매" />
            </div>
        </div>
    );
}
