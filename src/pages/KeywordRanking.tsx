import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { Search, Plus, Trash2, ArrowUpDown, X, TrendingUp, TrendingDown, Menu, LayoutList, Flame, Loader2, Activity, Settings } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const getKSTDateString = (dateObj: Date = new Date()) => {
    const kstTime = dateObj.getTime() + (9 * 60 * 60 * 1000);
    return new Date(kstTime).toISOString().split('T')[0];
};

function SortIcon({ currentSort, targetKey }: { currentSort: { key: string, direction: 'asc' | 'desc' } | null, targetKey: string }) {
    if (!currentSort || currentSort.key !== targetKey) return <ArrowUpDown className="w-3 h-3 ml-1 text-text-disabled opacity-0 group-hover:opacity-100 transition-opacity" />;
    return currentSort.direction === 'asc'
        ? <TrendingUp className="w-3 h-3 ml-1 text-primary" />
        : <TrendingDown className="w-3 h-3 ml-1 text-primary" />;
}

export default function KeywordRanking({ showKeywordManager, setShowKeywordManager }: {
    showKeywordManager: boolean;
    setShowKeywordManager: (val: boolean) => void;
}) {
    const [keywords, setKeywords] = useState<any[]>([]);
    const [rankings, setRankings] = useState<any[]>([]);
    const [keywordSearchVolumes, setKeywordSearchVolumes] = useState<any[]>([]);
    const [productStats, setProductStats] = useState<any[]>([]);
    const [loadingStats, setLoadingStats] = useState(false);
    const [anchorDate, setAnchorDate] = useState<string>(getKSTDateString());
    const [selectedKeywordId, setSelectedKeywordId] = useState<string | null>(null);

    // Form state
    const [newCategory, setNewCategory] = useState('');
    const [newKeyword, setNewKeyword] = useState('');
    const [newCoupangId, setNewCoupangId] = useState('');
    const [newBarcode, setNewBarcode] = useState('');
    const [productsList, setProductsList] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);

    // UI state
    const [showManualSync, setShowManualSync] = useState(false);
    const [showNaverSync, setShowNaverSync] = useState(false);

    // Dashboard state
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'category', direction: 'asc' });
    const [editingCategory, setEditingCategory] = useState<{ id: string, value: string } | null>(null);
    const [chartModalOpen, setChartModalOpen] = useState(false);
    const [selectedChartKeyword, setSelectedChartKeyword] = useState<any>(null);

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchQuery.trim() && showDropdown) {
                searchProducts(searchQuery.trim());
            } else if (!searchQuery.trim()) {
                setProductsList([]);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery, showDropdown]);

    const searchProducts = async (query: string) => {
        try {
            const { data } = await supabase
                .from('products')
                .select('barcode, name, image_url')
                .ilike('name', `%${query}%`)
                .limit(50);
            if (data) {
                const unique = Array.from(new Map(data.filter(p => p.name).map(item => [item.name, item])).values());
                setProductsList(unique);
            }
        } catch (error) {
            console.error('Error searching products:', error);
        }
    };

    const fetchData = async () => {
        try {
            // Fetch keywords with product name
            const { data: kwData, error: kwError } = await supabase
                .from('keywords')
                .select('*, products(name, image_url)')
                .order('created_at', { ascending: false });
            if (kwError) throw kwError;
            setKeywords(kwData || []);

            // Fetch rankings (last 90 days)
            const startDateObj = new Date();
            startDateObj.setDate(startDateObj.getDate() - 90);
            const dateStr = getKSTDateString(startDateObj);

            const { data: rankData, error: rankError } = await supabase
                .from('keyword_rankings')
                .select('id, keyword_id, date, rank_position, rating, review_count')
                .gte('date', dateStr)
                .order('date', { ascending: true });

            if (rankError) throw rankError;
            setRankings(rankData || []);

            // Fetch search volumes
            const { data: svData, error: svError } = await supabase
                .from('keyword_search_volumes')
                .select('*')
                .order('target_date', { ascending: false });

            if (svError) throw svError;
            setKeywordSearchVolumes(svData || []);

            // Fetch targeted stats
            setLoadingStats(true);
            const res = await api.getProductStatsForKeywords(kwData, 20);
            setProductStats(res.stats || []);
            setAnchorDate(res.anchorDate);
            setLoadingStats(false);

            if (kwData && kwData.length > 0 && !selectedKeywordId) {
                setSelectedKeywordId(kwData[0].id);
            }
        } catch (error) {
            console.error('Error fetching keyword data:', error);
        }
    };

    const handleAddKeyword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newKeyword.trim() || !newCoupangId.trim()) return;

        try {
            const { error } = await supabase.from('keywords').insert([
                {
                    category: newCategory.trim() || null,
                    keyword: newKeyword.trim(),
                    type: 'core',
                    coupang_product_id: newCoupangId.trim(),
                    barcode: newBarcode || null
                }
            ]);

            if (error) throw error;

            setNewCategory('');
            setNewKeyword('');
            setNewCoupangId('');
            setNewBarcode('');
            setSearchQuery('');
            fetchData();
        } catch (error) {
            console.error('Error adding keyword:', error);
            alert('키워드 추가 중 오류가 발생했습니다.');
        }
    };

    const handleDeleteKeyword = async (id: string) => {
        if (!confirm('정말 삭제하시겠습니까? 관련 랭킹 데이터도 모두 삭제됩니다.')) return;

        try {
            const { error } = await supabase.from('keywords').delete().eq('id', id);
            if (error) throw error;
            if (selectedKeywordId === id) setSelectedKeywordId(null);
            fetchData();
        } catch (error) {
            console.error('Error deleting keyword:', error);
            alert('키워드 삭제 중 오류가 발생했습니다.');
        }
    };

    const handleUpdateCategory = async (id: string, newCat: string) => {
        try {
            const { error } = await supabase.from('keywords').update({ category: newCat.trim() || null }).eq('id', id);
            if (error) throw error;

            setKeywords(prev => prev.map(k => k.id === id ? { ...k, category: newCat.trim() || null } : k));
            setEditingCategory(null);
        } catch (error) {
            console.error('Error updating category:', error);
            alert('분류 수정 중 오류가 발생했습니다.');
        }
    };

    const handleDeleteRankingDate = async (date: string) => {
        if (!confirm(`${date} 일자의 모든 랭킹 데이터를 삭제하시겠습니까?`)) return;

        try {
            const { error } = await supabase
                .from('keyword_rankings')
                .delete()
                .eq('date', date);
            
            if (error) throw error;
            
            setRankings(prev => prev.filter(r => r.date !== date));
            alert('데이터가 삭제되었습니다.');
        } catch (error) {
            console.error('Error deleting rankings:', error);
            alert('데이터 삭제 중 오류가 발생했습니다.');
        }
    };

    const openChartModal = (keyword: any) => {
        setSelectedChartKeyword(keyword);
        setChartModalOpen(true);
    };

    // Extract unique dates for table columns
    const allUniqueDates = Array.from(new Set(rankings.map(r => r.date))).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    const displayDates = allUniqueDates;

    // Get unique search volume dates
    const allSvDates = Array.from(new Set(keywordSearchVolumes.map(sv => sv.target_date))).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    const currentWeekEnd = new Date(anchorDate);
    const currentWeekStart = new Date(anchorDate);
    currentWeekStart.setDate(currentWeekEnd.getDate() - 6);

    const lastWeekEnd = new Date(currentWeekStart);
    lastWeekEnd.setDate(currentWeekStart.getDate() - 1);
    const lastWeekStart = new Date(lastWeekEnd);
    lastWeekStart.setDate(lastWeekEnd.getDate() - 6);

    const latestSvDate = allSvDates[0] || '';
    const prevSvDate = allSvDates[1] || '';

    const groupedStats = useMemo(() => {
        const groups = new Map<string, {
            name: string;
            dailySales: Record<string, number>;
        }>();

        productStats.forEach(p => {
            const name = (p.name || "").trim().toLowerCase();
            if (!name) return;
            if (!groups.has(name)) {
                groups.set(name, { name: p.name, dailySales: {} });
            }
            const g = groups.get(name)!;
            Object.entries(p.dailySales || {}).forEach(([date, qty]) => {
                g.dailySales[date] = (g.dailySales[date] || 0) + Number(qty);
            });
        });
        return groups;
    }, [productStats]);

    const getWeeklySales = (dailySales: Record<string, number>, startDate: Date) => {
        let sum = 0;
        for (let j = 0; j < 7; j++) {
            const d = new Date(startDate);
            d.setDate(startDate.getDate() + j);
            const dStr = getKSTDateString(d);
            sum += (dailySales[dStr] || 0);
        }
        return sum;
    };

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    const sortedKeywords = [...keywords].sort((a, b) => {
        if (!sortConfig) return 0;
        let aValue: any = '';
        let bValue: any = '';

        if (sortConfig.key === 'category') {
            aValue = a.category?.toLowerCase() || '';
            bValue = b.category?.toLowerCase() || '';
        } else if (sortConfig.key === 'keyword') {
            aValue = a.keyword.toLowerCase();
            bValue = b.keyword.toLowerCase();
        } else if (sortConfig.key === 'product') {
            aValue = a.products?.name?.toLowerCase() || '';
            bValue = b.products?.name?.toLowerCase() || '';
        } else if (sortConfig.key === 'salesLastWeek' || sortConfig.key === 'salesThisWeek' || sortConfig.key === 'salesWoW') {
            const aName = (a.products?.name || "").trim().toLowerCase();
            const aG = groupedStats.get(aName);
            const aLast = aG ? getWeeklySales(aG.dailySales, lastWeekStart) : 0;
            const aThis = aG ? getWeeklySales(aG.dailySales, currentWeekStart) : 0;

            const bName = (b.products?.name || "").trim().toLowerCase();
            const bG = groupedStats.get(bName);
            const bLast = bG ? getWeeklySales(bG.dailySales, lastWeekStart) : 0;
            const bThis = bG ? getWeeklySales(bG.dailySales, currentWeekStart) : 0;

            if (sortConfig.key === 'salesLastWeek') {
                aValue = aLast;
                bValue = bLast;
            } else if (sortConfig.key === 'salesThisWeek') {
                aValue = aThis;
                bValue = bThis;
            } else if (sortConfig.key === 'salesWoW') {
                aValue = aThis - aLast;
                bValue = bThis - bLast;
            }
        } else if (sortConfig.key === 'views_latest' || sortConfig.key === 'views_prev' || sortConfig.key === 'trend') {
            const aLatest = keywordSearchVolumes.find(sv => sv.keyword === a.keyword && sv.target_date === latestSvDate)?.total_volume || 0;
            const aPrev = keywordSearchVolumes.find(sv => sv.keyword === a.keyword && sv.target_date === prevSvDate)?.total_volume || 0;
            const bLatest = keywordSearchVolumes.find(sv => sv.keyword === b.keyword && sv.target_date === latestSvDate)?.total_volume || 0;
            const bPrev = keywordSearchVolumes.find(sv => sv.keyword === b.keyword && sv.target_date === prevSvDate)?.total_volume || 0;

            if (sortConfig.key === 'views_latest') {
                aValue = aLatest;
                bValue = bLatest;
            } else if (sortConfig.key === 'views_prev') {
                aValue = aPrev;
                bValue = bPrev;
            } else if (sortConfig.key === 'trend') {
                aValue = aLatest - aPrev;
                bValue = bLatest - bPrev;
            }
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    return (
        <div className="space-y-8 pb-20">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex items-center space-x-4 text-left">
                    <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
                        <Activity size={24} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h1 className="text-page-title text-text-primary">키워드 성과 및 랭킹 인사이트</h1>
                        <p className="text-caption text-text-disabled font-bold uppercase tracking-wider">쿠팡 랭킹 추이 및 검색 트래픽 전환 정밀 모니터링</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
                {/* Left: Keyword Management Sidebar */}
                {showKeywordManager && (
                    <div className="p-8 border border-slate-100 rounded-3xl lg:sticky lg:top-8 animate-in slide-in-from-left-4 duration-300 bg-white">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-card-title text-text-primary uppercase tracking-tighter flex items-center">
                                <Settings size={18} className="mr-3 text-primary" />
                                키워드 관리
                            </h3>
                            <button onClick={() => setShowKeywordManager(false)} className="p-1 px-2 text-text-disabled hover:bg-slate-100 rounded-lg" title="패널 닫기">
                                <Menu size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleAddKeyword} className="space-y-5">
                            <div>
                                <label className="text-label text-text-secondary block mb-1.5 font-bold">분류 / 카테고리</label>
                                <input
                                    type="text"
                                    value={newCategory}
                                    onChange={(e) => setNewCategory(e.target.value)}
                                    placeholder="예: 여름 신발, 상시 판매"
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-label text-text-secondary block mb-1.5 font-bold">추적 키워드 *</label>
                                <input
                                    type="text"
                                    value={newKeyword}
                                    onChange={(e) => setNewKeyword(e.target.value)}
                                    placeholder="예: 아동 운동화"
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm outline-none font-bold"
                                    required
                                />
                            </div>
                            <div className="relative">
                                <label className="text-label text-text-secondary block mb-1.5 font-bold">연동 상품</label>
                                <div className="relative">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-disabled" size={16} />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => {
                                            setSearchQuery(e.target.value);
                                            setShowDropdown(true);
                                            if (e.target.value === '') setNewBarcode('');
                                        }}
                                        onFocus={() => setShowDropdown(true)}
                                        onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                                        placeholder="상품 키워드 또는 바코드 검색..."
                                        className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm outline-none bg-slate-50"
                                    />
                                </div>
                                {showDropdown && productsList.length > 0 && (
                                    <ul className="absolute z-[60] w-full bg-white border border-slate-200 mt-2 max-h-48 overflow-y-auto rounded-xl shadow-2xl">
                                        {productsList.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).map(p => (
                                            <li
                                                key={p.barcode}
                                                className="px-4 py-3 text-xs text-text-secondary hover:bg-slate-50 cursor-pointer flex items-center space-x-3 transition-colors border-b border-slate-50 last:border-0"
                                                onClick={() => {
                                                    setNewBarcode(p.barcode);
                                                    setSearchQuery(p.name);
                                                    setShowDropdown(false);
                                                }}
                                            >
                                                <div className="w-8 h-8 rounded bg-slate-100 flex-shrink-0 flex items-center justify-center">
                                                    {p.image_url ? <img src={p.image_url} className="w-full h-full object-cover" alt={p.name} /> : <Activity size={14} />}
                                                </div>
                                                <span className="font-medium line-clamp-1">{p.name}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                            <div>
                                <label className="text-label text-text-secondary block mb-1.5 font-bold">쿠팡 상품 ID *</label>
                                <input
                                    type="text"
                                    value={newCoupangId}
                                    onChange={(e) => setNewCoupangId(e.target.value)}
                                    placeholder="쿠팡 상품 번호 (예: 9333942720)"
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm outline-none font-mono"
                                    required
                                />
                            </div>
                            <button type="submit" className="btn-primary w-full py-4 mt-2 font-black tracking-widest uppercase flex items-center justify-center">
                                <Plus className="w-4 h-4 mr-2" /> 키워드 트래킹 시작
                            </button>
                        </form>
                    </div>
                )}

                {/* Right: Dashboard Dashboard */}
                <div className={`${showKeywordManager ? 'col-span-1 lg:col-span-4' : 'col-span-1 lg:col-span-5'} space-y-8 flex-1 w-full overflow-hidden`}>
                    {!showKeywordManager && (
                        <button
                            onClick={() => setShowKeywordManager(true)}
                            className="bg-white px-6 py-4 rounded-2xl border border-slate-200 flex items-center space-x-3 text-text-secondary hover:text-primary transition-all"
                        >
                            <LayoutList size={20} className="text-primary" />
                            <span className="text-sm font-black uppercase tracking-widest">키워드 관리 패널 열기</span>
                        </button>
                    )}

                    {/* Sync Actions Card */}
                    <div className="p-8 border border-slate-100 rounded-3xl bg-white">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                            <div>
                                <h3 className="text-section-title text-text-primary uppercase tracking-tighter flex items-center">
                                    <Activity size={18} className="mr-3 text-primary" />
                                    데이터 수집 및 동기화
                                </h3>
                                <p className="text-caption text-text-disabled font-bold mt-1 uppercase">보안 준수를 위해 로컬 에이전트 연동이 필요합니다</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setShowManualSync(true)}
                                    className="px-5 py-2.5 bg-slate-100 text-text-secondary text-[11px] font-black rounded-xl border border-slate-200 hover:bg-white hover:text-primary transition-all uppercase tracking-widest"
                                >
                                    ⚡ 쿠팡 순위 데이터 수집
                                </button>
                                <button
                                    onClick={() => setShowNaverSync(true)}
                                    className="px-5 py-2.5 bg-success/5 text-success text-[11px] font-black rounded-xl border border-success/20 hover:bg-success hover:text-white transition-all uppercase tracking-widest"
                                >
                                    📊 네이버 검색량 수집
                                </button>
                            </div>
                        </div>

                        {showManualSync && (
                            <div className="mt-6 p-6 bg-primary/5 rounded-2xl border border-primary/10 animate-in zoom-in-95 relative">
                                <div className="flex justify-between items-start mb-4">
                                    <h4 className="text-body font-black text-primary uppercase tracking-widest flex items-center font-bold">
                                        <div className="w-2 h-2 bg-primary rounded-full animate-pulse mr-2"></div>
                                        로컬 정밀 수집 프로토콜
                                    </h4>
                                    <button onClick={() => setShowManualSync(false)} className="text-text-disabled hover:text-text-primary">
                                        <X size={16} />
                                    </button>
                                </div>
                                <p className="text-sm text-text-secondary mb-4 font-medium">쿠팡의 보안 정책(방화벽)으로 인해 자동 수집이 차단되었습니다. 수집기를 작동시켜야 합니다.</p>
                                <div className="bg-white/60 p-4 rounded-xl border border-primary/10 text-xs text-primary shadow-sm leading-relaxed">
                                    <strong className="block mb-2 text-[11px] opacity-70 uppercase tracking-widest font-black">명령 지침:</strong>
                                    바탕화면의 [쿠팡 키워드 랭킹 수집기]를 실행하세요. 완료 후 새로고침하세요.
                                </div>
                            </div>
                        )}

                        {showNaverSync && (
                            <div className="mt-6 p-6 bg-success/5 rounded-2xl border border-success/10 animate-in zoom-in-95 relative">
                                <div className="flex justify-between items-start mb-4">
                                    <h4 className="text-body font-black text-success uppercase tracking-widest flex items-center font-bold">
                                        <div className="w-2 h-2 bg-success rounded-full animate-pulse mr-2"></div>
                                        트래픽 인사이트
                                    </h4>
                                    <button onClick={() => setShowNaverSync(false)} className="text-text-disabled hover:text-text-primary">
                                        <X size={16} />
                                    </button>
                                </div>
                                <p className="text-sm text-text-secondary mb-4 font-medium">네이버 광고시스템 보안 정책으로 인해 직접 로그인이 필요합니다.</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-white/60 p-3 rounded-xl border border-success/10 text-[11px] text-success leading-relaxed">
                                        1. [네이버 수집기] 실행 <br /> 2. 수동 로그인 완료
                                    </div>
                                    <div className="bg-white/60 p-3 rounded-xl border border-success/10 text-[11px] text-success leading-relaxed">
                                        3. 자동 도구 수집 <br /> 4. 새로고침
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Main Ranking Table Card */}
                    <div className="p-0 overflow-hidden relative">
                        <div className="px-8 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                            <div>
                                <h3 className="text-card-title text-text-primary uppercase tracking-tighter flex items-center">
                                    <TrendingUp size={18} className="mr-3 text-primary" />
                                    키워드 성과 통합 분석 매트릭스
                                </h3>
                                <p className="text-caption text-text-disabled font-bold mt-1 uppercase">랭킹 변동 추이 및 트래픽 전환 효율 상세 분석</p>
                            </div>
                            {loadingStats && (
                                <div className="flex items-center space-x-2 text-primary">
                                    <Loader2 size={16} className="animate-spin" />
                                    <span className="text-[11px] font-bold uppercase tracking-widest">데이터 산출 중...</span>
                                </div>
                            )}
                        </div>

                        <div className="overflow-auto max-h-[calc(100vh-250px)] relative custom-scrollbar !bg-white">
                            <table className="saas-table border-separate border-spacing-0 relative text-[13px] w-full">
                                <thead className="sticky top-0 z-50 !bg-white opacity-100 z-50">
                                    <tr className="h-[52px]">
                                        <th style={{ left: 0, width: 100, minWidth: 100, zIndex: 50 }} className="px-2 text-table-header text-text-secondary cursor-pointer hover:text-primary sticky !bg-slate-50 border-r border-slate-200 border-b">
                                            <div className="flex items-center space-x-1"><span>분류</span><SortIcon currentSort={sortConfig} targetKey="category" /></div>
                                        </th>
                                        <th style={{ left: 100, width: 140, minWidth: 140, zIndex: 50 }} className="px-3 text-table-header text-text-secondary cursor-pointer hover:text-primary sticky !bg-slate-50 border-r border-slate-200 border-b" onClick={() => handleSort('keyword')}>
                                            <div className="flex items-center space-x-1"><span>추적키워드</span><SortIcon currentSort={sortConfig} targetKey="keyword" /></div>
                                        </th>
                                        <th style={{ left: 240, width: 180, minWidth: 180, zIndex: 50 }} className="px-3 text-table-header text-text-secondary cursor-pointer hover:text-primary sticky !bg-slate-50 border-r border-slate-200 border-b" onClick={() => handleSort('product')}>
                                            <div className="flex items-center space-x-1"><span>상품명</span><SortIcon currentSort={sortConfig} targetKey="product" /></div>
                                        </th>
                                        <th style={{ left: 420, width: 90, minWidth: 90, zIndex: 50 }} className="px-2 text-table-header text-text-secondary text-center cursor-pointer sticky !bg-slate-50 border-r border-slate-200 border-b" onClick={() => handleSort('salesLastWeek')}>
                                            <div className="flex flex-col items-center justify-center leading-none"><span>판매량</span><span className="text-[10px] opacity-50 font-bold mt-0.5">지난주</span><SortIcon currentSort={sortConfig} targetKey="salesLastWeek" /></div>
                                        </th>
                                        <th style={{ left: 510, width: 90, minWidth: 90, zIndex: 50 }} className="px-2 text-table-header text-text-secondary text-center cursor-pointer sticky !bg-slate-50 border-r border-slate-200 border-b" onClick={() => handleSort('salesThisWeek')}>
                                            <div className="flex flex-col items-center justify-center leading-none"><span>판매량</span><span className="text-[10px] text-primary font-bold mt-0.5">이번주</span><SortIcon currentSort={sortConfig} targetKey="salesThisWeek" /></div>
                                        </th>
                                        <th style={{ left: 600, width: 70, minWidth: 70, zIndex: 50 }} className="px-1 text-table-header text-text-secondary text-center cursor-pointer sticky !bg-slate-50 border-r border-slate-200 border-b" onClick={() => handleSort('salesWoW')}>
                                            <div className="flex items-center justify-center"><span>WoW</span><SortIcon currentSort={sortConfig} targetKey="salesWoW" /></div>
                                        </th>
                                        <th style={{ left: 670, width: 90, minWidth: 90, zIndex: 50, backgroundColor: '#F0FDF4' }} className="px-2 text-table-header text-success text-center cursor-pointer sticky border-r border-success/10 border-b" onClick={() => handleSort('views_prev')}>
                                            <div className="flex flex-col items-center justify-center leading-none"><span>검색량</span><span className="text-[10px] opacity-60 font-bold mt-0.5">지난주</span><SortIcon currentSort={sortConfig} targetKey="views_prev" /></div>
                                        </th>
                                        <th style={{ left: 760, width: 90, minWidth: 90, zIndex: 50, backgroundColor: '#F0FDF4' }} className="px-2 text-table-header text-success text-center cursor-pointer sticky border-r border-success/10 border-b" onClick={() => handleSort('views_latest')}>
                                            <div className="flex flex-col items-center justify-center leading-none"><span>검색량</span><span className="text-[10px] font-bold mt-0.5">이번주</span><SortIcon currentSort={sortConfig} targetKey="views_latest" /></div>
                                        </th>
                                        <th style={{ left: 850, width: 60, minWidth: 60, zIndex: 50, backgroundColor: '#F0FDF4' }} className="px-1 text-table-header text-success text-center cursor-pointer sticky border-r border-slate-200 border-b" onClick={() => handleSort('trend')}>
                                            <div className="flex items-center justify-center"><span>추세</span><SortIcon currentSort={sortConfig} targetKey="trend" /></div>
                                        </th>

                                        {displayDates.map((date, idx) => {
                                            const [, m, d] = date.split('-');
                                            const isLatest = idx === displayDates.length - 1;
                                            return (
                                                <th key={date} className="px-2 py-3 text-center border-b border-slate-100 min-w-[85px] !bg-white group/th">
                                                    <div className="flex flex-col items-center justify-center relative">
                                                        <span className="text-table-header text-text-primary">{m}/{d}</span>
                                                        <div className="flex items-center space-x-1">
                                                            <span className="text-[10px] text-text-disabled uppercase font-bold tracking-tighter">순위</span>
                                                            {isLatest && (
                                                                <button 
                                                                    onClick={(e) => { e.stopPropagation(); handleDeleteRankingDate(date); }}
                                                                    className="p-0.5 text-error/30 hover:text-error transition-all hover:bg-error/10 rounded"
                                                                    title="이 날짜의 데이터 삭제"
                                                                >
                                                                    <Trash2 size={11} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </th>
                                            );
                                        })}
                                        <th className="px-4 border-b border-slate-100 !bg-white"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {keywords.length === 0 && (
                                        <tr>
                                            <td colSpan={10 + displayDates.length} className="py-20 text-center text-text-disabled">
                                                <div className="flex flex-col items-center">
                                                    <Search size={40} className="mb-4 opacity-20" />
                                                    <p className="font-bold uppercase tracking-widest">검색 결과가 없습니다</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                    {sortedKeywords.map(kw => {
                                        const kwRankings = rankings.filter(r => r.keyword_id === kw.id);
                                        const prodName = (kw.products?.name || "").trim().toLowerCase();
                                        const g = groupedStats.get(prodName);
                                        const hasProduct = !!prodName && !!g;
                                        const salesLastWeek = hasProduct ? getWeeklySales(g.dailySales, lastWeekStart) : 0;
                                        const salesThisWeek = hasProduct ? getWeeklySales(g.dailySales, currentWeekStart) : 0;
                                        const wow = salesThisWeek - salesLastWeek;

                                        const latestSv = keywordSearchVolumes.find(sv => sv.keyword === kw.keyword && sv.target_date === latestSvDate);
                                        const prevSv = keywordSearchVolumes.find(sv => sv.keyword === kw.keyword && sv.target_date === prevSvDate);
                                        const latestVol = latestSv?.total_volume || 0;
                                        const prevVol = prevSv?.total_volume || 0;
                                        const trend = latestVol - prevVol;

                                        return (
                                            <tr key={kw.id} className={`hover:!bg-slate-50 transition-all h-[64px] group/tr ${selectedKeywordId === kw.id ? 'bg-primary/5' : ''}`} onClick={() => setSelectedKeywordId(kw.id)}>
                                                <td style={{ left: 0, width: 100, zIndex: 30, backgroundColor: '#F8FAFC' }} className="px-2 text-item-data text-text-secondary sticky border-r border-slate-200 cursor-pointer overflow-hidden group-hover/tr:!bg-slate-100" onClick={() => setEditingCategory({ id: kw.id, value: kw.category || '' })}>
                                                    {editingCategory?.id === kw.id ? (
                                                        <input
                                                            autoFocus
                                                            value={editingCategory?.value || ''}
                                                            onChange={(e) => setEditingCategory(prev => prev ? { ...prev, value: e.target.value } : null)}
                                                            onBlur={() => editingCategory && handleUpdateCategory(kw.id, editingCategory.value)}
                                                            onKeyDown={(e) => e.key === 'Enter' && editingCategory && handleUpdateCategory(kw.id, editingCategory.value)}
                                                            className="w-full text-item-sub border border-primary rounded p-1 outline-none"
                                                            onClick={e => e.stopPropagation()}
                                                        />
                                                    ) : (
                                                        <div className="truncate w-full px-1 py-1 rounded bg-slate-200/50 group-hover/tr:bg-primary/10 transition-colors uppercase tracking-tighter font-bold">{kw.category || '+ 분류 추가'}</div>
                                                    )}
                                                </td>
                                                <td style={{ left: 100, width: 140, zIndex: 30, backgroundColor: 'white' }} className="px-3 text-item-main text-text-primary sticky border-r border-slate-200 group-hover/tr:!bg-slate-50 transition-colors">
                                                    <div className="truncate w-full font-bold" title={kw.keyword}>{kw.keyword}</div>
                                                </td>
                                                <td style={{ left: 240, width: 180, zIndex: 30, backgroundColor: 'white' }} className="px-3 text-item-main text-text-secondary cursor-pointer hover:text-primary transition-all sticky border-r border-slate-200 group-hover/tr:!bg-slate-50" onClick={(e) => { e.stopPropagation(); openChartModal(kw); }}>
                                                    <div className="flex items-center space-x-2">
                                                        <div className="w-8 h-8 rounded border border-slate-200 overflow-hidden bg-slate-50 flex-shrink-0">
                                                            {kw.products?.image_url ? <img src={kw.products.image_url} className="w-full h-full object-cover" alt={kw.products.name} /> : <Activity size={14} className="m-auto opacity-20" />}
                                                        </div>
                                                        <span className="truncate leading-tight font-bold text-text-secondary group-hover/tr:text-primary transition-colors">{kw.products?.name || '-'}</span>
                                                    </div>
                                                </td>
                                                <td style={{ left: 420, width: 90, zIndex: 10, backgroundColor: 'white' }} className="px-2 text-center border-r border-slate-100 text-text-disabled text-item-data sticky group-hover/tr:!bg-slate-50">
                                                    {loadingStats ? <Loader2 size={12} className="animate-spin mx-auto" /> : (hasProduct ? salesLastWeek.toLocaleString() : '-')}
                                                </td>
                                                <td style={{ left: 510, width: 90, zIndex: 10, backgroundColor: 'white' }} className="px-2 text-center border-r border-slate-100 text-text-primary text-item-data sticky group-hover/tr:!bg-slate-50 font-bold">
                                                    {loadingStats ? <Loader2 size={12} className="animate-spin mx-auto" /> : (hasProduct ? salesThisWeek.toLocaleString() : '-')}
                                                </td>
                                                <td style={{ left: 600, width: 70, zIndex: 10, backgroundColor: 'white' }} className={`px-1 text-center border-r border-slate-100 text-item-data sticky group-hover/tr:!bg-slate-50 ${wow > 0 ? 'text-error font-bold' : wow < 0 ? 'text-primary font-bold' : 'text-text-disabled font-bold'}`}>
                                                    <div className="flex items-center justify-center space-x-0.5">
                                                        {wow > 0 ? <TrendingUp size={10} /> : wow < 0 ? <TrendingDown size={10} /> : null}
                                                        <span>{hasProduct ? Math.abs(wow).toLocaleString() : '-'}</span>
                                                    </div>
                                                </td>
                                                <td style={{ left: 670, width: 90, zIndex: 10, backgroundColor: '#F0F9F4' }} className="px-2 text-center border-r border-success/10 text-text-disabled text-item-data font-bold sticky group-hover/tr:!bg-[#E7F5EC]">
                                                    {prevVol > 0 ? prevVol.toLocaleString() : '-'}
                                                </td>
                                                <td style={{ left: 760, width: 90, zIndex: 10, backgroundColor: '#F0F9F4' }} className="px-2 text-center border-r border-success/10 text-success text-item-data font-bold sticky group-hover/tr:!bg-[#E7F5EC]">
                                                    <div className="flex flex-col items-center">
                                                        {latestVol > 0 ? latestVol.toLocaleString() : '-'}
                                                        {latestVol >= 5000 && <Flame size={12} className="text-error" />}
                                                    </div>
                                                </td>
                                                <td style={{ left: 850, width: 60, zIndex: 10, backgroundColor: '#F0F9F4' }} className={`px-1 text-center sticky border-r border-slate-200 text-item-data group-hover/tr:!bg-[#E7F5EC] ${trend > 0 ? 'text-error font-bold' : trend < 0 ? 'text-primary font-bold' : 'text-text-disabled font-bold'}`}>
                                                    {trend !== 0 ? `${trend > 0 ? '+' : ''}${trend.toLocaleString()}` : (latestVol > 0 ? '-' : '')}
                                                </td>

                                                {displayDates.map((date, idx) => {
                                                    const r = kwRankings.find(rank => rank.date === date);
                                                    const pos = r ? r.rank_position : 0;
                                                    let prevPos = 0;
                                                    if (idx > 0) {
                                                        const prevR = kwRankings.find(rank => rank.date === displayDates[idx - 1]);
                                                        if (prevR) prevPos = prevR.rank_position;
                                                    }
                                                    return (
                                                        <td key={date} className="px-2 text-center border-r border-slate-100 group-hover/tr:bg-slate-50/50">
                                                            {pos > 0 ? (
                                                                <div className="flex flex-col items-center">
                                                                    <div className="flex items-center space-x-1">
                                                                        <span className={`text-item-main ${pos <= 10 ? 'text-primary' : 'text-text-primary'}`}>{pos}</span>
                                                                        {prevPos > 0 && (prevPos > pos ? <TrendingUp size={10} className="text-error" /> : prevPos < pos ? <TrendingDown size={10} className="text-primary" /> : null)}
                                                                    </div>
                                                                    <div className="text-item-sub text-text-disabled">★{r?.rating || '-'}</div>
                                                                </div>
                                                            ) : <span className="opacity-10">-</span>}
                                                        </td>
                                                    );
                                                })}
                                                <td className="px-4 text-center">
                                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteKeyword(kw.id); }} className="p-2 text-text-disabled hover:text-error opacity-0 group-hover/tr:opacity-100">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Chart Modal */}
            {chartModalOpen && selectedChartKeyword && (
                <div className="fixed inset-0 bg-text-primary/60 backdrop-blur-md z-50 flex justify-center items-center p-4" onClick={() => setChartModalOpen(false)}>
                    <div className="bg-white rounded-3xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="text-lg font-black text-text-primary uppercase flex items-center">
                                    <TrendingUp className="w-5 h-5 text-primary mr-3" />
                                    {selectedChartKeyword.keyword} <span className="ml-2 text-primary">순위 추이 분석</span>
                                </h3>
                                <p className="text-caption text-text-disabled font-bold uppercase mt-1">연동상품: {selectedChartKeyword.products?.name || '-'}</p>
                            </div>
                            <button onClick={() => setChartModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-all">
                                <X className="w-5 h-5 text-text-secondary" />
                            </button>
                        </div>
                        <div className="p-8 h-[450px]">
                            {(() => {
                                const finalData = allUniqueDates.slice(-30).map(date => {
                                    const r = rankings.find(rank => rank.keyword_id === selectedChartKeyword.id && rank.date === date);
                                    const [, m, d] = date.split('-');
                                    return {
                                        date: `${parseInt(m)}/${parseInt(d)}`,
                                        rank: r ? r.rank_position : null
                                    };
                                });

                                if (finalData.filter(d => d.rank !== null).length === 0) {
                                    return <div className="h-full flex items-center justify-center text-text-disabled font-black uppercase tracking-widest">표시할 데이터가 없습니다</div>;
                                }

                                return (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={finalData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                                            <YAxis reversed tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} axisLine={false} tickLine={false} domain={[1, 'auto']} />
                                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
                                            <Line type="monotone" dataKey="rank" stroke="#386ED9" strokeWidth={4} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} connectNulls />
                                        </LineChart>
                                    </ResponsiveContainer>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
