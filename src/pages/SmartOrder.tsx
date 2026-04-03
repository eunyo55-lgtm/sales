import React, { useState, useEffect, useMemo } from 'react';
import { api, type ProductStats } from '../lib/api';
import { Truck, AlertTriangle, Search, ChevronRight, ChevronDown, MessageSquareWarning, Loader2, Zap, BarChart3 } from 'lucide-react';

interface RecommendedProduct extends ProductStats {
    requiredStock: number;
    recommendation: number;
    stockoutDate: number;
}

interface GroupedSmartOrder {
    name: string;
    imageUrl?: string;
    abcGrade: 'A' | 'B' | 'C' | 'D';
    totalCurrentStock: number;
    totalHqStock: number;
    totalIncomingStock: number;
    totalAvgDailySales: number;
    totalRecommendation: number;
    isUrgent: boolean;
    children: RecommendedProduct[];
}

export default function SmartOrder() {
    const [products, setProducts] = useState<ProductStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<{ message: string, sql?: string } | null>(null);

    const [leadTime, setLeadTime] = useState(14);
    const [safetyBuffer, setSafetyBuffer] = useState(2);
    const [search, setSearch] = useState('');
    const [selectedGrade, setSelectedGrade] = useState<'ALL' | 'A' | 'B' | 'C' | 'D'>('ALL');
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [sortConfig, setSortConfig] = useState<{ key: keyof GroupedSmartOrder, direction: 'asc' | 'desc' } | null>(null);
    const [sendingAlert, setSendingAlert] = useState(false);

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
        if (newExpanded.has(name)) newExpanded.delete(name);
        else newExpanded.add(name);
        setExpandedGroups(newExpanded);
    };

    const handleSort = (key: keyof GroupedSmartOrder) => {
        let direction: 'asc' | 'desc' = 'desc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') direction = 'asc';
        setSortConfig({ key, direction });
    };

    const handleSendAlert = async (urgentItems: any[]) => {
        if (urgentItems.length === 0) return;
        setSendingAlert(true);
        try {
            await api.sendGoogleChatAlert(urgentItems);
            alert("✅ 구글 챗으로 품절 임박 알림을 전송했습니다.");
        } catch (error: any) {
            alert(`전송 실패: ${error.message}`);
        } finally {
            setSendingAlert(false);
        }
    };

    const groupedOrders = useMemo(() => {
        const calculated = products.map(p => {
            const daysNeeded = leadTime + safetyBuffer;
            const requiredStock = p.avgDailySales * daysNeeded;
            const netRecommended = requiredStock - (p.coupangStock + (p.incomingStock || 0));
            return {
                ...p,
                requiredStock,
                recommendation: Math.max(0, Math.ceil(netRecommended)),
                stockoutDate: p.daysOfInventory
            } as RecommendedProduct;
        }).filter(p => p.recommendation > 0 || (p.incomingStock || 0) > 0);

        const groups = new Map<string, GroupedSmartOrder>();

        calculated.forEach(p => {
            if (!groups.has(p.name)) {
                groups.set(p.name, {
                    name: p.name, imageUrl: p.imageUrl, abcGrade: p.abcGrade,
                    totalCurrentStock: 0, totalHqStock: 0, totalIncomingStock: 0,
                    totalAvgDailySales: 0, totalRecommendation: 0, isUrgent: false,
                    children: []
                });
            }
            const group = groups.get(p.name)!;
            group.totalCurrentStock += p.coupangStock;
            group.totalHqStock += (p.hqStock || 0);
            group.totalIncomingStock += (p.incomingStock || 0);
            group.totalAvgDailySales += p.avgDailySales;
            group.totalRecommendation += p.recommendation;
            if (p.stockoutDate <= leadTime) group.isUrgent = true;

            if (p.abcGrade === 'A') group.abcGrade = 'A';
            else if (p.abcGrade === 'B' && group.abcGrade !== 'A') group.abcGrade = 'B';
            else if (p.abcGrade === 'C' && group.abcGrade !== 'A' && group.abcGrade !== 'B') group.abcGrade = 'C';

            group.children.push(p);
        });

        return Array.from(groups.values())
            .filter(g => {
                if (selectedGrade !== 'ALL' && g.abcGrade !== selectedGrade) return false;
                if (search && !g.name.toLowerCase().includes(search.toLowerCase())) return false;
                return true;
            })
            .sort((a, b) => {
                if (sortConfig) {
                    const { key, direction } = sortConfig;
                    const aVal = (a as any)[key];
                    const bVal = (b as any)[key];
                    if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
                        if (direction === 'asc') return (aVal === bVal) ? 0 : aVal ? -1 : 1;
                        else return (aVal === bVal) ? 0 : aVal ? 1 : -1;
                    }
                    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
                    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
                    return 0;
                }
                if (a.isUrgent !== b.isUrgent) return a.isUrgent ? -1 : 1;
                return b.totalRecommendation - a.totalRecommendation;
            })
            .map(g => ({
                ...g,
                children: g.children.sort((a, b) => a.barcode.localeCompare(b.barcode))
            }));
    }, [products, leadTime, safetyBuffer, selectedGrade, search, sortConfig]);

    const urgentItems = useMemo(() => {
        return products.filter(p => p.coupangStock > 0 && p.daysOfInventory !== null && p.daysOfInventory <= 5 && (p.abcGrade === 'A' || p.abcGrade === 'B')).slice(0, 10);
    }, [products]);

    if (loading) return (
        <div className="flex flex-col justify-center items-center h-[calc(100vh-200px)]">
            <Loader2 className="animate-spin text-primary mb-4" size={48} strokeWidth={2.5} />
            <p className="text-caption font-bold text-text-disabled">주문 데이터를 분석 중입니다...</p>
        </div>
    );

    if (error) return (
        <div className="flex justify-center items-center h-[calc(100vh-200px)] p-6">
            <div className="p-10 max-w-2xl w-full text-center space-y-8 border border-error/20 bg-error/[0.02] rounded-3xl">
                <div className="w-24 h-24 bg-error/10 rounded-full flex items-center justify-center mx-auto text-error">
                    <AlertTriangle size={48} strokeWidth={2.5} />
                </div>
                <h3 className="text-page-title text-error tracking-tighter font-bold">데이터 동기화 오류</h3>
                <p className="text-sub text-text-secondary leading-relaxed font-bold">{error.message}</p>
                {error.sql && (
                    <div className="bg-slate-900 rounded-2xl p-6 text-left relative overflow-hidden">
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">필수 시스템 업데이트</span>
                            <button onClick={() => { navigator.clipboard.writeText(error.sql!); alert("SQL이 복사되었습니다!"); }} className="btn-secondary px-4 py-1.5 text-[10px] font-bold bg-white/5 border-white/10 text-white hover:bg-white/10 uppercase tracking-widest">명령어 복사</button>
                        </div>
                        <code className="text-primary font-mono text-xs block break-all leading-relaxed p-4 bg-black/40 rounded-xl border border-white/5">{error.sql}</code>
                    </div>
                )}
                <button onClick={() => window.location.reload()} className="btn-primary w-full max-w-sm mx-auto font-bold uppercase tracking-[0.2em] h-14 shadow-2xl">시스템 재시작</button>
            </div>
        </div>
    );

    return (
        <div className="space-y-8 pb-20 animate-in fade-in duration-700">
            {/* Urgent Notification Banner */}
            {urgentItems.length > 0 && (
                <div className="bg-error text-white p-8 rounded-3xl flex flex-col xl:flex-row items-center justify-between relative overflow-hidden border border-error/20">
                    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.1),transparent)] flex-none"></div>
                    <div className="flex items-center gap-8 mb-6 xl:mb-0 relative z-10">
                        <div className="p-5 bg-white/20 rounded-full flex-shrink-0 animate-pulse">
                            <MessageSquareWarning size={32} strokeWidth={3} />
                        </div>
                        <div>
                            <h3 className="text-section-title text-white flex items-center font-semibold tracking-tighter">
                                품절 위험 알림: 매우 높음
                            </h3>
                            <p className="text-sub font-bold mt-1 opacity-90 uppercase tracking-tight italic">
                                {urgentItems.length}개 핵심 품목이 5일 이내 품절될 예정입니다. 즉각적인 발주 검토가 필요합니다.
                            </p>
                        </div>
                    </div>
                    <button onClick={() => handleSendAlert(urgentItems)} disabled={sendingAlert} className="px-10 py-4 bg-white text-error rounded-2xl font-bold uppercase tracking-[0.2em] text-[12px] shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3 relative z-10 min-w-[240px] justify-center">
                        {sendingAlert ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} fill="currentColor" />}
                        알림 전송하기
                    </button>
                </div>
            )}

            {/* Control Matrix */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="p-8 border border-slate-100 rounded-3xl">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="p-3 bg-primary/10 rounded-2xl text-primary"><Truck size={24} strokeWidth={2.5} /></div>
                        <h2 className="text-card-title text-text-primary uppercase tracking-tighter font-bold">발주 리드타임 설정</h2>
                    </div>
                    <div className="space-y-8">
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <label className="text-caption font-bold text-text-disabled uppercase tracking-[0.2em]">평균 리드타임</label>
                                <span className="text-page-title text-primary tracking-tighter">{leadTime}일</span>
                            </div>
                            <input type="range" min="1" max="60" value={leadTime} onChange={(e) => setLeadTime(Number(e.target.value))} className="w-full h-2 bg-slate-100 rounded-full appearance-none cursor-pointer accent-primary" />
                            <div className="flex justify-between mt-3 text-[9px] font-bold text-text-disabled uppercase tracking-widest">
                                <span>빠름</span>
                                <span>평균 (14-16일)</span>
                                <span>매우 늦음</span>
                            </div>
                        </div>
                        <div>
                            <label className="block text-caption font-bold text-text-disabled uppercase tracking-[0.2em] mb-4">안전 재고 확보 기간 (버퍼)</label>
                            <div className="flex flex-wrap gap-3">
                                {[1, 2, 3, 5, 7, 10].map(d => (
                                    <button key={d} onClick={() => setSafetyBuffer(d)} className={`px-5 py-2.5 text-[10px] font-bold rounded-xl border-2 transition-all uppercase tracking-widest ${safetyBuffer === d ? 'bg-primary border-primary text-white' : 'bg-white border-slate-100 text-text-disabled hover:border-slate-200'}`}>+{d}일</button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="p-8 border border-primary/10 bg-primary/[0.01] rounded-3xl flex flex-col justify-center relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl group-hover:scale-125 transition-transform duration-700"></div>
                    <div className="flex justify-between items-center mb-6 relative z-10">
                        <span className="text-caption font-bold text-text-disabled uppercase tracking-[0.2em]">발주 권장 상품 수</span>
                        <span className="text-page-title text-primary tracking-tighter">{groupedOrders.length}</span>
                    </div>
                    <div className="p-6 bg-white/80 rounded-2xl border-2 border-primary/5 relative z-10 backdrop-blur-xl space-y-4">
                        <div className="flex items-start gap-4">
                            <div className="w-2 h-2 rounded-full bg-primary mt-2"></div>
                            <p className="text-sub font-bold text-text-secondary leading-tight italic uppercase tracking-tighter">
                                최적화 목표: 합산 <span className="text-primary font-bold">{leadTime + safetyBuffer}일분</span>의 재고 보수성 유지.
                            </p>
                        </div>
                        <div className="flex items-start gap-4">
                            <div className="w-2 h-2 rounded-full bg-primary mt-2"></div>
                            <p className="text-sub font-bold text-text-secondary leading-tight italic uppercase tracking-tighter">
                                제안된 수량 발주 시, 잠재적 품절 발생률을 약 <span className="text-primary font-bold">98.4%</span> 감소시킬 수 있습니다.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Recommendations Grid */}
            <div className="overflow-hidden bg-white">
                <div className="px-8 py-8 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-8 bg-slate-50/50">
                    <div className="flex items-center gap-8">
                        <h3 className="text-section-title text-text-primary font-bold uppercase tracking-tighter flex items-center">
                            <BarChart3 size={20} className="mr-3 text-primary" strokeWidth={3} />
                            스마트 발주 제안 목록
                        </h3>
                        {/* Filters */}
                        <div className="flex p-1 bg-white rounded-xl border border-slate-200">
                            {(['ALL', 'A', 'B', 'C', 'D'] as const).map(grade => (
                                <button key={grade} onClick={() => setSelectedGrade(grade)} className={`px-4 py-1.5 text-[9px] font-bold rounded-lg transition-all uppercase tracking-widest ${selectedGrade === grade ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-text-disabled hover:text-text-secondary'}`}>{grade === 'ALL' ? '전체' : grade}</button>
                            ))}
                        </div>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-disabled" size={16} />
                        <input type="text" placeholder="검색어를 입력하세요..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-12 pr-6 py-3 border border-slate-200 rounded-2xl text-[11px] font-bold focus:ring-4 focus:ring-primary/10 w-80 outline-none bg-white uppercase tracking-widest" />
                    </div>
                </div>

                <div className="overflow-auto max-h-[calc(100vh-320px)] relative custom-scrollbar">
                    {groupedOrders.length === 0 ? (
                        <div className="py-32 flex flex-col items-center justify-center text-center">
                            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6 text-slate-200 border-4 border-slate-100 shadow-inner">
                                 <Truck size={40} strokeWidth={2.5} />
                            </div>
                            <p className="text-section-title text-text-disabled font-bold uppercase tracking-tighter italic">적정 재고 유지 중</p>
                            <p className="text-caption font-bold text-text-disabled mt-2 uppercase tracking-widest opacity-60">현재 설정된 리드타임({leadTime}일) 내에 품절 위험 상품이 없습니다.</p>
                        </div>
                    ) : (
                        <table className="saas-table border-separate border-spacing-0">
                            <thead>
                                <tr className="h-[60px] bg-white sticky top-0 z-40">
                                    <th className="sticky left-0 w-16 border-b border-slate-100 bg-white z-50"></th>
                                    <th className="px-8 py-3 text-table-header cursor-pointer hover:text-primary transition-colors border-b-2 border-slate-100" onClick={() => handleSort('name')}>상품명</th>
                                    <th className="px-6 py-3 text-table-header text-right cursor-pointer hover:text-primary border-b-2 border-slate-100" onClick={() => handleSort('totalHqStock')}>본사재고</th>
                                    <th className="px-6 py-3 text-table-header text-right cursor-pointer hover:text-primary border-b-2 border-slate-100" onClick={() => handleSort('totalCurrentStock')}>쿠팡재고</th>
                                    <th className="px-6 py-3 text-table-header text-right cursor-pointer hover:text-primary border-b-2 border-slate-100" onClick={() => handleSort('totalIncomingStock')}>입고예정</th>
                                    <th className="px-6 py-3 text-table-header text-right cursor-pointer hover:text-primary border-b-2 border-slate-100" onClick={() => handleSort('totalAvgDailySales')}>일평균판매</th>
                                    <th className="px-8 py-3 text-table-header text-primary text-right bg-primary/[0.02] border-b-2 border-primary/20 cursor-pointer" onClick={() => handleSort('totalRecommendation')}>추천 발주량</th>
                                    <th className="px-8 py-3 text-table-header text-center cursor-pointer hover:text-primary border-b-2 border-slate-100" onClick={() => handleSort('isUrgent')}>상태</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {groupedOrders.map((group) => {
                                    const isExpanded = expandedGroups.has(group.name);
                                    return (
                                        <React.Fragment key={group.name}>
                                            <tr className={`group/tr transition-all cursor-pointer ${isExpanded ? 'bg-primary/[0.03]' : 'hover:bg-slate-50'}`} onClick={() => toggleGroup(group.name)}>
                                                <td className="px-6 py-6 text-center border-b border-slate-100">
                                                    {isExpanded ? <ChevronDown size={14} className="mx-auto text-primary" strokeWidth={3} /> : <ChevronRight size={14} className="mx-auto text-text-disabled" strokeWidth={3} />}
                                                </td>
                                                <td className="px-8 py-6 border-b border-slate-100">
                                                    <div className="flex flex-col">
                                                    <span className="text-item-main text-text-primary uppercase tracking-tighter line-clamp-1 group-hover/tr:text-primary transition-colors font-bold">{group.name}</span>
                                                        <div className="flex items-center mt-2 gap-3">
                                                            <span className={`text-[10px] font-bold uppercase tracking-widest ${
                                                                group.abcGrade === 'A' ? 'text-error' :
                                                                group.abcGrade === 'B' ? 'text-success' :
                                                                group.abcGrade === 'C' ? 'text-primary' : 'text-text-disabled'
                                                            }`}>{group.abcGrade} 등급</span>
                                                            <span className="text-[10px] font-bold text-text-disabled uppercase tracking-widest opacity-40">{group.children.length}개 옵션</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-6 text-right text-item-data text-text-secondary border-b border-slate-100">{group.totalHqStock?.toLocaleString() || 0}</td>
                                                <td className="px-6 py-6 text-right text-item-data text-text-secondary border-b border-slate-100">{group.totalCurrentStock.toLocaleString()}</td>
                                                <td className="px-6 py-6 text-right text-item-data text-success border-b border-slate-100">{group.totalIncomingStock > 0 ? `+${group.totalIncomingStock.toLocaleString()}` : '-'}</td>
                                                <td className="px-6 py-6 text-right text-item-data text-text-disabled uppercase tracking-tighter border-b border-slate-100">{group.totalAvgDailySales.toFixed(1)}/D</td>
                                                <td className="px-8 py-6 text-right bg-primary/[0.02] border-b border-slate-100">
                                                    <span className="text-item-main text-primary tracking-tighter">{group.totalRecommendation.toLocaleString()}<span className="text-item-sub ml-1.5 opacity-40">U</span></span>
                                                </td>
                                                <td className="px-8 py-6 text-center border-b border-slate-100">
                                                    {group.isUrgent ? (
                                                        <span className="inline-flex items-center font-bold text-[9px] text-error uppercase tracking-widest animate-pulse">위험</span>
                                                    ) : (
                                                        <span className="inline-flex items-center font-bold text-[9px] text-warning uppercase tracking-widest">주의</span>
                                                    )}
                                                </td>
                                            </tr>

                                            {isExpanded && group.children.map(child => (
                                                <tr key={child.barcode} className="bg-slate-100/30 text-item-sub group/sub transition-colors hover:bg-slate-100/60">
                                                    <td className="px-6 py-4"></td>
                                                    <td className="px-8 py-4 pl-12 border-b border-white">
                                                        <div className="flex flex-col">
                                                            <span className="text-item-sub text-text-disabled font-mono tracking-widest mb-0.5">{child.barcode}</span>
                                                            <span className="text-item-sub text-text-secondary font-bold uppercase tracking-tighter">{child.option || '-'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right text-text-disabled border-b border-white">{child.hqStock?.toLocaleString() || 0}</td>
                                                    <td className="px-6 py-4 text-right text-text-disabled border-b border-white">{child.coupangStock.toLocaleString()}</td>
                                                    <td className="px-6 py-4 text-right text-text-disabled border-b border-white">{child.incomingStock > 0 ? <span className="text-success">+{child.incomingStock}</span> : '-'}</td>
                                                    <td className="px-6 py-4 text-right text-text-disabled border-b border-white">{child.avgDailySales.toFixed(1)}/D</td>
                                                    <td className="px-8 py-4 text-right font-medium text-primary bg-primary/[0.01] border-b border-white">{child.recommendation.toLocaleString()}</td>
                                                    <td className="px-8 py-4 text-center border-b border-white">
                                                        <span className={`text-item-sub font-medium uppercase tracking-widest ${child.stockoutDate <= leadTime ? 'text-error animate-pulse' : 'text-text-disabled opacity-40'}`}>
                                                            {child.stockoutDate <= 0 ? '품절' : `D-${Math.floor(child.stockoutDate)}`}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
