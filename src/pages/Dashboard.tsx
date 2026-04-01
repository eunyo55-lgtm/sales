import { useEffect, useState, useMemo } from 'react';
import { api } from '../lib/api';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
    ScatterChart, Scatter, ZAxis, Cell
} from 'recharts';
import { TrendingUp, Trophy, Activity, AlertCircle, Loader2, RefreshCw, Calendar, ArrowUpRight, ArrowDownRight, Archive, Sparkles } from 'lucide-react';
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
    const showAmountGroups = true;

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

    const bubbleData = useMemo(() => {
        return displayedRankings.filter(item => item.qty_0y > 0 || item.qty_1y > 0).map(item => {
            const qty_1y = item.qty_1y || 0;
            const qty_0y = item.qty_0y || 0;
            
            let growth = 0;
            if (qty_1y === 0 && qty_0y > 0) {
                // 작년 판매량 0일때 작은 판매건수는 폭주 방지
                growth = qty_0y <= 10 ? qty_0y * 10 : 500; 
            } else if (qty_1y > 0) {
                growth = ((qty_0y - qty_1y) / qty_1y) * 100;
            }
            
            if (growth > 500) growth = 500;
            if (growth < -100) growth = -100;

            const salesAmount = qty_0y * (item.cost || 0);

            return {
                name: item.name,
                x: qty_1y,
                y: Number(growth.toFixed(1)),
                z: salesAmount,
                salesAmountStr: salesAmount.toLocaleString(),
                qty_0y,
                qty_1y,
                imageUrl: item.imageUrl
            };
        });
    }, [displayedRankings]);

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

    const StatCard = ({ title, value, amount, sub, icon: Icon, yoyValue }: any) => {
        let yoyEl = null;
        if (yoyValue !== undefined && yoyValue !== null) {
            const diff = value - yoyValue;
            const rate = yoyValue > 0 ? (diff / yoyValue) * 100 : (value > 0 ? 100 : 0);
            const isUp = diff > 0;
            const isDown = diff < 0;

            yoyEl = (
                <div className="mt-3 flex items-center text-sm">
                    <span className="text-slate-400 font-medium">전년도 대비</span>
                    <span className={`ml-2 flex items-center font-bold text-sm ${
                        isUp ? 'text-emerald-500' : isDown ? 'text-rose-500' : 'text-slate-400'
                    }`}>
                        {isUp ? <ArrowUpRight size={16} className="mr-0.5" /> : isDown ? <ArrowDownRight size={16} className="mr-0.5" /> : null}
                        {Math.abs(diff).toLocaleString()}건
                        {rate !== 0 && ` (${isUp ? '+' : ''}${rate.toFixed(1)}%)`}
                    </span>
                </div>
            );
        }

        const avgCost = data?.avgCost || 0;
        const totalAmount = amount !== undefined ? amount : Math.round(value * avgCost);

        return (
            <div className="group bg-white/70 backdrop-blur-xl p-7 rounded-[24px] border border-slate-200 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
                <div className="flex justify-between items-start relative z-10">
                    <div className="flex-1">
                        <h3 className="text-slate-400 text-[13px] font-medium uppercase tracking-wide mb-2">{title}</h3>
                        <div className="flex items-baseline flex-wrap gap-x-1.5 gap-y-1">
                            <span className="text-[28px] font-semibold text-slate-700 tracking-tight leading-none">{value.toLocaleString()}</span>
                            <span className="text-sm font-medium text-slate-400">건</span>
                        </div>
                        {avgCost > 0 && (
                            <div className="mt-2">
                                <span className="text-[13px] font-medium text-slate-400">
                                    약 {totalAmount.toLocaleString()}원
                                </span>
                            </div>
                        )}
                        {sub && <p className="text-xs text-slate-400 mt-2 font-medium bg-slate-100/50 inline-block px-2 py-1 rounded-md">{sub}</p>}
                        {yoyEl}
                    </div>
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <Icon size={24} className="text-slate-400" strokeWidth={2}/>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-8 pb-12">
            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                <StatCard
                    title="전일 기준 총 재고"
                    value={metrics.totalStock || 0}
                    amount={metrics.totalStockAmount || 0}
                    sub={`FC: ${(metrics.totalFcStock || 0).toLocaleString()} / VF: ${(metrics.totalVfStock || 0).toLocaleString()}`}
                    icon={Archive}
                    colorTheme="blue"
                />
            </div>

            {/* Daily Trend Chart (Glassmorphism) */}
            <div className="bg-white/70 backdrop-blur-xl p-6 md:p-8 rounded-[24px] border border-slate-200 transition-shadow duration-500">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <h3 className="text-[17px] font-semibold text-slate-700 flex items-center">
                        <Activity size={20} className="mr-2 text-sky-400 stroke-[2.5px]" />
                        판매 다이내믹 뷰
                    </h3>
                    <div className="flex items-center bg-white/50 backdrop-blur-sm p-1.5 rounded-full border border-slate-200 gap-2 relative z-50">
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
                            <Line type="monotone" dataKey="quantity" name="2026 판매량" stroke="#386ed9" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                            <Line type="monotone" dataKey="prevYearQuantity" name="2025 판매량" stroke="#a78bfa" strokeWidth={2} strokeDasharray="5 5" dot={false} opacity={0.8} />
                            <Line type="monotone" dataKey="prev2YearQuantity" name="2024 판매량" stroke="#fbcfe8" strokeWidth={2} strokeDasharray="3 3" dot={false} opacity={0.6} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Combined Rankings Row (Unified Best 10) */}
            <div className="bg-white/70 backdrop-blur-xl rounded-[24px] border border-slate-200 flex flex-col h-auto overflow-hidden">
                <div className="px-6 py-5 border-b border-white flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/50">
                    <div className="flex items-center space-x-3">
                        <div className="bg-sky-50 border border-sky-100 p-2 rounded-xl text-sky-500">
                            <Trophy size={20} className="stroke-[2px]"/>
                        </div>
                        <h3 className="text-[17px] font-semibold text-slate-700">퍼포먼스 랭킹 보드</h3>
                    </div>
                    <div className="flex items-center bg-white/60 backdrop-blur-sm p-1.5 rounded-full gap-2 border border-slate-200 relative z-50">
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
                        <thead className="text-[13px] font-medium text-slate-400 bg-white/50 border-b border-slate-50 sticky top-0 backdrop-blur-md">
                            <tr>
                                <th className="px-5 py-4 text-center w-14 tracking-wider uppercase">순위</th>
                                <th className="px-5 py-4 tracking-wider uppercase">상품명</th>
                                <th className="px-5 py-4 font-semibold text-center w-28 text-slate-400">추세</th>
                                <th className="px-5 py-4 text-right cursor-pointer hover:text-slate-800 transition-colors" onClick={() => handleSort('qty_2y')}>
                                    '24년 판매량 {sortKey === 'qty_2y' && (sortDesc ? '▼' : '▲')}
                                </th>
                                <th className="px-5 py-4 text-right cursor-pointer hover:text-slate-800 transition-colors" onClick={() => handleSort('qty_1y')}>
                                    '25년 판매량 {sortKey === 'qty_1y' && (sortDesc ? '▼' : '▲')}
                                </th>
                                <th className="px-5 py-4 text-right cursor-pointer text-slate-900 font-bold border-l border-slate-100 hover:text-black transition-colors bg-blue-50/30" onClick={() => handleSort('qty_0y')}>
                                    '26년 판매량 {sortKey === 'qty_0y' && (sortDesc ? '▼' : '▲')}
                                </th>
                                <th className="px-5 py-4 font-bold text-center w-36 text-slate-700 bg-slate-50/80 border-l border-slate-100">올해 성장률 (YoY)</th>
                                {showAmountGroups && (
                                    <>
                                        <th className="px-5 py-4 text-right cursor-pointer hover:text-slate-800 transition-colors border-l border-slate-100" onClick={() => handleSort('amt_2y')}>
                                            '24년 판매액
                                        </th>
                                        <th className="px-5 py-4 text-right cursor-pointer hover:text-slate-800 transition-colors" onClick={() => handleSort('amt_1y')}>
                                            '25년 판매액
                                        </th>
                                        <th className="px-5 py-4 text-right cursor-pointer text-slate-900 border-l border-slate-100 hover:text-black transition-colors" onClick={() => handleSort('amt_0y')}>
                                            '26년 판매액
                                        </th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50/50">
                            {(!loadingRankings && sortedRankings && sortedRankings.length > 0) && (
                                <tr className="bg-slate-50/50 font-semibold border-b border-slate-100">
                                    <td colSpan={3} className="px-5 py-3 text-center text-slate-600 border-r border-slate-100 tracking-wide text-xs">전체 합계</td>
                                    <td className="px-5 py-3 text-right text-slate-500 text-[13px]">{totals.qty_2y.toLocaleString()}건</td>
                                    <td className="px-5 py-3 text-right text-slate-500 text-[13px]">{totals.qty_1y.toLocaleString()}건</td>
                                    <td className="px-5 py-3 text-right text-slate-900 font-bold bg-blue-50/20 text-[13px]">{totals.qty_0y.toLocaleString()}건</td>
                                    <td className="px-5 py-3 text-center text-slate-400 bg-slate-50/30 border-l border-slate-100 font-normal text-xs">-</td>
                                    {showAmountGroups && (
                                        <>
                                            <td className="px-5 py-3 text-right text-slate-500 border-l border-slate-200">
                                                {totals.amt_2y > 0 ? totals.amt_2y.toLocaleString() + '원' : '-'}
                                            </td>
                                            <td className="px-5 py-3 text-right text-slate-500">
                                                {totals.amt_1y > 0 ? totals.amt_1y.toLocaleString() + '원' : '-'}
                                            </td>
                                            <td className="px-5 py-3 text-right text-slate-800 text-[14px]">
                                                {totals.amt_0y > 0 ? totals.amt_0y.toLocaleString() + '원' : '-'}
                                            </td>
                                        </>
                                    )}
                                </tr>
                            )}
                            {loadingRankings ? (
                                <tr><td colSpan={10} className="text-center py-16"><Loader2 className="animate-spin text-indigo-500 mx-auto" size={32} strokeWidth={2.5}/></td></tr>
                            ) : displayedRankings && displayedRankings.length > 0 ? displayedRankings.map((item: any, idx: number) => {
                                const qty_2y = item.qty_2y || 0;
                                const qty_1y = item.qty_1y || 0;
                                const qty_0y = item.qty_0y || 0;
                                
                                // Calculate Growth Rate
                                let growth = 0;
                                if (qty_1y === 0 && qty_0y > 0) growth = qty_0y <= 10 ? qty_0y * 10 : 500;
                                else if (qty_1y > 0) growth = ((qty_0y - qty_1y) / qty_1y) * 100;

                                const isHighlight = growth >= 50 && qty_0y >= 10;
                                const isNegative = growth < 0;

                                let growthText = '-';
                                if (qty_1y === 0 && qty_0y > 0) growthText = 'New';
                                else if (growth > 0) growthText = `+${growth > 500 ? '500+' : growth.toFixed(1)}%`;
                                else if (growth < 0) growthText = `${growth.toFixed(1)}%`;

                                // Data bar width capped at 100% (absolute for UI width calc)
                                const dataBarWidth = Math.min(Math.abs(growth), 100);

                                // Sparkline calculation
                                const maxSparkQty = Math.max(qty_2y, qty_1y, qty_0y, 1);
                                const yMax = 20;
                                const pts = [
                                    `0,${yMax - (qty_2y / maxSparkQty * yMax)}`,
                                    `30,${yMax - (qty_1y / maxSparkQty * yMax)}`,
                                    `60,${yMax - (qty_0y / maxSparkQty * yMax)}`
                                ].join(' ');
                                const trendColor = qty_0y >= qty_1y ? '#386ed9' : '#f43f5e';

                                return (
                                <tr key={item.name} className={`group hover:bg-white transition-all duration-300 ${isHighlight ? 'bg-blue-600/5' : 'bg-slate-50/10'}`}>
                                    <td className="px-5 py-6 text-center border-r border-slate-50">
                                        {idx + 1 <= 3 ? (
                                            <span className={`inline-flex items-center justify-center w-9 h-9 rounded-2xl text-sm font-bold ${
                                                idx === 0 ? 'bg-[#386ed9] text-white shadow-lg shadow-blue-200' : 
                                                idx === 1 ? 'bg-slate-200 text-slate-700' : 
                                                'bg-slate-100 text-slate-600'
                                            }`}>
                                                {idx + 1}
                                            </span>
                                        ) : (
                                            <span className="font-bold text-slate-300 text-base">{idx + 1}</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-6 border-r border-slate-50">
                                        <div className="flex items-center space-x-5 min-w-[280px]">
                                            {item.imageUrl ? (
                                                <div className="relative flex-none group-hover:scale-105 transition-transform duration-500">
                                                    <img src={item.imageUrl} alt="" className="w-20 h-20 rounded-2xl bg-white object-cover border border-slate-200 shadow-sm" />
                                                    {isHighlight && (
                                                        <div className="absolute -top-2 -right-2 bg-amber-400 text-white p-1 rounded-lg shadow-md">
                                                            <Sparkles size={12} fill="currentColor" />
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="w-20 h-20 rounded-2xl bg-slate-100 flex-none border border-slate-100" />
                                            )}
                                            <div className="flex flex-col space-y-1">
                                                <p className="font-bold text-slate-800 text-[15px] break-words whitespace-normal leading-relaxed cursor-pointer group-hover:text-[#386ed9] transition-colors">{item.name}</p>
                                                <span className="text-[10px] text-slate-400 font-medium tracking-tight uppercase">Coupang Selection</span>
                                            </div>
                                        </div>
                                    </td>

                                    <td className="px-4 py-6 text-center">
                                        <div className="flex justify-center items-center">
                                            <svg width="60" height="20" className="overflow-visible">
                                                <polyline points={pts} fill="none" stroke={trendColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                                <circle cx="60" cy={yMax - (qty_0y / maxSparkQty * yMax)} r="2.5" fill={trendColor} />
                                            </svg>
                                        </div>
                                    </td>

                                    <td className="px-5 py-6 text-right text-slate-500 font-semibold text-[13px]">{qty_2y.toLocaleString()}</td>
                                    <td className="px-5 py-6 text-right text-slate-500 font-semibold text-[13px]">{qty_1y.toLocaleString()}</td>
                                    
                                    <td className="px-5 py-6 text-right font-bold text-slate-900 text-[14px] bg-blue-50/10 border-l border-slate-50">
                                        {qty_0y.toLocaleString()}
                                    </td>

                                    {/* Data Bar Cell for YoY % */}
                                    <td className="px-5 py-6 relative bg-slate-50/50 border-l border-slate-50 overflow-hidden min-w-[130px]">
                                        <div className="absolute inset-y-5 left-1/2 right-1/2 flex pointer-events-none opacity-20 z-0">
                                            {!isNegative && growth > 0 && (
                                                <div className="h-full bg-blue-600 rounded-r-xl transition-all duration-700 ml-[1px]" style={{ width: `${dataBarWidth}%` }}></div>
                                            )}
                                            {isNegative && (
                                                <div className="absolute top-0 bottom-0 right-[1px] h-full bg-rose-600 rounded-l-xl transition-all duration-700" style={{ width: `${dataBarWidth}%` }}></div>
                                            )}
                                        </div>
                                        <div className={`relative z-10 text-center font-bold text-[12px] tracking-tight ${isNegative ? 'text-rose-600' : growth > 0 ? 'text-[#386ed9]' : 'text-slate-400'}`}>
                                            {growthText}
                                        </div>
                                    </td>
                                    {showAmountGroups && (
                                        <>
                                            <td className="px-5 py-3.5 text-right text-slate-400 font-medium border-l border-slate-50">
                                                {item.cost > 0 ? (qty_2y * item.cost).toLocaleString() : '-'}
                                            </td>
                                            <td className="px-5 py-3.5 text-right text-slate-400 font-medium">
                                                {item.cost > 0 ? (qty_1y * item.cost).toLocaleString() : '-'}
                                            </td>
                                            <td className="px-5 py-3.5 text-right text-slate-700 font-semibold border-l border-slate-50">
                                                {item.cost > 0 ? (qty_0y * item.cost).toLocaleString() : '-'}
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
                            className="group px-6 py-2.5 bg-white border border-slate-100 rounded-full text-sm font-medium text-sky-500 hover:bg-sky-50 hover:-translate-y-0.5 transition-all flex items-center gap-2"
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
