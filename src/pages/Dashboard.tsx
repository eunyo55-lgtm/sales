import { useEffect, useState, useMemo } from 'react';
import { api } from '../lib/api';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { TrendingUp, Trophy, Activity, AlertCircle, Loader2, RefreshCw, Calendar, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { isRedDay } from '../lib/dateUtils';
import { CustomDatePicker } from '../components/CustomDatePicker';

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
    const [showAmountGroups, setShowAmountGroups] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (!loading && data && data.anchorDate) {
            if (!trendStartDate) {
                const d = new Date(data.anchorDate);
                const start = new Date(d);
                start.setDate(d.getDate() - 30);
                const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
                
                setTrendStartDate(startStr);
                setTrendEndDate(data.anchorDate);
                setStartDate(startStr);
                setEndDate(data.anchorDate);
                setCustomTrendData([]);
                api.getDashboardCombinedRankings(startStr, data.anchorDate).then(setCombinedRankings);
            }
        }
    }, [loading, data]);

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
        } catch(e) { 
            console.error("[Dashboard] Rankings load failed:", e); 
            setCombinedRankings([]);
        } finally {
            setLoadingRankings(false);
        }
    };

    const loadData = async () => {
        try {
            const result = await api.getDashboardAnalytics();
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
                <div className="relative">
                    <Loader2 className="animate-spin text-indigo-500 relative z-10" size={64} strokeWidth={2.5}/>
                    <div className="absolute inset-0 bg-indigo-400 blur-xl opacity-30 rounded-full animate-pulse"></div>
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="flex flex-col justify-center items-center h-[calc(100vh-100px)] text-slate-400">
                <div className="bg-white/60 p-10 rounded-3xl border border-white/50 shadow-xl backdrop-blur-md flex flex-col items-center">
                    <AlertCircle size={64} className="mb-6 text-rose-400 drop-shadow-sm" />
                    <h3 className="text-xl font-bold text-slate-700 mb-2">데이터를 불러올 수 없습니다.</h3>
                    <p className="text-sm font-medium">초기 엑셀 데이터를 먼저 업로드해 주세요.</p>
                </div>
            </div>
        );
    }

    const { metrics, anchorDate } = data;

    const StatCard = ({ title, value, amount, sub, icon: Icon, colorTheme, yoyValue }: any) => {
        let yoyEl = null;
        if (yoyValue !== undefined && yoyValue !== null) {
            const diff = value - yoyValue;
            const rate = yoyValue > 0 ? (diff / yoyValue) * 100 : (value > 0 ? 100 : 0);
            const isUp = diff > 0;
            const isDown = diff < 0;

            yoyEl = (
                <div className="mt-3 flex items-center text-sm">
                    <span className="text-slate-400 font-medium">전년도 대비</span>
                    <span className={`ml-2 px-2 py-0.5 rounded-full flex items-center font-bold text-xs ${
                        isUp ? 'bg-emerald-100/80 text-emerald-700' : isDown ? 'bg-rose-100/80 text-rose-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                        {isUp ? <ArrowUpRight size={14} className="mr-0.5" /> : isDown ? <ArrowDownRight size={14} className="mr-0.5" /> : null}
                        {Math.abs(diff).toLocaleString()}건
                        {rate !== 0 && ` (${isUp ? '+' : ''}${rate.toFixed(1)}%)`}
                    </span>
                </div>
            );
        }

        const avgCost = data?.avgCost || 0;
        const totalAmount = amount !== undefined ? amount : Math.round(value * avgCost);

        const themeStyles: any = {
            blue: { gradient: "from-blue-500 to-indigo-600", text: "text-blue-500", bg: "bg-blue-50/50" },
            green: { gradient: "from-teal-400 to-emerald-500", text: "text-emerald-500", bg: "bg-emerald-50/50" },
            yellow: { gradient: "from-orange-400 to-amber-500", text: "text-amber-500", bg: "bg-amber-50/50" }
        };

        const theme = themeStyles[colorTheme] || themeStyles.blue;

        return (
            <div className="group bg-white/70 backdrop-blur-xl p-7 rounded-[24px] border border-slate-200 hover:-translate-y-1.5 transition-all duration-500 ease-out relative overflow-hidden">
                {/* Ambient glow */}
                <div className={`absolute -right-10 -top-10 w-40 h-40 bg-gradient-to-br ${theme.gradient} rounded-full opacity-[0.05] group-hover:opacity-[0.15] blur-3xl transition-opacity duration-500 pointer-events-none`} />
                
                <div className="flex justify-between items-start relative z-10">
                    <div className="flex-1">
                        <h3 className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-2">{title}</h3>
                        <div className="flex items-baseline flex-wrap gap-x-2 gap-y-1">
                            <span className="text-4xl font-extrabold text-slate-800 tracking-tight leading-none">{value.toLocaleString()}</span>
                            <span className="text-sm font-bold text-slate-400">건</span>
                        </div>
                        {avgCost > 0 && (
                            <div className="mt-1.5">
                                <span className={`text-sm font-extrabold bg-clip-text text-transparent bg-gradient-to-r ${theme.gradient}`}>
                                    약 {totalAmount.toLocaleString()}원
                                </span>
                            </div>
                        )}
                        {sub && <p className="text-xs text-slate-400 mt-2 font-medium bg-slate-100/50 inline-block px-2 py-1 rounded-md">{sub}</p>}
                        {yoyEl}
                    </div>
                    <div className={`p-4 rounded-2xl ${theme.bg}`}>
                        <Icon size={28} className={theme.text} strokeWidth={2.5}/>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-8 pb-12">
            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                    title="최신 일자 판매"
                    value={metrics.yesterday}
                    amount={metrics.yesterdayAmount}
                    yoyValue={metrics.yesterdayPrevYear}
                    sub={anchorDate ? `${anchorDate} (FC: ${metrics.fcYesterday?.toLocaleString() || 0} / VF: ${metrics.vfYesterday?.toLocaleString() || 0})` : "데이터 없음"}
                    icon={TrendingUp}
                    colorTheme="blue"
                />
                <StatCard
                    title="주간 판매 누적"
                    value={metrics.weekly}
                    amount={metrics.weeklyAmount}
                    yoyValue={metrics.weeklyPrevYear}
                    sub={`FC: ${metrics.fcWeekly?.toLocaleString() || 0} / VF: ${metrics.vfWeekly?.toLocaleString() || 0}`}
                    icon={Calendar}
                    colorTheme="green"
                />
                <StatCard
                    title="2026 연간 스코어"
                    value={metrics.yearly}
                    amount={metrics.yearlyAmount}
                    yoyValue={metrics.yearlyPrevYear}
                    sub={`${anchorDate ? anchorDate.substring(0, 4) : '올해'}년 누적 실적`}
                    icon={Trophy}
                    colorTheme="yellow"
                />
            </div>

            {/* Daily Trend Chart (Glassmorphism) */}
            <div className="bg-white/70 backdrop-blur-xl p-6 md:p-8 rounded-[24px] border border-slate-200 transition-shadow duration-500">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <h3 className="text-xl font-extrabold text-slate-800 flex items-center bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-indigo-600">
                        <Activity size={22} className="mr-2 text-indigo-500 stroke-[2.5px]" />
                        판매 다이내믹 뷰
                    </h3>
                    <div className="flex items-center bg-white/50 backdrop-blur-sm p-1.5 rounded-full border border-slate-200 gap-2">
                        <CustomDatePicker value={trendStartDate} onChange={setTrendStartDate} disabled={loadingTrend} />
                        <span className="text-slate-300 font-bold px-1">~</span>
                        <CustomDatePicker value={trendEndDate} onChange={setTrendEndDate} disabled={loadingTrend} />
                        <button 
                            onClick={loadTrendData} 
                            disabled={loadingTrend || !trendStartDate || !trendEndDate}
                            className={`p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-full transition-all ml-1 ${loadingTrend ? 'animate-spin' : 'hover:scale-105 active:scale-95'}`}
                        >
                            <RefreshCw size={16} strokeWidth={2.5}/>
                        </button>
                    </div>
                </div>
                <div className="relative h-[380px] w-full">
                    {loadingTrend && (
                        <div className="absolute inset-0 z-10 bg-white/40 backdrop-blur-[2px] rounded-xl flex justify-center items-center">
                            <Loader2 className="animate-spin text-indigo-500" size={40} strokeWidth={2.5} />
                        </div>
                    )}
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={filteredDailyTrends} margin={{ top: 10, right: 10, bottom: 5, left: -20 }}>
                            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                            <XAxis
                                dataKey="date"
                                fontSize={11}
                                fontWeight={600}
                                tickLine={false}
                                axisLine={false}
                                tick={({ x, y, payload }) => (
                                    <text x={x} y={y} dy={20} textAnchor="middle" fill={isRedDay(payload.value) ? "#ef4444" : "#64748b"} fontSize={11}>
                                        {payload.value}
                                    </text>
                                )}
                            />
                            <YAxis fontSize={11} fontWeight={600} tickLine={false} axisLine={false} tick={{fill: '#94a3b8'}} />
                            <Tooltip 
                                contentStyle={{ borderRadius: '16px', border: '1px solid #e2e8f0', backgroundColor: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)', fontWeight: 'bold' }} 
                            />
                            <Legend wrapperStyle={{ paddingTop: '20px', fontWeight: 600, fontSize: '13px' }} iconType="circle"/>
                            <Line type="monotone" dataKey="quantity" name="2026 판매량" stroke="#4f46e5" strokeWidth={4} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 8, strokeWidth: 0 }} />
                            <Line type="monotone" dataKey="prevYearQuantity" name="2025 판매량" stroke="#ec4899" strokeWidth={2.5} strokeDasharray="5 5" dot={{ r: 3, fill: '#ec4899' }} opacity={0.8} />
                            <Line type="monotone" dataKey="prev2YearQuantity" name="2024 판매량" stroke="#f59e0b" strokeWidth={2.5} strokeDasharray="3 3" dot={{ r: 3, fill: '#f59e0b' }} opacity={0.6} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Combined Rankings Row (Unified Best 10) */}
            <div className="bg-white/70 backdrop-blur-xl rounded-[24px] border border-slate-200 flex flex-col h-auto overflow-hidden">
                <div className="px-6 py-5 border-b border-white flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/50">
                    <div className="flex items-center space-x-3">
                        <div className="bg-amber-100 p-2 rounded-xl text-amber-500">
                            <Trophy size={20} className="stroke-[2.5px]"/>
                        </div>
                        <h3 className="text-lg font-extrabold text-slate-800">퍼포먼스 랭킹 보드</h3>
                        <button 
                            onClick={() => setShowAmountGroups(!showAmountGroups)}
                            className={`ml-3 px-4 py-1.5 rounded-full text-xs font-extrabold transition-all duration-300 hover:-translate-y-0.5 ${
                                showAmountGroups 
                                ? 'bg-gradient-to-r from-indigo-500 to-blue-500 text-white' 
                                : 'bg-slate-100 text-slate-600 hover:bg-white border border-slate-200'
                            }`}
                        >
                            {showAmountGroups ? '판매액 옵션 OFF' : '판매액 옵션 ON'}
                        </button>
                    </div>
                    <div className="flex items-center bg-white/60 backdrop-blur-sm p-1.5 rounded-full gap-2 border border-slate-200">
                        <CustomDatePicker value={startDate} onChange={setStartDate} disabled={loadingRankings} />
                        <span className="text-slate-300 font-bold px-1">~</span>
                        <CustomDatePicker value={endDate} onChange={setEndDate} disabled={loadingRankings} />
                        <button 
                            onClick={loadCombinedRankings} 
                            disabled={loadingRankings || !startDate || !endDate}
                            className={`p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition-all ml-1 ${loadingRankings ? 'animate-spin' : ''}`}
                        >
                            <RefreshCw size={14} strokeWidth={2.5}/>
                        </button>
                    </div>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                        <thead className="text-[13px] font-bold text-slate-500 bg-slate-50/80 sticky top-0 backdrop-blur-md">
                            <tr>
                                <th className="px-5 py-4 text-center w-14 tracking-wider uppercase">Rank</th>
                                <th className="px-5 py-4 tracking-wider uppercase">Product</th>
                                <th className="px-5 py-4 text-right cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSort('qty_2y')}>
                                    '24 Quantity {sortKey === 'qty_2y' && (sortDesc ? '▼' : '▲')}
                                </th>
                                <th className="px-5 py-4 text-right cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSort('qty_1y')}>
                                    '25 Quantity {sortKey === 'qty_1y' && (sortDesc ? '▼' : '▲')}
                                </th>
                                <th className="px-5 py-4 text-right cursor-pointer text-indigo-700 hover:text-indigo-900 transition-colors" onClick={() => handleSort('qty_0y')}>
                                    '26 Quantity {sortKey === 'qty_0y' && (sortDesc ? '▼' : '▲')}
                                </th>
                                {showAmountGroups && (
                                    <>
                                        <th className="px-5 py-4 text-right cursor-pointer hover:text-indigo-600 transition-colors border-l border-slate-100" onClick={() => handleSort('amt_2y')}>
                                            '24 Revenue
                                        </th>
                                        <th className="px-5 py-4 text-right cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSort('amt_1y')}>
                                            '25 Revenue
                                        </th>
                                        <th className="px-5 py-4 text-right cursor-pointer text-blue-700 transition-colors" onClick={() => handleSort('amt_0y')}>
                                            '26 Revenue
                                        </th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50/50">
                            {(!loadingRankings && sortedRankings && sortedRankings.length > 0) && (
                                <tr className="bg-indigo-50/80 font-extrabold border-b border-indigo-100 backdrop-blur-sm">
                                    <td colSpan={2} className="px-5 py-3 text-center text-indigo-900 border-r border-indigo-100/50 uppercase tracking-widest text-xs">Total Insights</td>
                                    <td className="px-5 py-3 text-right text-slate-600">{totals.qty_2y.toLocaleString()}건</td>
                                    <td className="px-5 py-3 text-right text-slate-600">{totals.qty_1y.toLocaleString()}건</td>
                                    <td className="px-5 py-3 text-right text-indigo-700 text-[15px]">{totals.qty_0y.toLocaleString()}건</td>
                                    {showAmountGroups && (
                                        <>
                                            <td className="px-5 py-3 text-right text-slate-500 border-l border-indigo-100/50">
                                                {totals.amt_2y > 0 ? totals.amt_2y.toLocaleString() + '원' : '-'}
                                            </td>
                                            <td className="px-5 py-3 text-right text-slate-500">
                                                {totals.amt_1y > 0 ? totals.amt_1y.toLocaleString() + '원' : '-'}
                                            </td>
                                            <td className="px-5 py-3 text-right text-blue-700 text-[15px]">
                                                {totals.amt_0y > 0 ? totals.amt_0y.toLocaleString() + '원' : '-'}
                                            </td>
                                        </>
                                    )}
                                </tr>
                            )}
                            {loadingRankings ? (
                                <tr><td colSpan={8} className="text-center py-16"><Loader2 className="animate-spin text-indigo-500 mx-auto" size={32} strokeWidth={2.5}/></td></tr>
                            ) : displayedRankings && displayedRankings.length > 0 ? displayedRankings.map((item: any, idx: number) => {
                                const yoyDiff = item.qty_0y - item.qty_1y;
                                
                                return (
                                <tr key={item.name} className="group hover:bg-white transition-all bg-slate-50/20 duration-200">
                                    <td className="px-5 py-3.5 text-center border-r border-slate-50">
                                        {idx + 1 <= 3 ? (
                                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-xl text-sm font-extrabold text-white shadow-md ${
                                                idx === 0 ? 'bg-gradient-to-br from-amber-300 to-amber-500 shadow-amber-500/30' : 
                                                idx === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400 shadow-slate-500/30' : 
                                                'bg-gradient-to-br from-orange-300 to-orange-500 shadow-orange-500/30'
                                            }`}>
                                                {idx + 1}
                                            </span>
                                        ) : (
                                            <span className="font-bold text-slate-400">{idx + 1}</span>
                                        )}
                                    </td>
                                    <td className="px-5 py-3.5 border-r border-slate-50 text-sm">
                                        <div className="flex items-center space-x-4">
                                            {item.imageUrl ? (
                                                <img src={item.imageUrl} alt="" className="w-14 h-14 rounded-xl bg-white object-cover flex-none border border-slate-200 group-hover:scale-110 transition-transform duration-300" />
                                            ) : (
                                                <div className="w-14 h-14 rounded-xl bg-slate-100 flex-none border border-slate-100" />
                                            )}
                                            <p className="font-bold text-slate-800 break-words whitespace-normal leading-snug hover:text-indigo-600 transition-colors cursor-pointer">{item.name}</p>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3.5 text-right text-slate-500 font-semibold">{item.qty_2y.toLocaleString()}</td>
                                    <td className="px-5 py-3.5 text-right text-slate-500 font-semibold">{item.qty_1y.toLocaleString()}</td>
                                    <td className="px-5 py-3.5 text-right font-extrabold text-slate-800 text-[15px]">
                                        {item.qty_0y.toLocaleString()}
                                        {yoyDiff !== 0 && (
                                            <div className={`text-xs mt-1 px-1.5 py-0.5 inline-block rounded-md ${yoyDiff > 0 ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'} font-bold`}>
                                                {yoyDiff > 0 ? '▲' : '▼'} {Math.abs(yoyDiff).toLocaleString()}
                                            </div>
                                        )}
                                    </td>
                                    {showAmountGroups && (
                                        <>
                                            <td className="px-5 py-3.5 text-right text-slate-400 font-medium border-l border-slate-50">
                                                {item.cost > 0 ? (item.qty_2y * item.cost).toLocaleString() : '-'}
                                            </td>
                                            <td className="px-5 py-3.5 text-right text-slate-400 font-medium">
                                                {item.cost > 0 ? (item.qty_1y * item.cost).toLocaleString() : '-'}
                                            </td>
                                            <td className="px-5 py-3.5 text-right text-indigo-700 font-bold">
                                                {item.cost > 0 ? (item.qty_0y * item.cost).toLocaleString() : '-'}
                                                {item.cost > 0 && (item.qty_0y - item.qty_1y) !== 0 && (
                                                    <div className={`text-xs mt-1 ${yoyDiff > 0 ? 'text-rose-500' : 'text-blue-500'} font-semibold`}>
                                                        {yoyDiff > 0 ? '▲' : '▼'} {Math.abs((item.qty_0y - item.qty_1y) * item.cost).toLocaleString()}
                                                    </div>
                                                )}
                                            </td>
                                        </>
                                    )}
                                </tr>
                            )}) : (
                                <tr><td colSpan={8} className="text-center py-16 text-slate-400 font-medium">데이터가 없습니다.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {displayLimit < sortedRankings.length && (
                    <div className="flex justify-center p-4 bg-white/50 backdrop-blur-md border-t border-white rounded-b-[24px]">
                        <button 
                            onClick={() => setDisplayLimit(p => p + 10)} 
                            className="group px-6 py-2.5 bg-white border border-slate-200 rounded-full text-sm font-bold text-indigo-600 hover:bg-slate-50 hover:-translate-y-0.5 transition-all flex items-center gap-2"
                        >
                            더 보기 (+10) 
                            <span className="text-slate-400 font-medium text-xs bg-slate-100 px-2 py-0.5 rounded-full group-hover:bg-slate-200 transition-colors">
                                {displayLimit} / {sortedRankings.length}
                            </span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
