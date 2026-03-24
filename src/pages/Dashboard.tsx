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

    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [trendStartDate, setTrendStartDate] = useState<string>('');
    const [trendEndDate, setTrendEndDate] = useState<string>('');
    const [customTrendData, setCustomTrendData] = useState<any[]>([]);
    const [loadingTrend, setLoadingTrend] = useState(false);
    const [combinedRankings, setCombinedRankings] = useState<any[]>([]);
    const [loadingRankings, setLoadingRankings] = useState(false);
    const [sortKey, setSortKey] = useState<'qty_0y'|'qty_1y'|'qty_2y'|'trend'|'amt_0y'|'amt_1y'|'amt_2y'>('qty_0y');
    const [sortDesc, setSortDesc] = useState(true);
    const [displayLimit, setDisplayLimit] = useState(10);

    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 60000); // 1 min refresh
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!loading && data && data.anchorDate) {
            // Initial load only if trend dates are not set
            if (!trendStartDate) {
                const d = new Date(data.anchorDate);
                const start = new Date(d);
                start.setDate(d.getDate() - 30);
                const startStr = start.toISOString().split('T')[0];
                
                setTrendStartDate(startStr);
                setTrendEndDate(data.anchorDate);
                setStartDate(startStr);
                setEndDate(data.anchorDate);

                // Start initial data fetch
                api.getCustomDailySalesTrend(startStr, data.anchorDate).then(setCustomTrendData);
                api.getDashboardCombinedRankings(startStr, data.anchorDate).then(setCombinedRankings);
            }
        }
    }, [loading, data]); // Only run when main data is ready or anchorDate changes

    const loadTrendData = async () => {
        setLoadingTrend(true);
        try {
            const trend = await api.getCustomDailySalesTrend(trendStartDate, trendEndDate);
            setCustomTrendData(trend);
        } catch(e) {
            console.error(e);
        } finally {
            setLoadingTrend(false);
        }
    };

    const loadCombinedRankings = async () => {
        if (!startDate || !endDate) return;
        setLoadingRankings(true);
        setDisplayLimit(10);
        try {
            const list = await api.getDashboardCombinedRankings(startDate, endDate);
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

    const handleSort = (key: 'qty_0y'|'qty_1y'|'qty_2y'|'trend'|'amt_0y'|'amt_1y'|'amt_2y') => {
        if (sortKey === key) {
            setSortDesc(!sortDesc);
        } else {
            setSortKey(key);
            setSortDesc(true);
        }
    };

    const sortedRankings = useMemo(() => {
        const sorted = [...combinedRankings].sort((a, b) => {
            let vA = 0;
            let vB = 0;
            if (sortKey.startsWith('amt_')) {
                const qtyKey = sortKey.replace('amt_', 'qty_');
                vA = (a[qtyKey] || 0) * (a.cost || 0);
                vB = (b[qtyKey] || 0) * (b.cost || 0);
            } else {
                vA = a[sortKey] || 0;
                vB = b[sortKey] || 0;
            }
            return sortDesc ? vB - vA : vA - vB;
        });
        return sorted;
    }, [combinedRankings, sortKey, sortDesc]);

    const displayedRankings = useMemo(() => {
        return sortedRankings.slice(0, displayLimit);
    }, [sortedRankings, displayLimit]);

    const filteredDailyTrends = useMemo(() => {
        // Use custom loaded trend data if available, otherwise fallback to initial data
        if (customTrendData && customTrendData.length > 0) return customTrendData;
        return data?.trends?.daily || [];
    }, [data, customTrendData]);

    const totals = useMemo(() => {
        return sortedRankings.reduce((acc, curr) => {
            acc.qty_0y += curr.qty_0y || 0;
            acc.qty_1y += curr.qty_1y || 0;
            acc.qty_2y += curr.qty_2y || 0;
            acc.amt_0y += (curr.qty_0y || 0) * (curr.cost || 0);
            acc.amt_1y += (curr.qty_1y || 0) * (curr.cost || 0);
            acc.amt_2y += (curr.qty_2y || 0) * (curr.cost || 0);
            return acc;
        }, { qty_0y: 0, qty_1y: 0, qty_2y: 0, amt_0y: 0, amt_1y: 0, amt_2y: 0 });
    }, [sortedRankings]);

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

    const { metrics, anchorDate } = data;

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
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-[350px] flex flex-col">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                        <h3 className="font-bold text-gray-800 flex items-center">
                            <Activity size={18} className="mr-2 text-blue-500" />
                            일별 판매 추이
                        </h3>
                        <div className="flex items-center space-x-2 text-sm bg-gray-50 p-1.5 rounded-lg border border-gray-200">
                            <input 
                                type="date" 
                                title="시작일"
                                value={trendStartDate} 
                                onChange={e => setTrendStartDate(e.target.value)}
                                className="bg-transparent border-none text-gray-700 outline-none text-sm p-1 appearance-none [&::-webkit-calendar-picker-indicator]:opacity-50 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:scale-90"
                                style={{ WebkitAppearance: 'none' }}
                            />
                            <span className="text-gray-400">~</span>
                            <input 
                                type="date" 
                                title="종료일"
                                value={trendEndDate} 
                                onChange={e => setTrendEndDate(e.target.value)}
                                className="bg-transparent border-none text-gray-700 outline-none text-sm p-1 appearance-none [&::-webkit-calendar-picker-indicator]:opacity-50 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:scale-90"
                                style={{ WebkitAppearance: 'none' }}
                            />
                            <button 
                                onClick={loadTrendData} 
                                disabled={loadingTrend || !trendStartDate || !trendEndDate}
                                className={`p-1.5 text-gray-400 hover:text-blue-500 transition-colors ml-1 ${loadingTrend ? 'animate-spin' : ''}`}
                            >
                                <RefreshCw size={16} />
                            </button>
                        </div>
                    </div>
                    <div className="relative flex-1 min-h-0">
                        {loadingTrend && (
                            <div className="absolute inset-0 z-10 bg-white/50 flex justify-center items-center">
                                <Loader2 className="animate-spin text-blue-500" size={32} />
                            </div>
                        )}
                        <ResponsiveContainer width="100%" height="100%" className="-ml-4">
                            <LineChart data={filteredDailyTrends} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
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
                                <Line type="monotone" dataKey="sales" name="26년 판매량" stroke="#3b82f6" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                                <Line type="monotone" dataKey="prevYearQuantity" name="25년 판매량" stroke="#a855f7" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 2 }} opacity={0.7} />
                                <Line type="monotone" dataKey="prev2YearQuantity" name="24년 판매량" stroke="#f59e0b" strokeWidth={2} strokeDasharray="3 3" dot={{ r: 2 }} opacity={0.5} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Combined Rankings Row (Unified Best 10) */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col h-auto">
                <div className="p-4 border-b border-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center space-x-2">
                        <Trophy size={18} className="text-yellow-500" />
                        <h3 className="font-bold text-gray-800">판매베스트</h3>
                    </div>
                    <div className="flex items-center space-x-2 text-sm bg-gray-50 p-1.5 rounded-lg border border-gray-200">
                        <input 
                            type="date" 
                            title="시작일"
                            value={startDate} 
                            onChange={e => setStartDate(e.target.value)}
                            className="bg-transparent border-none text-gray-700 outline-none text-sm p-1 appearance-none [&::-webkit-calendar-picker-indicator]:opacity-50 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:scale-90"
                            style={{ WebkitAppearance: 'none' }}
                            disabled={loadingRankings}
                        />
                        <span className="text-gray-400">~</span>
                        <input 
                            type="date" 
                            title="종료일"
                            value={endDate} 
                            onChange={e => setEndDate(e.target.value)}
                            className="bg-transparent border-none text-gray-700 outline-none text-sm p-1 appearance-none [&::-webkit-calendar-picker-indicator]:opacity-50 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:scale-90"
                            style={{ WebkitAppearance: 'none' }}
                            disabled={loadingRankings}
                        />
                        <button 
                            onClick={loadCombinedRankings} 
                            disabled={loadingRankings || !startDate || !endDate}
                            className={`p-1.5 text-gray-400 hover:text-blue-500 transition-colors ml-1 ${loadingRankings ? 'animate-spin' : ''}`}
                        >
                            <RefreshCw size={16} />
                        </button>
                    </div>
                </div>
                
                <div className="overflow-x-auto p-2">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                        <thead className="text-xs text-gray-500 bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-center w-12 border-r border-gray-100">순위</th>
                                <th className="px-4 py-3 border-r border-gray-100 min-w-[200px]">상품명</th>
                                <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100" onClick={() => handleSort('qty_2y')}>
                                    24년 판매량 {sortKey === 'qty_2y' && (sortDesc ? '▼' : '▲')}
                                </th>
                                <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100" onClick={() => handleSort('qty_1y')}>
                                    25년 판매량 {sortKey === 'qty_1y' && (sortDesc ? '▼' : '▲')}
                                </th>
                                <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100 border-r border-gray-100" onClick={() => handleSort('qty_0y')}>
                                    26년 판매량 {sortKey === 'qty_0y' && (sortDesc ? '▼' : '▲')}
                                </th>
                                <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100" onClick={() => handleSort('amt_2y')}>
                                    24년 판매액 {sortKey === 'amt_2y' && (sortDesc ? '▼' : '▲')}
                                </th>
                                <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100" onClick={() => handleSort('amt_1y')}>
                                    25년 판매액 {sortKey === 'amt_1y' && (sortDesc ? '▼' : '▲')}
                                </th>
                                <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100 text-blue-600" onClick={() => handleSort('amt_0y')}>
                                    26년 판매액 {sortKey === 'amt_0y' && (sortDesc ? '▼' : '▲')}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loadingRankings ? (
                                <tr><td colSpan={8} className="text-center py-10"><Loader2 className="animate-spin text-blue-500 mx-auto" size={24} /></td></tr>
                            ) : displayedRankings && displayedRankings.length > 0 ? displayedRankings.map((item: any, idx: number) => {
                                const yoyDiff = item.qty_0y - item.qty_1y;
                                
                                return (
                                <tr key={item.name} className="hover:bg-gray-50 transition-colors border-b border-gray-50">
                                    <td className="px-4 py-3 text-center font-medium text-gray-600 border-r border-gray-100">
                                        {idx + 1 <= 3 ? (
                                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white ${idx === 0 ? 'bg-yellow-400' : idx === 1 ? 'bg-gray-400' : 'bg-orange-400'}`}>
                                                {idx + 1}
                                            </span>
                                        ) : idx + 1}
                                    </td>
                                    <td className="px-4 py-3 border-r border-gray-100">
                                        <div className="flex items-center space-x-4">
                                            {item.imageUrl ? (
                                                <img src={item.imageUrl} alt="" className="w-16 h-16 rounded-md bg-gray-100 object-cover flex-none border border-gray-200" />
                                            ) : (
                                                <div className="w-16 h-16 rounded-md bg-gray-100 flex-none border border-gray-200" />
                                            )}
                                            <p className="font-semibold text-gray-800 break-words whitespace-normal leading-snug">{item.name}</p>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right text-gray-600 font-medium">
                                        {(item.qty_2y || 0).toLocaleString()}건
                                    </td>
                                    <td className="px-4 py-3 text-right text-gray-600 font-medium">
                                        {(item.qty_1y || 0).toLocaleString()}건
                                    </td>
                                    <td className="px-4 py-3 text-right text-gray-900 font-bold border-r border-gray-100">
                                        {(item.qty_0y || 0).toLocaleString()}건
                                        {yoyDiff !== 0 && (
                                            <div className={`text-[11px] mt-0.5 ${yoyDiff > 0 ? 'text-red-500' : 'text-blue-500'} font-medium`}>
                                                {yoyDiff > 0 ? '▲' : '▼'} {Math.abs(yoyDiff).toLocaleString()}건
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right text-gray-500 text-xs">
                                        {item.cost > 0 ? (item.qty_2y * item.cost).toLocaleString() + '원' : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-right text-gray-500 text-xs">
                                        {item.cost > 0 ? (item.qty_1y * item.cost).toLocaleString() + '원' : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-right text-blue-600 font-medium text-sm">
                                        {item.cost > 0 ? (item.qty_0y * item.cost).toLocaleString() + '원' : '-'}
                                    </td>
                                </tr>
                            )}) : (
                                <tr><td colSpan={8} className="text-center py-10 text-gray-400">데이터 없음</td></tr>
                            )}
                            {(!loadingRankings && sortedRankings && sortedRankings.length > 0) && (
                                <tr className="bg-gray-100 font-bold border-t-2 border-gray-200">
                                    <td colSpan={2} className="px-4 py-4 text-center text-gray-800 border-r border-gray-200">합계</td>
                                    <td className="px-4 py-4 text-right text-gray-800">
                                        {totals.qty_2y.toLocaleString()}건
                                    </td>
                                    <td className="px-4 py-4 text-right text-gray-800">
                                        {totals.qty_1y.toLocaleString()}건
                                    </td>
                                    <td className="px-4 py-4 text-right text-gray-900 border-r border-gray-200 text-base">
                                        {totals.qty_0y.toLocaleString()}건
                                    </td>
                                    <td className="px-4 py-4 text-right text-gray-600">
                                        {totals.amt_2y > 0 ? totals.amt_2y.toLocaleString() + '원' : '-'}
                                    </td>
                                    <td className="px-4 py-4 text-right text-gray-600">
                                        {totals.amt_1y > 0 ? totals.amt_1y.toLocaleString() + '원' : '-'}
                                    </td>
                                    <td className="px-4 py-4 text-right text-blue-600 text-base">
                                        {totals.amt_0y > 0 ? totals.amt_0y.toLocaleString() + '원' : '-'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {displayLimit < sortedRankings.length && (
                    <div className="flex justify-center p-3 bg-gray-50 border-t border-gray-100 rounded-b-xl">
                        <button onClick={() => setDisplayLimit(p => p + 10)} className="px-6 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition-colors">
                            더 보기 (+10) <span className="ml-1 text-gray-400 font-normal">({displayLimit} / {sortedRankings.length})</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
