import { useState, useEffect, useMemo } from 'react';
import { api, type ProductStats } from '../lib/api';
import { Lightbulb, AlertCircle, Search, ChevronRight, ChevronDown, Megaphone, Tag } from 'lucide-react';

interface DeadStockGroup {
    name: string;
    imageUrl?: string;
    season: string;
    totalStock: number; // HQ + Coupang
    sales30Days: number;
    sales7Days: number;
    children: ProductStats[];
}

export default function Insights() {
    const [products, setProducts] = useState<ProductStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedSeason, setSelectedSeason] = useState<string>('ALL');
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const data = await api.getProductStats();
            setProducts(data);
        } catch (error) {
            console.error("Failed to load insights data", error);
        } finally {
            setLoading(false);
        }
    };

    const toggleGroup = (name: string) => {
        const newExpanded = new Set(expandedGroups);
        if (newExpanded.has(name)) newExpanded.delete(name);
        else newExpanded.add(name);
        setExpandedGroups(newExpanded);
    };

    // Extract unique seasons
    const availableSeasons = useMemo(() => {
        const seasons = new Set<string>();
        products.forEach(p => {
            if (p.season && p.season.trim() !== '') {
                seasons.add(p.season.trim());
            }
        });
        return Array.from(seasons).sort();
    }, [products]);

    // Grouping & Filtering for Dead Stock
    const deadStockGroups = useMemo(() => {
        const groups = new Map<string, DeadStockGroup>();

        // Criteria for Dead Stock: C or D grade (low sales) but has stock. OR 0 sales in 30 days.
        const deadItems = products.filter(p => {
            const totalStock = (p.hqStock || 0) + p.coupangStock;
            if (totalStock <= 0) return false; // Ignore if no stock
            if (p.abcGrade === 'D' || p.abcGrade === 'C' || p.sales30Days <= 3) return true;
            return false;
        });

        deadItems.forEach(p => {
            if (!groups.has(p.name)) {
                groups.set(p.name, {
                    name: p.name,
                    imageUrl: p.imageUrl,
                    season: p.season || '기타',
                    totalStock: 0,
                    sales30Days: 0,
                    sales7Days: 0,
                    children: []
                });
            }
            const group = groups.get(p.name)!;
            group.totalStock += (p.hqStock || 0) + p.coupangStock;
            group.sales30Days += (p.sales30Days || 0);
            group.sales7Days += (p.sales7Days || 0);
            group.children.push(p);
        });

        return Array.from(groups.values())
            .filter(g => {
                if (selectedSeason !== 'ALL' && g.season !== selectedSeason) return false;
                if (search && !g.name.toLowerCase().includes(search.toLowerCase())) return false;
                return true;
            })
            // Sort by highest stock first
            .sort((a, b) => b.totalStock - a.totalStock);
    }, [products, selectedSeason, search]);

    if (loading) return <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div></div>;

    return (
        <div className="space-y-6 h-full flex flex-col">
            {/* Header Card */}
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100 p-6 rounded-xl shadow-sm flex flex-col md:flex-row items-center justify-between flex-none">
                <div className="flex items-start md:items-center space-x-4 mb-4 md:mb-0">
                    <div className="p-3 bg-purple-100 text-purple-600 rounded-full flex-shrink-0">
                        <Lightbulb size={28} />
                    </div>
                    <div>
                        <h3 className="text-purple-900 font-bold text-lg">악성 재고 (Dead Stock) 인사이트</h3>
                        <p className="text-purple-700 text-sm mt-1">
                            재고 수량은 많지만 최근 판매량이 저조한 상품 목록입니다.<br />
                            시즌이 지났거나 정체된 상품은 <b>기획전 제안</b>이나 <b>광고 부스팅</b>을 통해 소진을 유도하세요.
                        </p>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm border border-purple-100 text-center min-w-[150px]">
                    <p className="text-sm font-medium text-gray-500 mb-1">총 체화 재고량</p>
                    <p className="text-2xl font-bold text-purple-700">
                        {deadStockGroups.reduce((acc, g) => acc + g.totalStock, 0).toLocaleString()} <span className="text-sm">개</span>
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex justify-between items-center flex-none">
                <div className="flex items-center space-x-4">
                    <h3 className="font-bold text-gray-800">잠재 체화 상품 리스트 ({deadStockGroups.length}종)</h3>

                    {/* Season Filter Dropdown */}
                    <div className="relative">
                        <select
                            value={selectedSeason}
                            onChange={(e) => setSelectedSeason(e.target.value)}
                            className="appearance-none bg-white border border-gray-200 text-gray-700 py-2 pl-4 pr-10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 cursor-pointer font-medium shadow-sm transition-all"
                        >
                            <option value="ALL">전체 시즌</option>
                            {availableSeasons.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                            <ChevronDown size={14} />
                        </div>
                    </div>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="text"
                        placeholder="상품명 검색..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-100 w-64"
                    />
                </div>
            </div>

            {/* Table Area */}
            <div className="flex-1 overflow-auto bg-white rounded-xl border border-gray-200 shadow-sm relative">
                {deadStockGroups.length === 0 ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                        <AlertCircle size={48} className="mb-4 text-gray-300" />
                        <p className="text-lg font-medium">해당 조건의 악성 재고가 없습니다.</p>
                    </div>
                ) : (
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0 z-10 border-b border-gray-200">
                            <tr>
                                <th className="px-5 py-3 w-8"></th>
                                <th className="px-5 py-3 font-medium">상품명 / 시즌</th>
                                <th className="px-5 py-3 font-medium text-right">총 재고 (본사+쿠팡)</th>
                                <th className="px-5 py-3 font-medium text-right">최근 30일 판매량</th>
                                <th className="px-5 py-3 font-medium text-center">추천 액션</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {deadStockGroups.map((group) => {
                                const isExpanded = expandedGroups.has(group.name);
                                return (
                                    <>
                                        {/* Parent Row */}
                                        <tr
                                            key={group.name}
                                            className={`hover:bg-gray-50 transition-colors cursor-pointer ${isExpanded ? 'bg-purple-50/20' : ''}`}
                                            onClick={() => toggleGroup(group.name)}
                                        >
                                            <td className="px-5 py-4 text-gray-400">
                                                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center">
                                                    {group.imageUrl ? (
                                                        <img src={group.imageUrl} alt="" className="w-10 h-10 rounded object-cover mr-3 bg-gray-100" />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded bg-gray-100 mr-3"></div>
                                                    )}
                                                    <div>
                                                        <div className="font-medium text-gray-900">{group.name}</div>
                                                        <div className="flex items-center mt-1 space-x-2">
                                                            <span className="text-[10px] px-1.5 py-0.5 rounded border bg-gray-50 text-gray-500 border-gray-200">
                                                                {group.season}
                                                            </span>
                                                            <span className="text-xs text-gray-400">{group.children.length} 옵션</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <span className="font-bold text-gray-900 text-lg">{group.totalStock.toLocaleString()}</span>
                                                <span className="text-xs text-gray-500 ml-1">개</span>
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <span className="font-mono text-gray-600">{group.sales30Days.toLocaleString()}</span> 개
                                                {group.sales7Days === 0 && (
                                                    <div className="text-[10px] text-red-500 mt-1">※ 최근 7일 판매 0건</div>
                                                )}
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex justify-center space-x-2">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); alert(`${group.name}에 대한 기획전 제안서를 준비합니다. (기능 준비중)`); }}
                                                        className="flex items-center px-3 py-1.5 bg-pink-50 text-pink-600 border border-pink-200 hover:bg-pink-100 hover:border-pink-300 rounded-md transition-colors text-xs font-medium"
                                                    >
                                                        <Tag size={13} className="mr-1" /> 행사 제안
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); alert(`${group.name}에 대한 광고 예산을 편성합니다. (기능 준비중)`); }}
                                                        className="flex items-center px-3 py-1.5 bg-purple-50 text-purple-600 border border-purple-200 hover:bg-purple-100 hover:border-purple-300 rounded-md transition-colors text-xs font-medium"
                                                    >
                                                        <Megaphone size={13} className="mr-1" /> 광고 전개
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>

                                        {/* Child Options rows */}
                                        {isExpanded && group.children.map(child => (
                                            <tr key={child.barcode} className="bg-gray-50/50">
                                                <td className="px-5 py-3"></td>
                                                <td className="px-5 py-3 pl-14 text-sm flex items-center">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-gray-300 mr-3"></span>
                                                    <div className="flex flex-col">
                                                        <span className="font-mono text-xs text-gray-400">{child.barcode}</span>
                                                        <span className="text-gray-700 font-medium">{child.option || '단일 옵션'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3 text-right">
                                                    <div className="text-sm font-mono text-gray-600">
                                                        {(child.hqStock || 0) + child.coupangStock}
                                                    </div>
                                                    <div className="text-[10px] text-gray-400">
                                                        (본사: {child.hqStock || 0}, 쿠팡: {child.coupangStock})
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3 text-right text-sm text-gray-500 font-mono">
                                                    {child.sales30Days || 0}
                                                </td>
                                                <td className="px-5 py-3 text-center">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${child.abcGrade === 'D' ? 'bg-red-50 text-red-600' :
                                                            child.abcGrade === 'C' ? 'bg-orange-50 text-orange-600' :
                                                                'bg-gray-100 text-gray-500'
                                                        }`}>
                                                        {child.abcGrade}등급
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
