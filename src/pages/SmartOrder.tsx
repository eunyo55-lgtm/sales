import { useState, useEffect, useMemo } from 'react';
import { api, type ProductStats } from '../lib/api';
import { Truck, AlertTriangle, Search, ChevronRight, ChevronDown } from 'lucide-react';

interface RecommendedProduct extends ProductStats {
    requiredStock: number;
    recommendation: number;
    stockoutDate: number;
}

interface GroupedSmartOrder {
    name: string;
    imageUrl?: string;
    abcGrade: 'A' | 'B' | 'C' | 'D'; // Representative grade
    totalCurrentStock: number;
    totalHqStock: number; // [NEW]
    totalIncomingStock: number; // [NEW]
    totalAvgDailySales: number;
    totalRecommendation: number;
    isUrgent: boolean; // True if any child is urgent
    children: RecommendedProduct[];
}

export default function SmartOrder() {
    const [products, setProducts] = useState<ProductStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<{ message: string, sql?: string } | null>(null);

    // Config
    const [leadTime, setLeadTime] = useState(14); // Default 14 days
    const [safetyBuffer, setSafetyBuffer] = useState(2); // Default 2 days

    // Filters
    const [search, setSearch] = useState('');
    const [selectedGrade, setSelectedGrade] = useState<'ALL' | 'A' | 'B' | 'C' | 'D'>('ALL');

    // UI State
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [sortConfig, setSortConfig] = useState<{ key: keyof GroupedSmartOrder, direction: 'asc' | 'desc' } | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const data = await api.getProductStats();
            setProducts(data);
        } catch (error: any) {
            console.error(error);
            const msg = error.message || '알 수 없는 오류';
            if (msg.includes('incoming_stock')) {
                setError({
                    message: "데이터베이스에 'incoming_stock' 컬럼이 없습니다. 아래 SQL을 복사하여 Supabase SQL Editor에서 실행해주세요.",
                    sql: "ALTER TABLE products ADD COLUMN IF NOT EXISTS incoming_stock INTEGER DEFAULT 0;"
                });
            } else {
                setError({ message: msg });
            }
        } finally {
            setLoading(false);
        }
    };

    const toggleGroup = (name: string) => {
        const newExpanded = new Set(expandedGroups);
        if (newExpanded.has(name)) {
            newExpanded.delete(name);
        } else {
            newExpanded.add(name);
        }
        setExpandedGroups(newExpanded);
    };

    const handleSort = (key: keyof GroupedSmartOrder) => {
        let direction: 'asc' | 'desc' = 'desc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const groupedOrders = useMemo(() => {
        // 1. Calculate recommendation for each product variant
        const calculated = products.map(p => {
            const daysNeeded = leadTime + safetyBuffer;
            const requiredStock = p.avgDailySales * daysNeeded;
            // Recommendation = Required - (Current + Incoming)
            const netRecommended = requiredStock - (p.coupangStock + (p.incomingStock || 0));
            const recommendation = Math.max(0, Math.ceil(netRecommended));

            return {
                ...p,
                requiredStock,
                recommendation,
                stockoutDate: p.daysOfInventory
            } as RecommendedProduct;
        }).filter(p => p.recommendation > 0 || (p.incomingStock || 0) > 0); // Show if recommendation > 0 OR coming soon

        // 2. Group by Name
        const groups = new Map<string, GroupedSmartOrder>();

        calculated.forEach(p => {
            if (!groups.has(p.name)) {
                groups.set(p.name, {
                    name: p.name,
                    imageUrl: p.imageUrl,
                    abcGrade: p.abcGrade, // Initial grade from first item
                    totalCurrentStock: 0,
                    totalHqStock: 0, // [NEW]
                    totalIncomingStock: 0,
                    totalAvgDailySales: 0,
                    totalRecommendation: 0,
                    isUrgent: false,
                    children: []
                });
            }
            const group = groups.get(p.name)!;
            group.totalCurrentStock += p.coupangStock;
            group.totalHqStock += (p.hqStock || 0); // Aggregate HQ Stock
            group.totalIncomingStock += (p.incomingStock || 0);
            group.totalAvgDailySales += p.avgDailySales;
            group.totalRecommendation += p.recommendation;

            // Check urgency (if stockout date <= leadtime)
            if (p.stockoutDate <= leadTime) {
                group.isUrgent = true;
            }

            // Update Grade Logic: A > B > C > D
            if (p.abcGrade === 'A') group.abcGrade = 'A';
            else if (p.abcGrade === 'B' && group.abcGrade !== 'A') group.abcGrade = 'B';
            else if (p.abcGrade === 'C' && group.abcGrade !== 'A' && group.abcGrade !== 'B') group.abcGrade = 'C';

            group.children.push(p);
        });

        // 3. Filter & Sort Groups
        return Array.from(groups.values())
            .filter(g => {
                if (selectedGrade !== 'ALL' && g.abcGrade !== selectedGrade) return false;
                if (search && !g.name.toLowerCase().includes(search.toLowerCase())) return false;
                return true;
            })
            .sort((a, b) => {
                // If custom sort is active
                // If custom sort is active
                if (sortConfig) {
                    const { key, direction } = sortConfig;
                    const aVal = (a as any)[key];
                    const bVal = (b as any)[key];

                    // Handle boolean sorting specifically
                    if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
                        if (direction === 'asc') return (aVal === bVal) ? 0 : aVal ? -1 : 1;
                        else return (aVal === bVal) ? 0 : aVal ? 1 : -1;
                    }

                    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
                    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
                    return 0;
                }

                // Default Sort: Urgency first, then total recommendation desc
                if (a.isUrgent !== b.isUrgent) return a.isUrgent ? -1 : 1;
                return b.totalRecommendation - a.totalRecommendation;
            })
            // Sort Children by Barcode ASC
            .map(g => ({
                ...g,
                children: g.children.sort((a, b) => a.barcode.localeCompare(b.barcode))
            }));

    }, [products, leadTime, safetyBuffer, selectedGrade, search, sortConfig]);

    if (loading) return <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;

    if (error) return (
        <div className="flex justify-center items-center h-full p-6">
            <div className="bg-red-50 border border-red-200 rounded-xl p-8 max-w-2xl w-full text-center space-y-4 shadow-sm">
                <AlertTriangle className="mx-auto text-red-500 mb-2" size={48} />
                <h3 className="text-xl font-bold text-red-700">데이터 불러오기 실패</h3>
                <p className="text-red-600">{error.message}</p>

                {error.sql && (
                    <div className="mt-4 bg-gray-900 rounded-lg p-4 text-left relative group">
                        <code className="text-green-400 font-mono text-sm block break-all">
                            {error.sql}
                        </code>
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(error.sql!);
                                alert("SQL 코드가 복사되었습니다!");
                            }}
                            className="absolute top-2 right-2 px-3 py-1 bg-white/10 hover:bg-white/20 text-white text-xs rounded transition-colors"
                        >
                            코드 복사
                        </button>
                    </div>
                )}

                <button
                    onClick={() => window.location.reload()}
                    className="mt-6 px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                >
                    새로고침
                </button>
            </div>
        </div>
    );

    return (
        <div className="space-y-6 h-full flex flex-col">
            {/* Control Panel */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex-none">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Left: Settings */}
                    <div className="space-y-4">
                        <div className="flex items-center space-x-2 mb-2">
                            <Truck className="text-blue-600" />
                            <h2 className="text-lg font-bold text-gray-800">발주 설정 (Lead Time)</h2>
                        </div>

                        <div>
                            <div className="flex justify-between mb-1">
                                <label className="text-sm font-medium text-gray-700">배송 리드타임</label>
                                <span className="text-sm font-bold text-blue-600">{leadTime}일</span>
                            </div>
                            <input
                                type="range"
                                min="1"
                                max="60"
                                value={leadTime}
                                onChange={(e) => setLeadTime(Number(e.target.value))}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                        </div>

                        <div>
                            <div className="flex justify-between mb-1">
                                <label className="text-sm font-medium text-gray-700">안전 재고 버퍼</label>
                                <span className="text-sm font-bold text-green-600">{safetyBuffer}일</span>
                            </div>
                            <div className="flex space-x-2">
                                {[1, 2, 3, 5, 7].map(d => (
                                    <button
                                        key={d}
                                        onClick={() => setSafetyBuffer(d)}
                                        className={`px-3 py-1 text-xs rounded-full border transition-colors ${safetyBuffer === d
                                            ? 'bg-green-50 border-green-200 text-green-700 font-bold'
                                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                            }`}
                                    >
                                        +{d}일
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right: Summary */}
                    <div className="bg-blue-50/50 rounded-lg p-5 border border-blue-100 flex flex-col justify-center">
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-sm text-gray-600 font-medium">총 발주 추천 상품 (그룹)</span>
                            <span className="text-2xl font-bold text-gray-900">{groupedOrders.length}개</span>
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                            <p>• 기준: 일평균 판매량 × <strong className="text-blue-700">{leadTime + safetyBuffer}일치</strong> 재고 확보</p>
                            <p>• {groupedOrders.length > 0 ? '지금 발주하면 품절을 막을 수 있습니다!' : '현재 재고가 충분합니다.'}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* List Header & Filters */}
            <div className="flex justify-between items-center flex-none">
                <div className="flex items-center space-x-4">
                    <h3 className="font-bold text-gray-800">발주 추천 리스트</h3>

                    {/* Grade Filters */}
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        {(['ALL', 'A', 'B', 'C', 'D'] as const).map(grade => (
                            <button
                                key={grade}
                                onClick={() => setSelectedGrade(grade)}
                                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${selectedGrade === grade
                                    ? 'bg-white text-blue-600 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                {grade === 'ALL' ? '전체' : `${grade}등급`}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="text"
                        placeholder="상품명 검색..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 w-64"
                    />
                </div>
            </div>

            {/* List Content */}
            <div className="flex-1 overflow-auto bg-white rounded-xl border border-gray-200 shadow-sm relative">
                {groupedOrders.length === 0 ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                        <Truck size={48} className="mb-4 text-gray-300" />
                        <p className="text-lg font-medium">발주가 필요한 상품이 없습니다.</p>
                        <p className="text-sm">현재 설정된 리드타임({leadTime}일) 기준 재고가 넉넉합니다.</p>
                    </div>
                ) : (
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0 z-10 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 w-8"></th>
                                <th
                                    className="px-6 py-3 font-medium cursor-pointer hover:bg-gray-100"
                                    onClick={() => handleSort('name')}
                                >
                                    상품명 / 등급 {sortConfig?.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                    className="px-6 py-3 font-medium text-right cursor-pointer hover:bg-gray-100"
                                    onClick={() => handleSort('totalHqStock')}
                                >
                                    본사재고 {sortConfig?.key === 'totalHqStock' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                    className="px-6 py-3 font-medium text-right cursor-pointer hover:bg-gray-100"
                                    onClick={() => handleSort('totalCurrentStock')}
                                >
                                    쿠팡재고(총 현재고) {sortConfig?.key === 'totalCurrentStock' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                    className="px-6 py-3 font-medium text-right cursor-pointer hover:bg-gray-100"
                                    onClick={() => handleSort('totalIncomingStock')}
                                >
                                    이동중 재고 {sortConfig?.key === 'totalIncomingStock' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                    className="px-6 py-3 font-medium text-right cursor-pointer hover:bg-gray-100"
                                    onClick={() => handleSort('totalAvgDailySales')}
                                >
                                    총 일평균 판매 {sortConfig?.key === 'totalAvgDailySales' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                    className="px-6 py-3 font-medium text-right text-blue-700 bg-blue-50 cursor-pointer hover:bg-blue-100"
                                    onClick={() => handleSort('totalRecommendation')}
                                >
                                    총 추천 발주량 {sortConfig?.key === 'totalRecommendation' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                    className="px-6 py-3 font-medium text-center cursor-pointer hover:bg-gray-100"
                                    onClick={() => handleSort('isUrgent')}
                                >
                                    상태 {sortConfig?.key === 'isUrgent' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {groupedOrders.map((group) => {
                                const isExpanded = expandedGroups.has(group.name);
                                return (
                                    <>
                                        {/* Group Row */}
                                        <tr
                                            key={group.name}
                                            className={`hover:bg-gray-50 transition-colors cursor-pointer ${isExpanded ? 'bg-gray-50' : ''}`}
                                            onClick={() => toggleGroup(group.name)}
                                        >
                                            <td className="px-6 py-4 text-gray-400">
                                                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center">
                                                    {group.imageUrl && (
                                                        <img src={group.imageUrl} alt="" className="w-10 h-10 rounded object-cover mr-3 bg-gray-100" />
                                                    )}
                                                    <div>
                                                        <div className="font-medium text-gray-900 line-clamp-1">{group.name}</div>
                                                        <div className="flex items-center mt-1 space-x-2">
                                                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${group.abcGrade === 'A' ? 'bg-red-50 text-red-600 border-red-200 font-bold' :
                                                                group.abcGrade === 'B' ? 'bg-green-50 text-green-600 border-green-200 font-medium' :
                                                                    group.abcGrade === 'C' ? 'bg-gray-50 text-gray-500 border-gray-200' :
                                                                        'bg-gray-50 text-gray-400 border-gray-100'
                                                                }`}>
                                                                {group.abcGrade}등급
                                                            </span>
                                                            <span className="text-xs text-gray-400">{group.children.length} 옵션</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono text-gray-600">
                                                {group.totalHqStock?.toLocaleString() || 0}
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono text-gray-600">
                                                {group.totalCurrentStock.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono text-green-600">
                                                {group.totalIncomingStock > 0 ? `+${group.totalIncomingStock.toLocaleString()}` : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono text-gray-600">
                                                {group.totalAvgDailySales.toFixed(1)}개
                                            </td>
                                            <td className="px-6 py-4 text-right bg-blue-50/30">
                                                <span className="text-lg font-bold text-blue-600">
                                                    {group.totalRecommendation.toLocaleString()}
                                                </span>
                                                <span className="text-xs text-gray-400 ml-1">개</span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {group.isUrgent ? (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                        <AlertTriangle size={12} className="mr-1" />
                                                        긴급
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                                        준비
                                                    </span>
                                                )}
                                            </td>
                                        </tr>

                                        {/* Child Rows (Details) */}
                                        {isExpanded && group.children.map(child => {
                                            const isChildUrgent = child.stockoutDate <= leadTime;
                                            return (
                                                <tr key={child.barcode} className="bg-gray-50/50">
                                                    <td className="px-6 py-3"></td>
                                                    <td className="px-6 py-3 pl-16 text-sm text-gray-500 flex items-center">
                                                        <span className="w-2 h-2 rounded-full bg-gray-300 mr-2"></span>
                                                        <div className="flex flex-col">
                                                            <span className="font-mono text-xs text-gray-400">{child.barcode}</span>
                                                            <span className="text-gray-700 font-medium">{child.option || child.season || '옵션 정보 없음'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-3 text-right text-sm text-gray-500 font-mono">
                                                        {child.hqStock?.toLocaleString() || 0}
                                                    </td>
                                                    <td className="px-6 py-3 text-right text-sm text-gray-500 font-mono">
                                                        {child.coupangStock.toLocaleString()}
                                                        {child.incomingStock > 0 && (
                                                            <span className="text-green-600 text-xs ml-1">(+{child.incomingStock})</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-3 text-right text-sm text-gray-500 font-mono">
                                                        {child.avgDailySales.toFixed(1)}
                                                    </td>
                                                    <td className="px-6 py-3 text-right font-bold text-blue-600 bg-blue-50/10">
                                                        {child.recommendation.toLocaleString()}
                                                    </td>
                                                    <td className="px-6 py-3 text-right text-xs">
                                                        <span className={isChildUrgent ? 'text-red-500 font-bold' : 'text-gray-500'}>
                                                            {child.stockoutDate.toFixed(1)}일 후 소진
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
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
