import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Plus, Trash2, ArrowUpDown } from 'lucide-react';

export default function KeywordRanking() {
    const [keywords, setKeywords] = useState<any[]>([]);
    const [rankings, setRankings] = useState<any[]>([]);

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

    // Dashboard state
    const [selectedKeywordId, setSelectedKeywordId] = useState<string | null>(null);
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'category', direction: 'asc' });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
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
                .select('id, keyword_id, date, rank_position, rating, review_count')
                .gte('date', dateStr)
                .order('date', { ascending: true });

            if (rankError) throw rankError;
            setRankings(rankData || []);

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



    // Extract unique dates for table columns (last 7 days of data)
    const allUniqueDates = Array.from(new Set(rankings.map(r => r.date))).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    const displayDates = allUniqueDates.slice(-7);

    // Sorting logic
    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    const sortedKeywords = [...keywords].sort((a, b) => {
        if (!sortConfig) return 0;
        let aValue = '';
        let bValue = '';

        if (sortConfig.key === 'category') {
            aValue = a.category?.toLowerCase() || '';
            bValue = b.category?.toLowerCase() || '';
        } else if (sortConfig.key === 'keyword') {
            aValue = a.keyword.toLowerCase();
            bValue = b.keyword.toLowerCase();
        } else if (sortConfig.key === 'product') {
            aValue = a.products?.name?.toLowerCase() || '';
            bValue = b.products?.name?.toLowerCase() || '';
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });



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
                <div className="col-span-1 lg:col-span-2 space-y-6">
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
                    </div>

                    {/* Summary Table */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden text-sm">
                        <div className="p-4 border-b border-gray-200 bg-gray-50">
                            <h3 className="font-bold text-gray-800">키워드별 순위 누적 현황</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 text-gray-500 border-b border-gray-200 text-xs shadow-sm">
                                        <th 
                                            className="py-3 px-4 font-medium min-w-[100px] cursor-pointer hover:bg-gray-100 transition-colors group select-none relative z-10" 
                                            onClick={() => handleSort('category')}
                                        >
                                            <div className="flex items-center">
                                                분류
                                                <ArrowUpDown className={`w-3 h-3 ml-1 ${sortConfig?.key === 'category' ? 'text-blue-500' : 'text-gray-300 opacity-0 group-hover:opacity-100'} transition-opacity`} />
                                            </div>
                                        </th>
                                        <th 
                                            className="py-3 px-4 font-medium min-w-[120px] cursor-pointer hover:bg-gray-100 transition-colors group select-none relative z-10"
                                            onClick={() => handleSort('keyword')}
                                        >
                                            <div className="flex items-center">
                                                키워드
                                                <ArrowUpDown className={`w-3 h-3 ml-1 ${sortConfig?.key === 'keyword' ? 'text-blue-500' : 'text-gray-300 opacity-0 group-hover:opacity-100'} transition-opacity`} />
                                            </div>
                                        </th>
                                        <th 
                                            className="py-3 px-4 font-medium min-w-[150px] cursor-pointer hover:bg-gray-100 transition-colors group select-none relative z-10"
                                            onClick={() => handleSort('product')}
                                        >
                                            <div className="flex items-center">
                                                연결 상품명
                                                <ArrowUpDown className={`w-3 h-3 ml-1 ${sortConfig?.key === 'product' ? 'text-blue-500' : 'text-gray-300 opacity-0 group-hover:opacity-100'} transition-opacity`} />
                                            </div>
                                        </th>
                                        {displayDates.map(date => (
                                            <th key={date} className="py-3 px-3 font-medium bg-blue-50/50">{date.substring(5).replace('-', '/')}</th>
                                        ))}
                                        <th className="py-3 px-4 font-medium min-w-[60px]">관리</th>
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
                                                <td className="py-3 px-4 text-xs font-semibold text-gray-700 bg-gray-50/50">
                                                    {kw.category || '-'}
                                                </td>
                                                <td className="py-3 px-4 font-medium text-blue-900">{kw.keyword}</td>
                                                <td className="py-3 px-4 text-gray-600 text-xs max-w-[150px] truncate" title={kw.products?.name}>
                                                    {kw.products?.name || '-'}
                                                </td>
                                                {displayDates.map(date => {
                                                    const r = kwRankings.find(rank => rank.date === date);
                                                    const pos = r ? r.rank_position : 0;
                                                    return (
                                                        <td key={date} className="py-3 px-3 text-center border-l border-gray-100/50">
                                                            {pos > 0 ? (
                                                                <div className="flex flex-col items-center justify-center space-y-1">
                                                                    <span className="font-semibold text-gray-800 text-sm">{pos}위</span>
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
        </div>
    );
}
