import { useEffect, useState, useMemo } from 'react';
import { api } from '../lib/api';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { TrendingUp, Calendar, Trophy, Activity, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { isRedDay } from '../lib/dateUtils';

export default function Dashboard() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const [rankingPeriod, setRankingPeriod] = useState<'daily'|'weekly'|'yearly'>('daily');
    const [combinedRankings, setCombinedRankings] = useState<any[]>([]);
    const [loadingRankings, setLoadingRankings] = useState(false);
    const [sortKey, setSortKey] = useState<'qty_0y'|'qty_1y'|'qty_2y'|'trend'>('qty_0y');
    const [sortDesc, setSortDesc] = useState(true);

    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 60000); // 1 min refresh
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!loading && data) {
            loadCombinedRankings();
        }
    }, [rankingPeriod, loading, data]);

    const loadCombinedRankings = async () => {
        setLoadingRankings(true);
        try {
            const list = await api.getDashboardCombinedRankings(rankingPeriod);
            setCombinedRankings(list); 
        } catch(e) { console.error(e); }
        finally { setLoadingRankings(false); }
    };

    const loadData = async () => {
        try {
            const result = await api.getDashboardAnalytics();
            console.log("Dashboard Data:", result);
            setData(result);
        } catch (error: any) {
            console.error("Failed to load dashboard data", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSort = (key: 'qty_0y'|'qty_1y'|'qty_2y'|'trend') => {
        if (sortKey === key) {
            setSortDesc(!sortDesc);
        } else {
            setSortKey(key);
            setSortDesc(true);
        }
    };

    const sortedRankings = useMemo(() => {
        const sorted = [...combinedRankings].sort((a, b) => {
            const vA = a[sortKey] || 0;
            const vB = b[sortKey] || 0;
            return sortDesc ? vB - vA : vA - vB;
        });
        return sorted.slice(0, 10); // Show only top 10
    }, [combinedRankings, sortKey, sortDesc]);

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

    const { metrics, trends, anchorDate } = data;

    const StatCard = ({ title, value, amount, sub, icon: Icon, colorClass, yoyValue }: any) => {
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

        const avgCost = data?.avgCost || 0;
        const totalAmount = amount !== undefined ? amount : Math.round(value * avgCost);

        return (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                <div>
                    <h3 className="text-gray-500 text-sm font-medium mb-1">{title}</h3>
                    <div className="flex items-baseline space-x-2">
                        <p className="text-3xl font-bold text-gray-900">{value.toLocaleString()}</p>
                        <span className="text-sm font-normal text-gray-400">건</span>
                        {avgCost > 0 && (
                            <span className="text-sm font-bold text-blue-500 ml-2">
                                (약 {totalAmount.toLocaleString()}원)
                            </span>
                        )}
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

    return (
        <div className="space-y-6 pb-10 relative">
            {/* Top Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard
                    title="최신 일자 판매량"
                    value={metrics.yesterday}
                    amount={metrics.yesterdayAmount}
                    yoyValue={metrics.yesterdayPrevYear}
                    sub={anchorDate ? `${anchorDate} 기준 (FC: ${metrics.fcYesterday?.toLocaleString() || 0} / VF: ${metrics.vfYesterday?.toLocaleString() || 0})` : "데이터 없음"}
                    icon={TrendingUp}
                    colorClass="bg-blue-50 text-blue-600"
                />
                <StatCard
                    title="주간 판매량 (금~목)"
                    value={metrics.weekly}
                    amount={metrics.weeklyAmount}
                    yoyValue={metrics.weeklyPrevYear}
                    sub={`FC: ${metrics.fcWeekly?.toLocaleString() || 0} / VF: ${metrics.vfWeekly?.toLocaleString() || 0}`}
                    icon={Calendar}
                    colorClass="bg-green-50 text-green-600"
                />
                <StatCard
                    title="연간 판매량 (올해)"
                    value={metrics.yearly}
                    amount={metrics.yearlyAmount}
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
                            <Line type="monotone" dataKey="prev2YearQuantity" name="판매량 (제작년)" stroke="#f59e0b" strokeWidth={2} strokeDasharray="3 3" dot={{ r: 2 }} opacity={0.5} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Combined Rankings Row (Unified Best 10) */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col h-auto">
                <div className="p-4 border-b border-gray-50 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <Trophy size={18} className="text-yellow-500" />
                        <h3 className="font-bold text-gray-800">통합 베스트 10 (24, 25, 26년 판매량 비교)</h3>
                    </div>
                    <div className="flex items-center space-x-2">
                        <select 
                            className="text-sm border-gray-200 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 pl-3 pr-8 py-1.5"
                            value={rankingPeriod}
                            onChange={(e: any) => setRankingPeriod(e.target.value)}
                            disabled={loadingRankings}
                        >
                            <option value="daily">최신 일자 (Daily)</option>
                            <option value="weekly">주간 (Weekly)</option>
                            <option value="yearly">연간 (Yearly)</option>
                        </select>
                        <button 
                            onClick={loadCombinedRankings} 
                            disabled={loadingRankings}
                            className={`p-1.5 text-gray-400 hover:text-blue-500 transition-colors ${loadingRankings ? 'animate-spin' : ''}`}
                        >
                            <RefreshCw size={16} />
                        </button>
                    </div>
                </div>
                
                <div className="overflow-x-auto p-2">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                        <thead className="text-xs text-gray-500 bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-center w-12">순위</th>
                                <th className="px-4 py-3">상품명</th>
                                <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100" onClick={() => handleSort('qty_2y')}>
                                    24년 판매량 {sortKey === 'qty_2y' && (sortDesc ? '▼' : '▲')}
                                </th>
                                <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100" onClick={() => handleSort('qty_1y')}>
                                    25년 판매량 {sortKey === 'qty_1y' && (sortDesc ? '▼' : '▲')}
                                </th>
                                <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100" onClick={() => handleSort('qty_0y')}>
                                    26년 판매량 {sortKey === 'qty_0y' && (sortDesc ? '▼' : '▲')}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loadingRankings ? (
                                <tr><td colSpan={5} className="text-center py-10"><Loader2 className="animate-spin text-blue-500 mx-auto" size={24} /></td></tr>
                            ) : sortedRankings && sortedRankings.length > 0 ? sortedRankings.map((item: any, idx: number) => {
                                const yoyDiff = item.qty_0y - item.qty_1y;
                                
                                return (
                                <tr key={item.name} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3 text-center font-medium text-gray-600">
                                        {idx + 1 <= 3 ? (
                                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white ${idx === 0 ? 'bg-yellow-400' : idx === 1 ? 'bg-gray-400' : 'bg-orange-400'}`}>
                                                {idx + 1}
                                            </span>
                                        ) : idx + 1}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center space-x-3">
                                            {item.imageUrl ? (
                                                <img src={item.imageUrl} alt="" className="w-8 h-8 rounded bg-gray-100 object-cover flex-none" />
                                            ) : (
                                                <div className="w-8 h-8 rounded bg-gray-100 flex-none" />
                                            )}
                                            <p className="font-medium text-gray-900 truncate max-w-xs">{item.name}</p>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right text-gray-600">
                                        {(item.qty_2y || 0).toLocaleString()}건
                                    </td>
                                    <td className="px-4 py-3 text-right text-gray-600">
                                        {(item.qty_1y || 0).toLocaleString()}건
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-gray-900">
                                        <div>{(item.qty_0y || 0).toLocaleString()}건</div>
                                        {yoyDiff !== 0 && (
                                            <div className={`text-[10px] ${yoyDiff > 0 ? 'text-red-500' : 'text-blue-500'}`}>
                                                {yoyDiff > 0 ? '▲' : '▼'} {Math.abs(yoyDiff).toLocaleString()}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            )}) : (
                                <tr><td colSpan={5} className="text-center py-10 text-gray-400">데이터 없음</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
