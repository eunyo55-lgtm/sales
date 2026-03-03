import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Plus, Trash2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function KeywordRanking() {
    const [keywords, setKeywords] = useState<any[]>([]);
    const [rankings, setRankings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Form state
    const [newKeyword, setNewKeyword] = useState('');
    const [newCoupangId, setNewCoupangId] = useState('');
    const [newBarcode, setNewBarcode] = useState('');
    const [productsList, setProductsList] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);

    // UI state
    const [showManualSync, setShowManualSync] = useState(false);

    // Dashboard state
    const [selectedKeywordId, setSelectedKeywordId] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch keywords with product name
            const { data: kwData, error: kwError } = await supabase
                .from('keywords')
                .select('*, products(name)')
                .order('created_at', { ascending: false });
            if (kwError) throw kwError;
            setKeywords(kwData || []);

            // Fetch all products for dropdown (working around Supabase 1000 row limit)
            let allProducts: any[] = [];
            let from = 0;
            const limit = 1000;

            while (true) {
                const { data: prodData } = await supabase
                    .from('products')
                    .select('barcode, name')
                    .order('name')
                    .range(from, from + limit - 1);

                if (!prodData || prodData.length === 0) break;
                allProducts = [...allProducts, ...prodData];

                if (prodData.length < limit) break;
                from += limit;
            }

            // Remove duplicates by name
            const uniqueProducts = Array.from(new Map(allProducts.filter(p => p.name).map(item => [item.name, item])).values());
            setProductsList(uniqueProducts);

            // Fetch rankings (last 30 days)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

            const { data: rankData, error: rankError } = await supabase
                .from('keyword_rankings')
                .select('*')
                .gte('date', dateStr)
                .order('date', { ascending: true });

            if (rankError) throw rankError;
            setRankings(rankData || []);

            if (kwData && kwData.length > 0 && !selectedKeywordId) {
                setSelectedKeywordId(kwData[0].id);
            }
        } catch (error) {
            console.error('Error fetching keyword data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddKeyword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newKeyword.trim() || !newCoupangId.trim()) return;

        try {
            const { error } = await supabase.from('keywords').insert([
                {
                    keyword: newKeyword.trim(),
                    type: 'core',
                    coupang_product_id: newCoupangId.trim(),
                    barcode: newBarcode || null
                }
            ]);

            if (error) throw error;

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

    // Prepare chart data for selected keyword
    const chartData = rankings.filter(r => r.keyword_id === selectedKeywordId).map(r => ({
        date: r.date.substring(5), // MM-DD
        rank: r.rank_position > 0 ? r.rank_position : null
    }));

    const renderTrendIcon = (currentRank: number, prevRank: number) => {
        if (!prevRank || prevRank === 0) return <Minus className="text-gray-400 w-4 h-4" />;
        if (currentRank === 0) return <Minus className="text-gray-400 w-4 h-4" />;

        if (currentRank < prevRank) return <TrendingUp className="text-red-500 w-4 h-4" />; // Rank number is lower -> Better
        if (currentRank > prevRank) return <TrendingDown className="text-blue-500 w-4 h-4" />; // Rank number is higher -> Worse
        return <Minus className="text-gray-400 w-4 h-4" />;
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

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
                            <label className="block text-xs font-medium text-gray-600 mb-1">대상 단어 (키워드)</label>
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
                            <label className="block text-xs font-medium text-gray-600 mb-1">우리 상품 연결 검색 (선택)</label>
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

                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {loading && <p className="text-sm text-gray-500 text-center py-4">로딩 중...</p>}
                        {!loading && keywords.length === 0 && (
                            <p className="text-sm text-gray-500 text-center py-4">등록된 키워드가 없습니다.</p>
                        )}
                        {keywords.map(kw => (
                            <div
                                key={kw.id}
                                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition ${selectedKeywordId === kw.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}
                                onClick={() => setSelectedKeywordId(kw.id)}
                            >
                                <div>
                                    <div className="flex items-center space-x-2">
                                        <h4 className="font-semibold text-gray-800 text-sm">{kw.keyword}</h4>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">ID: {kw.coupang_product_id}</p>
                                    <p className="text-[10px] text-gray-400 truncate">{kw.products?.name || '연결 상품 없음'}</p>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDeleteKeyword(kw.id); }}
                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: Dashboard */}
                <div className="col-span-1 lg:col-span-2 space-y-6">
                    {/* Chart Card */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-800">순위 변동 추이 (최근 30일)</h3>
                            <button
                                onClick={() => setShowManualSync(true)}
                                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-md transition border border-gray-200"
                            >
                                ⚡ 수동 집계
                            </button>
                        </div>

                        {showManualSync && (
                            <div className="absolute top-16 right-6 bg-white p-4 rounded-lg shadow-xl border border-gray-200 z-10 w-80 text-sm">
                                <h4 className="font-bold text-gray-800 mb-2">수동으로 순위 집계하기</h4>
                                <p className="text-gray-600 mb-3 text-xs leading-relaxed">
                                    현재 랭킹 집계는 브라우저 보안 정책으로 인해 백엔드 봇이 알아서 새벽에 수행하도록 되어있습니다. 즉시 실행하시려면 다음 두 가지 방법 중 하나를 이용해 주세요:
                                </p>
                                <ul className="list-decimal pl-4 space-y-2 text-xs text-gray-700 mb-4">
                                    <li><b>GitHub Actions 이용:</b> GitHub 리포지토리의 <a href="https://github.com/eunyo55-lgtm/sales/actions/workflows/rank-scraper.yml" target="_blank" rel="noreferrer" className="text-blue-500 underline">Actions 탭</a>으로 이동하여 우측의 [Run workflow] 버튼을 클릭하세요. (1~2분 소요)</li>
                                    <li><b>로컬 PC 이용:</b> VSCode 터미널을 열고 <code>cd scraper && npm start</code> 를 입력하여 직접 봇을 가동합니다.</li>
                                </ul>
                                <div className="flex justify-end">
                                    <button onClick={() => setShowManualSync(false)} className="px-3 py-1 bg-blue-50 text-blue-600 rounded text-xs font-medium hover:bg-blue-100">닫기</button>
                                </div>
                            </div>
                        )}
                        {selectedKeywordId ? (
                            <div className="h-72 w-full">
                                {chartData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                            <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                                            <YAxis reversed={true} domain={[1, 'dataMax']} tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                                            <Tooltip
                                                formatter={(value: any) => [`${value}위`, '자연 순위']}
                                                labelStyle={{ color: '#374151', fontWeight: 'bold' }}
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Legend verticalAlign="top" height={36} />
                                            <Line type="monotone" name="노출 순위" dataKey="rank" stroke="#3B82F6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} connectNulls={true} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-gray-400">
                                        데이터가 수집되지 않았습니다.
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="h-72 flex items-center justify-center bg-gray-50 rounded-lg text-gray-500 border border-dashed border-gray-300">
                                좌측에서 키워드를 선택해주세요
                            </div>
                        )}
                    </div>

                    {/* Summary Table */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden text-sm">
                        <div className="p-4 border-b border-gray-200 bg-gray-50">
                            <h3 className="font-bold text-gray-800">전체 키워드 순위 현황</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 text-gray-500 border-b border-gray-200 text-xs">
                                        <th className="py-3 px-4 font-medium">단어 (키워드)</th>
                                        <th className="py-3 px-4 font-medium">연결 상품명</th>
                                        <th className="py-3 px-4 font-medium">Product ID</th>
                                        <th className="py-3 px-4 font-medium text-right">최신 순위</th>
                                        <th className="py-3 px-4 font-medium text-center">전일 대비</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {keywords.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="py-8 text-center text-gray-500">등록된 데이터가 없습니다.</td>
                                        </tr>
                                    )}
                                    {keywords.map(kw => {
                                        const kwRankings = rankings.filter(r => r.keyword_id === kw.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                                        const latest = kwRankings.length > 0 ? kwRankings[0].rank_position : 0;
                                        const prev = kwRankings.length > 1 ? kwRankings[1].rank_position : 0;

                                        return (
                                            <tr key={kw.id} className="border-b border-gray-100 hover:bg-gray-50">
                                                <td className="py-3 px-4 font-medium text-gray-800">{kw.keyword}</td>
                                                <td className="py-3 px-4 text-gray-600 text-xs max-w-[150px] truncate" title={kw.products?.name}>
                                                    {kw.products?.name || '-'}
                                                </td>
                                                <td className="py-3 px-4 text-gray-500 text-xs font-mono">{kw.coupang_product_id}</td>
                                                <td className="py-3 px-4 text-right font-semibold text-gray-800">
                                                    {latest > 0 ? `${latest}위` : <span className="text-gray-400 font-normal">미노출</span>}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center justify-center">
                                                        {renderTrendIcon(latest, prev)}
                                                        <span className="text-xs text-gray-500 ml-1">
                                                            {latest > 0 && prev > 0 && latest !== prev ? Math.abs(prev - latest) : '-'}
                                                        </span>
                                                    </div>
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
        </div>
    );
}
