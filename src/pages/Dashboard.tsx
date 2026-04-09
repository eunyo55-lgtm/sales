import { useEffect, useState, useMemo } from 'react';
import { api } from '../lib/api';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { TrendingUp, Trophy, Activity, AlertCircle, Search, Calendar, ArrowUpRight, ArrowDownRight, Archive } from 'lucide-react';
import { isRedDay } from '../lib/dateUtils';
import { CustomDatePicker } from '../components/CustomDatePicker';

const StatCard = ({ title, value, amount, sub, icon: Icon, yoyValue, comparisonLabel = "전년 대비", avgCost = 0, type = 'sales' }: any) => {
    let yoyEl = null;
    if (yoyValue !== undefined && yoyValue !== null) {
        const diff = value - yoyValue;
        const rate = yoyValue > 0 ? (diff / yoyValue) * 100 : (value > 0 ? 100 : 0);
        const isUp = diff > 0;
        const isDown = diff < 0;

        yoyEl = (
            <div className="mt-4 flex items-center text-item-data font-bold">
                <span className="text-text-disabled uppercase font-semibold">{comparisonLabel}</span>
                <span className={`ml-2 growth-indicator ${isUp ? 'text-success' : isDown ? 'text-error' : 'text-text-disabled'}`}>
                    {isUp ? <ArrowUpRight size={14} /> : isDown ? <ArrowDownRight size={14} /> : null}
                    {Math.abs(diff).toLocaleString()}개 ({isUp ? '+' : ''}{rate.toFixed(1)}%)
                </span>
            </div>
        );
    }

    const totalAmount = amount !== undefined ? amount : Math.round(value * avgCost);

    return (
        <div className="p-8 border border-slate-100 rounded-3xl group hover:border-primary/50 transition-all cursor-default bg-white">
            <div className="justify-between items-start flex">
                <div className="flex-1">
                    <h3 className="text-item-main text-text-secondary uppercase tracking-[0.15em] mb-4">{title}</h3>
                    
                    <div className="space-y-1">
                        <div className="flex items-baseline space-x-2">
                            <span className="text-item-main text-text-primary">{type === 'inventory' ? '재고량' : '판매량'}</span>
                            <span className="text-[18px] font-bold text-text-primary">{value.toLocaleString()}</span>
                            <span className="text-item-sub font-bold text-text-disabled uppercase">개</span>
                        </div>
                        
                        {(amount !== undefined || avgCost > 0) && (
                            <div className="flex items-baseline space-x-2">
                                <span className="text-item-main text-text-secondary">원가액</span>
                                <span className="text-item-data font-black text-text-primary">
                                    {totalAmount.toLocaleString()}원
                                </span>
                            </div>
                        )}
                    </div>

                    {sub && (
                        <div className="mt-4">
                            <span className="text-item-sub text-text-disabled font-bold uppercase tracking-tight py-1 px-2 bg-slate-50 rounded-lg border border-slate-100">
                                {sub}
                            </span>
                        </div>
                    )}
                    
                    {yoyEl}
                </div>
                <div className="p-3 bg-slate-50 rounded-xl text-text-disabled group-hover:text-primary transition-colors border border-slate-100">
                    <Icon size={20} strokeWidth={2.5} />
                </div>
            </div>
        </div>
    );
};

const SkeletonStatCard = () => (
    <div className="p-8 border border-slate-100 rounded-3xl bg-white animate-pulse">
        <div className="flex justify-between items-start mb-6">
            <div className="w-1/2 h-4 bg-slate-100 rounded-full"></div>
            <div className="p-3 bg-slate-50 rounded-xl w-10 h-10"></div>
        </div>
        <div className="space-y-4">
            <div className="w-3/4 h-8 bg-slate-100 rounded-lg"></div>
            <div className="w-2/3 h-5 bg-slate-50 rounded-lg"></div>
            <div className="w-full h-8 bg-slate-50 mt-4 rounded-lg"></div>
        </div>
    </div>
);

const SkeletonChart = () => (
    <div className="p-8 border border-slate-100 rounded-3xl bg-white animate-pulse h-[400px]">
        <div className="w-1/4 h-5 bg-slate-100 rounded-full mb-8"></div>
        <div className="w-full h-[280px] bg-slate-50 rounded-2xl"></div>
    </div>
);

export default function Dashboard() {

    const [data, setData] = useState<any>(null);
    const [loadingSummary, setLoadingSummary] = useState(true);
    const [loadingTrends, setLoadingTrends] = useState(true);
    
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [trendStartDate, setTrendStartDate] = useState<string>('');
    const [trendEndDate, setTrendEndDate] = useState<string>('');
    const [customTrendData, setCustomTrendData] = useState<any[]>([]);
    const [loadingTrend, setLoadingTrend] = useState(false);
    const [combinedRankings, setCombinedRankings] = useState<any[]>([]);
    const [loadingRankings, setLoadingRankings] = useState(false);
    
    const [sortKey, setSortKey] = useState<'qty_0y' | 'qty_1y' | 'qty_2y' | 'trend' | 'amt_0y' | 'amt_1y' | 'amt_2y'>('qty_0y');
    const [sortDesc, setSortDesc] = useState(true);
    const [displayLimit, setDisplayLimit] = useState(10);
    const showAmountGroups = true;

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (!loadingSummary && data && data.metrics) { // data.metrics implies data successfully loaded
            // Use _getLatestDateCore if anchorDate is missing but we'll just use today minus 30 days as a safe default anchor
            const anchorDate = data.anchorDate || new Date().toISOString().split('T')[0];
            const d = new Date(anchorDate);
            const start = new Date(d);
            start.setDate(d.getDate() - 30);
            const startStr = start.toISOString().split('T')[0];
            
            // 1. Initial Load for Best Seller Rankings
            if (!combinedRankings.length && !loadingRankings) {
                setStartDate(startStr);
                setEndDate(anchorDate);
                api.getDashboardCombinedRankings(startStr, anchorDate).then(setCombinedRankings).catch(e => console.error(e));
            }

            // 2. Initial Load for Sales Trend Chart
            if (!customTrendData.length && !loadingTrend) {
                setTrendStartDate(startStr);
                setTrendEndDate(anchorDate);
                api.getCustomDailySalesTrend(startStr, anchorDate).then(setCustomTrendData).catch(e => console.error(e));
            }
        }
    }, [loadingSummary, data]);

    const loadTrendData = async () => {
        setLoadingTrend(true);
        try {
            const trend = await api.getCustomDailySalesTrend(trendStartDate, trendEndDate);
            setCustomTrendData(trend);
        } catch (e) {
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
        } catch (e) {
            console.error("[Dashboard] Rankings load failed:", e);
            setCombinedRankings([]);
        } finally {
            setLoadingRankings(false);
        }
    };

    const loadData = async () => {
        console.time("Dashboard_T1_Summary");
        setLoadingSummary(true);
        setLoadingTrends(true);
        
        try {
            // Phase 1: Summary (Fast)
            const summary = await api.getDashboardSummary();
            setData(summary);
            setLoadingSummary(false);
            console.timeEnd("Dashboard_T1_Summary");

            // Phase 2: Trends (Slower)
            console.time("Dashboard_T2_Trends");
            const trends = await api.getDashboardTrends();
            setData((prev: any) => ({ ...prev, trends }));
            setLoadingTrends(false);
            console.timeEnd("Dashboard_T2_Trends");
        } catch (error: any) {
            console.error("Failed to load dashboard data", error);
            setLoadingSummary(false);
            setLoadingTrends(false);
        }
    };

    const handleSort = (key: 'qty_0y' | 'qty_1y' | 'qty_2y' | 'trend' | 'amt_0y' | 'amt_1y' | 'amt_2y') => {
        if (sortKey === key) {
            setSortDesc(!sortDesc);
        } else {
            setSortKey(key);
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

    if (loadingSummary) {
        return (
            <div className="space-y-8 pb-12">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <SkeletonStatCard />
                    <SkeletonStatCard />
                    <SkeletonStatCard />
                    <SkeletonStatCard />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2">
                        <SkeletonChart />
                    </div>
                    <div>
                        <SkeletonChart />
                    </div>
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="flex flex-col justify-center items-center h-[calc(100vh-100px)] text-text-disabled">
                <div className="p-12 flex flex-col items-center max-w-md text-center border border-slate-100 rounded-3xl">
                    <AlertCircle size={48} className="mb-6 text-error/50" />
                    <h3 className="text-section-title text-text-primary mb-2">데이터를 불러올 수 없습니다.</h3>
                    <p className="text-sub text-text-secondary">초기 엑셀 데이터를 먼저 업로드해 주세요.</p>
                </div>
            </div>
        );
    }

    const { metrics } = data;
    const avgCost = data?.avgCost || 0;

    return (
        <div className="space-y-8 pb-12">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="전일 판매량" value={metrics.yesterday} amount={metrics.yesterdayAmount} yoyValue={metrics.yesterdayPrevYear} sub={`FC: ${metrics.fcYesterday?.toLocaleString() || 0} / VF: ${metrics.vfYesterday?.toLocaleString() || 0}`} icon={TrendingUp} avgCost={avgCost} />
                <StatCard title="주간 판매량" value={metrics.weekly} amount={metrics.weeklyAmount} yoyValue={metrics.weeklyPrevYear} sub={`FC: ${metrics.fcWeekly?.toLocaleString() || 0} / VF: ${metrics.vfWeekly?.toLocaleString() || 0}`} icon={Calendar} avgCost={avgCost} />
                <StatCard title="누적 판매량" value={metrics.yearly} amount={metrics.yearlyAmount} yoyValue={metrics.yearlyPrevYear} sub={`FC: ${metrics.fcYearly?.toLocaleString() || 0} / VF: ${metrics.vfYearly?.toLocaleString() || 0}`} icon={Trophy} avgCost={avgCost} />
                <StatCard title="전일 재고" value={metrics.totalStock || 0} amount={metrics.totalStockAmount || 0} yoyValue={metrics.totalStockPrevDay} comparisonLabel="전일 대비" sub={`FC: ${(metrics.totalFcStock || 0).toLocaleString()} / VF: ${(metrics.totalVfStock || 0).toLocaleString()}`} icon={Archive} avgCost={avgCost} type="inventory" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
                <div className="lg:col-span-2">
                    <div className="p-8 border border-slate-100 rounded-3xl bg-white h-full shadow-sm">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                            <div>
                                <h3 className="text-section-title text-text-primary flex items-center uppercase tracking-tighter">
                                    <Activity size={20} className="mr-3 text-primary" strokeWidth={3} />
                                    판매 추이 분석
                                </h3>
                                <p className="text-item-sub text-text-disabled mt-1 uppercase">3개년 판매량 비교 분석</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center bg-transparent p-0 rounded-none border-none">
                                    <CustomDatePicker value={trendStartDate} onChange={setTrendStartDate} disabled={loadingTrend} />
                                    <span className="text-text-disabled font-black px-2">~</span>
                                    <CustomDatePicker value={trendEndDate} onChange={setTrendEndDate} disabled={loadingTrend} />
                                </div>
                                <button onClick={loadTrendData} disabled={loadingTrend} className="p-3 bg-transparent border-none rounded-xl text-text-secondary hover:text-primary transition-all">
                                    <Search size={16} className={loadingTrend ? 'animate-spin' : ''} strokeWidth={2.5} />
                                </button>
                            </div>
                        </div>

                        {loadingTrends ? (
                            <SkeletonChart />
                        ) : (
                            <div className="h-[400px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={filteredDailyTrends}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis 
                                            dataKey="date" 
                                            tick={({ x, y, payload }) => (
                                                <text x={x} y={y} dy={16} textAnchor="middle" fill={isRedDay(payload.value) ? "#EF4444" : "#94A3B8"} fontSize={10} fontWeight="bold">
                                                    {payload.value.substring(5)}
                                                </text>
                                            )}
                                            axisLine={false} 
                                            tickLine={false}
                                        />
                                        <YAxis tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} labelFormatter={(label) => { const parts = label.split('-'); return parts.length === 3 ? `${parts[1]}월 ${parts[2]}일` : label; }} />
                                        <Legend verticalAlign="top" align="right" height={36}/>
                                        <Line name="금년" type="monotone" dataKey="quantity" stroke="#386ED9" strokeWidth={4} dot={false} activeDot={{ r: 6, strokeWidth: 0 }} />
                                        <Line name="전년" type="monotone" dataKey="prevYearQuantity" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                                        <Line name="전전년" type="monotone" dataKey="prev2YearQuantity" stroke="#cbd5e1" strokeWidth={2} strokeDasharray="3 3" dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>
                </div>

                <div>
                    <div className="p-8 border border-slate-100 rounded-3xl group hover:border-primary/50 transition-all cursor-default bg-white h-full shadow-sm">
                        <h3 className="text-section-title text-text-primary uppercase tracking-widest flex items-center mb-8">
                            <AlertCircle className="w-5 h-5 text-error mr-3" />
                            재고 위험 품목 <span className="ml-2 text-error">RISK</span>
                        </h3>
                        <div className="space-y-4 max-h-[440px] overflow-y-auto pr-2 custom-scrollbar">
                            {data.riskItems?.map((item: any, idx: number) => (
                                <div key={idx} className="flex items-center p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-error/30 transition-all">
                                    <img src={item.imageUrl} alt="" className="w-12 h-12 rounded-xl object-cover border border-slate-200 mr-4" />
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-item-main text-text-primary truncate">{item.name}</h4>
                                        <div className="flex items-center mt-1 space-x-3">
                                            <span className="text-item-sub text-text-disabled uppercase">재고: <span className="text-text-primary font-bold">{item.coupangStock || item.currentStock}</span></span>
                                            <span className="text-item-sub text-text-disabled uppercase">평균: <span className="text-text-primary font-bold">{item.avgDailySales}</span></span>
                                        </div>
                                    </div>
                                    <div className="text-right ml-4">
                                        <span className="block text-item-data text-error font-black">{item.daysOfInventory || item.daysLeft}일</span>
                                        <span className="text-[9px] text-text-disabled font-bold uppercase">남음</span>
                                    </div>
                                </div>
                            ))}
                            {(!data.riskItems || data.riskItems.length === 0) && (
                                <div className="py-12 text-center text-text-disabled font-bold uppercase tracking-widest text-[10px]">위험 품목 없음</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-8 border border-slate-100 rounded-3xl bg-white">
                <div className="px-0 py-6 flex flex-col md:flex-row md:items-center justify-between gap-6 mb-4">
                    <div>
                        <h3 className="text-section-title text-text-primary flex items-center uppercase tracking-tighter">
                            <Trophy size={20} className="mr-3 text-primary" strokeWidth={3} />
                            베스트 셀러 성과 랭킹
                        </h3>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center bg-transparent p-0 rounded-none border-none">
                            <CustomDatePicker value={startDate} onChange={setStartDate} disabled={loadingRankings} />
                            <span className="text-text-disabled font-black px-2">~</span>
                            <CustomDatePicker value={endDate} onChange={setEndDate} disabled={loadingRankings} />
                        </div>
                        <button onClick={loadCombinedRankings} disabled={loadingRankings} className="p-3 bg-transparent border-none rounded-xl text-text-secondary hover:text-primary transition-all">
                            <Search size={16} className={loadingRankings ? 'animate-spin' : ''} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="saas-table border-separate border-spacing-0">
                        <thead>
                            <tr className="bg-white">
                                <th className="text-center w-20 px-4 py-4 text-table-header border-b border-slate-100">순위</th>
                                <th className="px-6 py-4 text-table-header border-b border-slate-100">상품명</th>
                                <th className="text-center w-32 px-4 py-4 text-table-header border-b border-slate-100">추세</th>
                                <th className="text-right px-4 py-4 text-table-header border-b border-slate-100 cursor-pointer hover:text-primary transition-all" onClick={() => handleSort('qty_2y')}>'24 판매량</th>
                                <th className="text-right px-4 py-4 text-table-header border-b border-slate-100 cursor-pointer hover:text-primary transition-all" onClick={() => handleSort('qty_1y')}>'25 판매량</th>
                                <th className="text-right px-6 py-4 text-table-header text-primary border-b-2 border-primary cursor-pointer" onClick={() => handleSort('qty_0y')}>'26 판매량</th>
                                <th className="text-center w-32 px-4 py-4 text-table-header border-b border-slate-100">성장률</th>
                                {showAmountGroups && (
                                    <>
                                        <th className="text-right px-4 py-4 text-table-header border-b border-slate-100 cursor-pointer" onClick={() => handleSort('amt_0y')}>'26 매출액</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {displayedRankings.map((item: any, idx: number) => {
                                const qty_2y = item.qty_2y || 0;
                                const qty_1y = item.qty_1y || 0;
                                const qty_0y = item.qty_0y || 0;
                                let growth = 0;
                                if (qty_1y === 0 && qty_0y > 0) growth = 100;
                                else if (qty_1y > 0) growth = ((qty_0y - qty_1y) / qty_1y) * 100;
                                const isUp = growth > 0;
                                const isDown = growth < 0;
                                const maxSparkQty = Math.max(qty_2y, qty_1y, qty_0y, 1);
                                const yMax = 20;
                                const pts = [`0,${yMax - (qty_2y / maxSparkQty * yMax)}`, `30,${yMax - (qty_1y / maxSparkQty * yMax)}`, `60,${yMax - (qty_0y / maxSparkQty * yMax)}`].join(' ');
                                return (
                                    <tr key={item.name} className="group hover:bg-slate-50 transition-colors">
                                        <td className="text-center py-5">
                                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-item-data ${idx === 0 ? 'bg-primary text-white' : idx === 1 ? 'bg-slate-200 text-text-primary font-bold' : idx === 2 ? 'bg-slate-100 text-text-secondary font-bold' : 'text-text-disabled'}`}>
                                                {idx + 1}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center space-x-4">
                                                <div className="flex flex-col">
                                                    <p className="text-item-main text-text-primary line-clamp-1 leading-tight">{item.name}</p>
                                                    <span className="text-item-sub text-text-disabled uppercase tracking-widest mt-1">Catalog Item</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="text-center py-5">
                                            <svg width="60" height="20" className="mx-auto overflow-visible">
                                                <polyline points={pts} fill="none" stroke={isUp ? '#22C55E' : isDown ? '#EF4444' : '#94A3B8'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        </td>
                                        <td className="text-right px-4 py-5 text-item-data text-text-disabled">{qty_2y.toLocaleString()}</td>
                                        <td className="text-right px-4 py-5 text-item-data text-text-disabled">{qty_1y.toLocaleString()}</td>
                                        <td className="text-right px-6 py-5 text-item-data text-text-primary bg-primary/[0.01]">{qty_0y.toLocaleString()}</td>
                                        <td className="text-center px-4 py-5">
                                            <span className={`growth-indicator ${isUp ? 'text-success' : isDown ? 'text-error' : 'text-text-disabled'}`}>
                                                {isUp ? <ArrowUpRight size={14} /> : isDown ? <ArrowDownRight size={14} /> : null}
                                                {isUp ? '+' : ''}{growth.toFixed(1)}%
                                            </span>
                                        </td>
                                        {showAmountGroups && (
                                            <td className="text-right px-4 py-5 text-item-data text-text-secondary">
                                                {((item.cost || 0) * qty_0y).toLocaleString()}원
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {displayLimit < sortedRankings.length && (
                    <div className="flex justify-center py-10 bg-slate-50/50 border-t border-slate-100">
                        <button onClick={() => setDisplayLimit(p => p + 10)} className="btn-secondary px-8 font-black uppercase tracking-widest">
                            데이터 더보기 (+10)
                            <span className="ml-3 text-[10px] opacity-40">{displayLimit} / {sortedRankings.length}</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
