import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Plus, Trash2, ArrowUpDown, X, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function KeywordRanking() {
    const [keywords, setKeywords] = useState<any[]>([]);
    const [rankings, setRankings] = useState<any[]>([]);
    const [searchVolumes, setSearchVolumes] = useState<any[]>([]);

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
    const [selectedKeywordId, setSelectedKeywordId] = useState<string | null>(null);
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

            // Products list is now fetched dynamically on search to improve load time

            // Fetch rankings (last 30 days)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

            const { data: rankData, error: rankError } = await supabase
                .from('keyword_rankings')
                .select('id, keyword_id, date, rank_position, rating, review_count')
                .gte('date', dateStr)
                .order('date', { ascending: true });

            if (rankError) throw rankError;
            setRankings(rankData || []);

            // Fetch search volumes (latest and previous)
            const { data: svData, error: svError } = await supabase
                .from('keyword_search_volumes')
                .select('*')
                .order('target_date', { ascending: false });

            if (svError) throw svError;
            setSearchVolumes(svData || []);

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

    const openChartModal = (keyword: any) => {
        setSelectedChartKeyword(keyword);
        setChartModalOpen(true);
    };



    // Extract unique dates for table columns (last 7 days of data)
    const allUniqueDates = Array.from(new Set(rankings.map(r => r.date))).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    const displayDates = allUniqueDates.slice(-7);

    // Get unique search volume dates
    const allSvDates = Array.from(new Set(searchVolumes.map(sv => sv.target_date))).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    const latestSvDate = allSvDates[0];
    const prevSvDate = allSvDates[1];

    // Sorting logic
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
        } else if (sortConfig.key === 'views_latest' || sortConfig.key === 'views_prev' || sortConfig.key === 'trend') {
            const aLatest = searchVolumes.find(sv => sv.keyword === a.keyword && sv.target_date === latestSvDate)?.total_volume || 0;
            const aPrev = searchVolumes.find(sv => sv.keyword === a.keyword && sv.target_date === prevSvDate)?.total_volume || 0;
            const bLatest = searchVolumes.find(sv => sv.keyword === b.keyword && sv.target_date === latestSvDate)?.total_volume || 0;
            const bPrev = searchVolumes.find(sv => sv.keyword === b.keyword && sv.target_date === prevSvDate)?.total_volume || 0;

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
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

                {/* Left: Keyword Management */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm col-span-1 border-t-4 border-t-blue-500">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center justify-between">
                        <div className="flex items-center">
                            <Search className="w-5 h-5 mr-2 text-blue-500" />
                            추적 키워드 관리
                        </div>
                    </h3>

                    <form onSubmit={handleAddKeyword} className="space-y-4 mb-6 bg-gray-50 p-4 rounded-lg">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">분류</label>
                            <input
                                type="text"
                                value={newCategory}
                                onChange={(e) => setNewCategory(e.target.value)}
                                placeholder="예: 여름 의류"
                                className="w-full text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 p-2 border"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">키워드</label>
                            <input
                                type="text"
                                value={newKeyword}
                                onChange={(e) => setNewKeyword(e.target.value)}
                                placeholder="예: 여아구두"
                                className="w-full text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 p-2 border"
                                required
                            />
                        </div>
                        <div className="relative">
                            <label className="block text-xs font-medium text-gray-600 mb-1">연결 상품명 검색 (선택)</label>
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
                                placeholder="상품명 검색..."
                                className="w-full text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 p-2 border bg-white"
                            />
                            {showDropdown && (
                                <ul className="absolute z-10 w-full bg-white border border-gray-300 mt-1 max-h-40 overflow-y-auto rounded-md shadow-lg">
                                    {productsList.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).map(p => (
                                        <li
                                            key={p.barcode}
                                            className="px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer"
                                            onClick={() => {
                                                setNewBarcode(p.barcode);
                                                setSearchQuery(p.name);
                                            }}
                                        >
                                            {p.name}
                                        </li>
                                    ))}
                                    {searchQuery && productsList.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                                        <li className="px-3 py-2 text-sm text-gray-500 text-center">검색 결과가 없습니다.</li>
                                    )}
                                </ul>
                            )}
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Coupang Product ID</label>
                            <input
                                type="text"
                                value={newCoupangId}
                                onChange={(e) => setNewCoupangId(e.target.value)}
                                placeholder="예: 9333942720"
                                className="w-full text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 p-2 border"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full bg-blue-600 text-white text-sm font-medium py-2 rounded-md hover:bg-blue-700 transition flex justify-center items-center"
                        >
                            <Plus className="w-4 h-4 mr-1" /> 등록하기
                        </button>
                    </form>
                </div>

                {/* Right: Dashboard */}
                <div className="col-span-1 lg:col-span-4 space-y-6">
                    {/* Chart Card */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-800">단축 명령</h3>
                            <button
                                onClick={() => setShowManualSync(true)}
                                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-md transition border border-gray-200"
                            >
                                ⚡ 수동 순위 집계
                            </button>
                            <button
                                onClick={() => setShowNaverSync(true)}
                                className="ml-2 px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 text-xs font-medium rounded-md transition border border-green-200"
                            >
                                📊 네이버 조회수 갱신
                            </button>
                        </div>

                        {showManualSync && (
                            <div className="absolute top-16 right-6 bg-white p-4 rounded-lg shadow-xl border border-gray-200 z-10 w-80 text-sm">
                                <h4 className="font-bold text-gray-800 mb-2">수동으로 순위 집계하기</h4>
                                <p className="text-gray-600 mb-3 text-xs leading-relaxed">
                                    현재 쿠팡의 강력한 봇 차단(방화벽) 정책으로 인해 외부 서버(GitHub)에서의 자동 수집이 불가능합니다. 순위를 갱신하시려면 <b>대표님의 PC</b>에서 직접 수집기를 작동시켜야 합니다.
                                </p>
                                <div className="bg-blue-50 p-3 rounded text-xs text-blue-800 mb-4 border border-blue-100">
                                    <b>사용 방법:</b> 바탕화면에 만들어진 <b>[쿠팡 키워드 랭킹 수집기]</b> 아이콘을 더블클릭하세요. 실제 크롬 브라우저 창이 열리며 사람처럼 안전하게 순위를 수집하고 자동으로 닫힙니다. (수집 완료 후 이 화면을 새로고침 하시면 반영됩니다.)
                                </div>
                                <div className="flex justify-end">
                                    <button onClick={() => setShowManualSync(false)} className="px-3 py-1 bg-blue-50 text-blue-600 rounded text-xs font-medium hover:bg-blue-100">닫기</button>
                                </div>
                            </div>
                        )}

                        {showNaverSync && (
                            <div className="absolute top-16 right-6 bg-white p-4 rounded-lg shadow-xl border border-gray-200 z-10 w-80 text-sm">
                                <h4 className="font-bold text-gray-800 mb-2">네이버 조회수 수동 갱신</h4>
                                <p className="text-gray-600 mb-3 text-xs leading-relaxed">
                                    네이버 광고시스템의 보안 정책으로 인해 서버에서 자동 수집이 어렵습니다. 아래 순서대로 직접 실행해 주세요.
                                </p>
                                <div className="bg-green-50 p-3 rounded text-xs text-green-800 mb-4 border border-green-100">
                                    <b>사용 방법:</b>
                                    <ol className="list-decimal ml-4 mt-1 space-y-1">
                                        <li>바탕화면의 <b>[네이버 조회수 수집기]</b>를 실행합니다.</li>
                                        <li>크롬 창이 열리면 <b>네이버 로그인</b>을 완료해 주세요.</li>
                                        <li>로그인 후 자동으로 키워드 도구로 이동하여 조회를 시작합니다.</li>
                                        <li>수집이 끝나고 창이 닫히면 이 화면을 새로고침 하세요.</li>
                                    </ol>
                                </div>
                                <div className="flex justify-end">
                                    <button onClick={() => setShowNaverSync(false)} className="px-3 py-1 bg-green-50 text-green-600 rounded text-xs font-medium hover:bg-green-100">닫기</button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Summary Table */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden text-sm">
                        <div className="p-4 border-b border-gray-200 bg-gray-50">
                            <h3 className="font-bold text-gray-800">키워드별 순위 누적 현황</h3>
                        </div>
                        <div className="overflow-auto max-h-[calc(100vh-250px)]">
                            <table className="w-full text-left border-collapse whitespace-nowrap min-w-max relative">
                                <thead className="sticky top-0 z-20 shadow-sm">
                                    <tr className="text-gray-500 border-b border-gray-200 text-xs">
                                        <th
                                            className="py-3 px-4 font-medium min-w-[100px] cursor-pointer hover:bg-gray-100 transition-colors group select-none relative bg-gray-50"
                                            onClick={() => handleSort('category')}
                                        >
                                            <div className="flex items-center">
                                                분류
                                                <ArrowUpDown className={`w-3 h-3 ml-1 ${sortConfig?.key === 'category' ? 'text-blue-500' : 'text-gray-300 opacity-0 group-hover:opacity-100'} transition-opacity`} />
                                            </div>
                                        </th>
                                        <th
                                            className="py-3 px-4 font-medium min-w-[120px] cursor-pointer hover:bg-gray-100 transition-colors group select-none relative bg-gray-50"
                                            onClick={() => handleSort('keyword')}
                                        >
                                            <div className="flex items-center">
                                                키워드
                                                <ArrowUpDown className={`w-3 h-3 ml-1 ${sortConfig?.key === 'keyword' ? 'text-blue-500' : 'text-gray-300 opacity-0 group-hover:opacity-100'} transition-opacity`} />
                                            </div>
                                        </th>
                                        <th
                                            className="py-3 px-4 font-medium min-w-[150px] cursor-pointer hover:bg-gray-100 transition-colors group select-none relative bg-gray-50"
                                            onClick={() => handleSort('product')}
                                        >
                                            <div className="flex items-center">
                                                연결 상품명
                                                <ArrowUpDown className={`w-3 h-3 ml-1 ${sortConfig?.key === 'product' ? 'text-blue-500' : 'text-gray-300 opacity-0 group-hover:opacity-100'} transition-opacity`} />
                                            </div>
                                        </th>
                                        <th
                                            className="py-3 px-3 font-medium bg-green-50 text-green-700 border-x border-green-100 cursor-pointer hover:bg-green-100 transition-colors group select-none"
                                            onClick={() => handleSort('views_latest')}
                                        >
                                            <div className="flex items-center justify-center">
                                                조회수 (이번주)
                                                <ArrowUpDown className={`w-3 h-3 ml-1 ${sortConfig?.key === 'views_latest' ? 'text-green-600' : 'text-green-300 opacity-0 group-hover:opacity-100'} transition-opacity`} />
                                            </div>
                                        </th>
                                        <th
                                            className="py-3 px-3 font-medium bg-green-50 text-green-700 border-r border-green-100 cursor-pointer hover:bg-green-100 transition-colors group select-none"
                                            onClick={() => handleSort('views_prev')}
                                        >
                                            <div className="flex items-center justify-center">
                                                조회수 (지난주)
                                                <ArrowUpDown className={`w-3 h-3 ml-1 ${sortConfig?.key === 'views_prev' ? 'text-green-600' : 'text-green-300 opacity-0 group-hover:opacity-100'} transition-opacity`} />
                                            </div>
                                        </th>
                                        <th
                                            className="py-3 px-3 font-medium bg-green-50 text-green-700 cursor-pointer hover:bg-green-100 transition-colors group select-none"
                                            onClick={() => handleSort('trend')}
                                        >
                                            <div className="flex items-center justify-center">
                                                추이
                                                <ArrowUpDown className={`w-3 h-3 ml-1 ${sortConfig?.key === 'trend' ? 'text-green-600' : 'text-green-300 opacity-0 group-hover:opacity-100'} transition-opacity`} />
                                            </div>
                                        </th>
                                        {displayDates.map(date => {
                                            const [, m, d] = date.split('-');
                                            return <th key={date} className="py-3 px-3 font-medium bg-blue-50 border-l border-gray-200">{parseInt(m)}/{parseInt(d)}</th>
                                        })}
                                        <th className="py-3 px-4 font-medium min-w-[60px] text-center bg-gray-50">삭제</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {keywords.length === 0 && (
                                        <tr>
                                            <td colSpan={3 + displayDates.length} className="py-8 text-center text-gray-500">등록된 데이터가 없습니다.</td>
                                        </tr>
                                    )}
                                    {sortedKeywords.map(kw => {
                                        const kwRankings = rankings.filter(r => r.keyword_id === kw.id);

                                        return (
                                            <tr
                                                key={kw.id}
                                                className={`border-b border-gray-100 cursor-pointer transition ${selectedKeywordId === kw.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                                                onClick={() => setSelectedKeywordId(kw.id)}
                                            >
                                                <td
                                                    className="py-3 px-4 text-xs font-semibold text-gray-700 bg-gray-50/50 cursor-pointer hover:bg-white"
                                                    onClick={() => setEditingCategory({ id: kw.id, value: kw.category || '' })}
                                                >
                                                    {editingCategory?.id === kw.id ? (
                                                        <input
                                                            autoFocus
                                                            type="text"
                                                            className="w-full px-2 py-1 border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                                                            value={editingCategory?.value || ''}
                                                            onChange={(e) => setEditingCategory(prev => prev ? { ...prev, value: e.target.value } : null)}
                                                            onBlur={() => { if (editingCategory) handleUpdateCategory(kw.id, editingCategory.value); }}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter' && editingCategory) handleUpdateCategory(kw.id, editingCategory.value);
                                                                if (e.key === 'Escape') setEditingCategory(null);
                                                            }}
                                                            onClick={e => e.stopPropagation()}
                                                        />
                                                    ) : (
                                                        kw.category || <span className="text-gray-400 hover:text-blue-500 italic">+ 분류 추가</span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 font-medium text-blue-900">{kw.keyword}</td>
                                                <td
                                                    className="py-3 px-4 text-gray-600 text-xs cursor-pointer hover:text-blue-600 hover:underline"
                                                    title="클릭하여 순위 추이 보기"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        openChartModal(kw);
                                                    }}
                                                >
                                                    <div className="flex items-center">
                                                        {kw.products?.image_url && (
                                                            <img
                                                                src={kw.products.image_url}
                                                                alt=""
                                                                className="w-8 h-8 rounded object-cover mr-2 bg-gray-100 border border-gray-200"
                                                            />
                                                        )}
                                                        <span>{kw.products?.name || '-'}</span>
                                                    </div>
                                                </td>

                                                {/* Search Volume Columns (Moved next to Product Name) */}
                                                {(() => {
                                                    const latestSv = searchVolumes.find(sv => sv.keyword === kw.keyword && sv.target_date === latestSvDate);
                                                    const prevSv = searchVolumes.find(sv => sv.keyword === kw.keyword && sv.target_date === prevSvDate);

                                                    const latestVol = latestSv?.total_volume || 0;
                                                    const prevVol = prevSv?.total_volume || 0;
                                                    const trend = latestVol - prevVol;

                                                    return (
                                                        <>
                                                            <td className="py-3 px-3 text-center bg-green-50/30 border-x border-green-100 font-medium">
                                                                {latestVol > 0 ? latestVol.toLocaleString() : '-'}
                                                            </td>
                                                            <td className="py-3 px-3 text-center bg-green-50/30 border-r border-green-100 text-gray-500">
                                                                {prevVol > 0 ? prevVol.toLocaleString() : '-'}
                                                            </td>
                                                            <td className="py-3 px-3 text-center bg-green-50/30">
                                                                {trend !== 0 && latestVol > 0 && prevVol > 0 ? (
                                                                    <div className={`flex items-center justify-center text-[10px] font-bold ${trend > 0 ? 'text-red-500' : 'text-blue-500'}`}>
                                                                        {trend > 0 ? '+' : ''}{trend.toLocaleString()}
                                                                    </div>
                                                                ) : trend === 0 && latestVol > 0 ? (
                                                                    <Minus className="w-2.5 h-2.5 mx-auto text-gray-400" />
                                                                ) : (
                                                                    <span className="text-gray-300">-</span>
                                                                )}
                                                            </td>
                                                        </>
                                                    );
                                                })()}

                                                {displayDates.map((date, index) => {
                                                    const r = kwRankings.find(rank => rank.date === date);
                                                    const pos = r ? r.rank_position : 0;

                                                    // Calculate DoD (Day over Day)
                                                    let prevPos = 0;
                                                    if (index > 0) {
                                                        const prevDate = displayDates[index - 1];
                                                        const prevR = kwRankings.find(rank => rank.date === prevDate);
                                                        if (prevR) prevPos = prevR.rank_position;
                                                    } else {
                                                        // For the first column, check the un-displayed previous date if available
                                                        const prevDateIndex = allUniqueDates.indexOf(date) - 1;
                                                        if (prevDateIndex >= 0) {
                                                            const prevDate = allUniqueDates[prevDateIndex];
                                                            const prevR = kwRankings.find(rank => rank.date === prevDate);
                                                            if (prevR) prevPos = prevR.rank_position;
                                                        }
                                                    }

                                                    let dodElement = null;
                                                    if (pos > 0) {
                                                        if (prevPos === 0) {
                                                            dodElement = <span className="text-[9px] font-bold text-orange-500 bg-orange-50 px-1 rounded">NEW</span>;
                                                        } else if (prevPos > pos) {
                                                            dodElement = <span className="flex items-center text-[10px] text-red-500"><TrendingUp className="w-2.5 h-2.5 mr-0.5" />{prevPos - pos}</span>;
                                                        } else if (prevPos < pos) {
                                                            dodElement = <span className="flex items-center text-[10px] text-blue-500"><TrendingDown className="w-2.5 h-2.5 mr-0.5" />{pos - prevPos}</span>;
                                                        } else {
                                                            dodElement = <span className="flex items-center text-[10px] text-gray-400"><Minus className="w-2.5 h-2.5" /></span>;
                                                        }
                                                    }
                                                    return (
                                                        <td key={date} className="py-3 px-3 text-center border-l border-gray-100/50">
                                                            {pos > 0 ? (
                                                                <div className="flex flex-col items-center justify-center space-y-1">
                                                                    <div className="flex items-center space-x-1.5">
                                                                        <span className="font-semibold text-gray-800 text-sm">{pos}위</span>
                                                                        {dodElement}
                                                                    </div>
                                                                    {(r?.rating > 0 || r?.review_count > 0) && (
                                                                        <div className="flex items-center text-[10px] text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded">
                                                                            <span className="text-yellow-500 mr-0.5">★</span>
                                                                            <span>{r.rating || '-'}</span>
                                                                            <span className="mx-1">|</span>
                                                                            <span>({r.review_count || 0})</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className="text-gray-300 font-normal">-</span>
                                                            )}
                                                        </td>
                                                    )
                                                })}



                                                <td className="py-3 px-4 text-center">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteKeyword(kw.id); }}
                                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                                                        title="키워드 삭제"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
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
                <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800 flex items-center">
                                    <TrendingUp className="w-5 h-5 text-blue-500 mr-2" />
                                    순위 추이: <span className="text-blue-600 ml-1">{selectedChartKeyword.keyword}</span>
                                </h3>
                                <p className="text-sm text-gray-500 mt-1">연결 상품: {selectedChartKeyword.products?.name || '없음'}</p>
                            </div>
                            <button
                                onClick={() => setChartModalOpen(false)}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 h-[400px] w-full">
                            {(() => {
                                // If we want to show all dates even if discontinuous, remove the filter and set connectNulls={true} in Line

                                // We will show the last 30 unique dates, whether they have data or not.
                                const finalData = allUniqueDates.slice(-30).map(date => {
                                    const r = rankings.find(rank => rank.keyword_id === selectedChartKeyword.id && rank.date === date);
                                    return {
                                        date: (() => {
                                            const [, m, d] = date.split('-');
                                            return `${parseInt(m)}/${parseInt(d)}`;
                                        })(),
                                        rank: r ? r.rank_position : null
                                    };
                                });

                                if (finalData.filter(d => d.rank !== null).length === 0) {
                                    return <div className="h-full flex items-center justify-center text-gray-500">이 키워드의 순위 데이터가 없습니다.</div>;
                                }

                                return (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={finalData} margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                            <XAxis dataKey="date" tick={{ fontSize: 12 }} tickMargin={10} stroke="#cbd5e1" />
                                            <YAxis
                                                reversed
                                                tick={{ fontSize: 12 }}
                                                tickMargin={10}
                                                stroke="#cbd5e1"
                                                domain={[1, (dataMax: number) => (dataMax < 10 ? 10 : dataMax + 2)]}
                                                allowDecimals={false}
                                                label={{ value: '순위', angle: -90, position: 'insideLeft', style: { fill: '#64748b', fontSize: 13 } }}
                                            />
                                            <Tooltip
                                                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                formatter={(value: any) => [`${value}위`, '순위']}
                                                labelStyle={{ color: '#475569', fontWeight: 'bold', marginBottom: '4px' }}
                                                itemStyle={{ color: '#3b82f6', fontWeight: 'bold' }}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="rank"
                                                stroke="#3b82f6"
                                                strokeWidth={3}
                                                dot={{ r: 4, strokeWidth: 2, fill: '#fff', stroke: '#3b82f6' }}
                                                activeDot={{ r: 6, stroke: '#2563eb', strokeWidth: 2, fill: '#fff' }}
                                                connectNulls={true}
                                                animationDuration={1000}
                                            />
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
