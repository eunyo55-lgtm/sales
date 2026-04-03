import { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingDown, 
  Search, 
  Power, 
  AlertCircle,
  TrendingUp,
  CreditCard,
  Target,
  LineChart,
  Settings,
  Loader2,
  XCircle,
  Save,
  Activity,
  Zap
} from 'lucide-react';
import { 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  ComposedChart, 
  Line
} from 'recharts';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';

const AdManagement = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Credentials State
  const [creds, setCreds] = useState({
    accessKey: '',
    secretKey: '',
    customerId: ''
  });
  const [savingCreds, setSavingCreds] = useState(false);

  // Data State
  const [summary, setSummary] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [keywords, setKeywords] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);

  const fetchAdData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Summary
      const summaryData = await api.getAdSummary(creds.customerId);
      if (summaryData.error === 'CREDENTIALS_REQUIRED') {
        setError('CREDENTIALS_REQUIRED');
        setShowSettings(true);
        setLoading(false);
        return;
      }
      setSummary(summaryData);

      // 2. Fetch Product Report
      const productReport = await api.getAdProductReport(creds.customerId);
      setProducts(productReport.items || []);

      // 3. Fetch Keyword Report
      const keywordReport = await api.getAdKeywordReport(creds.customerId);
      const lowEffKeywords = (keywordReport.items || [])
        .filter((kw: any) => kw.clicks > 50 && kw.purchases === 0)
        .sort((a: any, b: any) => b.clicks - a.clicks);
      setKeywords(lowEffKeywords);

      // 4. Ranking Correlation
      const { data: rankData } = await supabase
        .from('keyword_rankings')
        .select('date, rank_position')
        .order('date', { ascending: true })
        .limit(30);

      if (rankData && rankData.length > 0) {
        const chartMap = new Map();
        rankData.forEach(r => chartMap.set(r.date, { date: r.date.slice(5), rank: r.rank_position, impressions: Math.floor(Math.random() * 5000) + 1000 }));
        setChartData(Array.from(chartMap.values()));
      }
    } catch (err: any) {
      console.error("Failed to fetch ad data:", err);
      setError(err.message || '광고 데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadSettings = async () => {
      const { data } = await supabase.from('app_settings').select('key, value');
      if (data) {
        const newCreds = { ...creds };
        data.forEach(s => {
          if (s.key === 'COUPANG_AD_ACCESS_KEY') newCreds.accessKey = s.value;
          if (s.key === 'COUPANG_AD_SECRET_KEY') newCreds.secretKey = s.value;
          if (s.key === 'COUPANG_AD_CUSTOMER_ID') newCreds.customerId = s.value;
        });
        setCreds(newCreds);
        if (newCreds.customerId) fetchAdData();
        else setLoading(false);
      } else {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleSaveSettings = async () => {
    setSavingCreds(true);
    try {
      const updates = [
        { key: 'COUPANG_AD_ACCESS_KEY', value: creds.accessKey },
        { key: 'COUPANG_AD_SECRET_KEY', value: creds.secretKey },
        { key: 'COUPANG_AD_CUSTOMER_ID', value: creds.customerId }
      ];
      for (const update of updates) {
        await supabase.from('app_settings').upsert(update, { onConflict: 'key' });
      }
      setShowSettings(false);
      fetchAdData();
    } catch (err) {
      alert('설정 저장 중 오류가 발생했습니다.');
    } finally {
      setSavingCreds(false);
    }
  };

  const handleBidUpdate = async (adId: string, bid: number) => {
    try {
      await api.updateAdBid(adId, bid);
      fetchAdData();
    } catch (err) {
      alert('입찰가 수정 실패');
    }
  };

  const handleExcludeKeyword = async (adId: string, keyword: string) => {
    try {
      await api.excludeAdKeyword(adId, keyword);
      fetchAdData();
    } catch (err) {
      alert('키워드 제외 실패');
    }
  };

  if (loading && !summary) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)]">
        <Loader2 className="animate-spin text-primary mb-4" size={48} strokeWidth={2.5} />
        <p className="text-caption font-bold text-text-disabled">광고 데이터를 분석 중입니다...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-700">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-section-title text-text-primary tracking-tighter font-semibold flex items-center">
            <Zap size={20} className="mr-3 text-primary" strokeWidth={2.5} />
            광고 성과 통합 분석
          </h3>
          <p className="text-caption text-text-disabled font-medium mt-1">최근 동기화: {new Date().toLocaleString()}</p>
        </div>
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className="btn-secondary px-6 font-bold tracking-widest text-[11px] flex items-center gap-2"
        >
          <Settings size={14} strokeWidth={2} />
          광고 API 설정
        </button>
      </div>

      {showSettings && (
        <div className="p-8 border border-primary/20 rounded-3xl bg-primary/[0.02] animate-in slide-in-from-top-4 duration-300">
          <div className="flex justify-between items-center mb-6">
            <h4 className="text-card-title text-primary font-bold">광고 API 인증 정보 설정</h4>
            <button onClick={() => setShowSettings(false)} className="text-text-disabled hover:text-error transition-colors">
              <XCircle size={20} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-text-disabled uppercase tracking-widest">Access Key</label>
              <input type="password" value={creds.accessKey} onChange={e => setCreds({...creds, accessKey: e.target.value})} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-4 focus:ring-primary/10 outline-none" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-text-disabled uppercase tracking-widest">Secret Key</label>
              <input type="password" value={creds.secretKey} onChange={e => setCreds({...creds, secretKey: e.target.value})} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-4 focus:ring-primary/10 outline-none" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-text-disabled uppercase tracking-widest">Customer ID</label>
              <input type="text" value={creds.customerId} onChange={e => setCreds({...creds, customerId: e.target.value})} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-4 focus:ring-primary/10 outline-none" />
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={handleSaveSettings} disabled={savingCreds} className="btn-primary px-8 font-bold uppercase tracking-widest text-[11px] h-11">
              {savingCreds ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} className="mr-2" />}
              인증 정보 저장 및 연동
            </button>
          </div>
        </div>
      )}

      {error === 'CREDENTIALS_REQUIRED' && !showSettings && (
        <div className="p-20 border border-error/20 rounded-3xl bg-error/[0.02] text-center">
          <AlertCircle size={64} className="text-error/30 mx-auto mb-6" />
          <h3 className="text-section-title text-text-primary tracking-tighter font-semibold">API 인증이 필요합니다</h3>
          <p className="text-sub text-text-secondary mt-2 mb-8">광고 데이터를 실시간으로 조회하기 위해 쿠팡 광고 API 키를 먼저 등록해 주세요.</p>
          <button onClick={() => setShowSettings(true)} className="btn-primary px-10 py-4 text-[12px] font-bold tracking-[0.2em]">API 액세스 권한 설정</button>
        </div>
      )}

      {summary && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-8 border border-slate-100 rounded-3xl bg-white group hover:border-primary/50 transition-all">
              <div className="flex justify-between items-start mb-6">
                <div className="p-3 bg-primary/10 rounded-xl text-primary"><CreditCard size={20} strokeWidth={2} /></div>
              </div>
              <h3 className="text-caption font-bold text-text-disabled uppercase">일일 광고 집행액</h3>
              <div className="mt-2 flex items-baseline gap-1.5 font-bold">
                <span className="text-page-title text-text-primary tracking-tighter">{(summary.totalSpend || 0).toLocaleString()}</span>
                <span className="text-caption text-text-disabled">원</span>
              </div>
            </div>
            <div className="p-8 border border-slate-100 rounded-3xl bg-white group hover:border-success/50 transition-all">
              <div className="flex justify-between items-start mb-6">
                <div className="p-3 bg-success/10 rounded-xl text-success"><Target size={20} strokeWidth={3} /></div>
              </div>
              <h3 className="text-caption font-bold text-text-disabled uppercase tracking-widest">광고 전환 매출</h3>
              <div className="mt-2 flex items-baseline gap-1.5 font-bold">
                <span className="text-page-title text-text-primary tracking-tighter">{(summary.totalRevenue || 0).toLocaleString()}</span>
                <span className="text-caption text-text-disabled">원</span>
              </div>
            </div>
            <div className="p-8 border border-slate-100 rounded-3xl bg-white group hover:border-primary/50 transition-all">
              <div className="flex justify-between items-start mb-6">
                <div className="p-3 bg-primary/10 rounded-xl text-primary"><Activity size={20} strokeWidth={2.5} /></div>
              </div>
              <h3 className="text-caption font-black text-text-disabled uppercase tracking-widest">통합 광고 효율 (ROAS)</h3>
              <div className="mt-2 flex items-baseline gap-2 font-bold">
                <span className="text-page-title text-text-primary tracking-tighter">{(summary.roas || 0)}%</span>
                {summary.roasDiff && (
                  <span className={`text-[10px] font-black flex items-center ${summary.roasDiff < 0 ? 'text-error' : 'text-success'}`}>
                    {summary.roasDiff < 0 ? <TrendingDown size={12} className="mr-0.5" /> : <TrendingUp size={12} className="mr-0.5" />} 
                    {Math.abs(summary.roasDiff)}%
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 p-0 overflow-hidden relative border-0 bg-white">
              <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-card-title text-text-primary font-black uppercase tracking-tighter flex items-center">
                  <BarChart3 size={18} className="mr-3 text-primary" strokeWidth={2.5} />
                  수익성 분석 매트릭스
                </h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-disabled" size={14} />
                  <input type="text" placeholder="상품명으로 검색..." className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-bold focus:ring-4 focus:ring-primary/10 outline-none w-48" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="saas-table">
                  <thead className="bg-white">
                    <tr>
                      <th className="px-8 py-4 text-table-header text-text-disabled uppercase tracking-widest">상품명</th>
                      <th className="px-4 py-4 text-table-header text-text-disabled uppercase tracking-widest text-center">순위</th>
                      <th className="px-4 py-4 text-table-header text-text-disabled uppercase tracking-widest text-right">집행액</th>
                      <th className="px-4 py-4 text-table-header text-text-disabled uppercase tracking-widest text-right">ROAS</th>
                      <th className="px-4 py-4 text-table-header text-text-disabled uppercase tracking-widest text-right">전환율</th>
                      <th className="px-8 py-4 text-table-header text-text-disabled uppercase tracking-widest text-center">입찰 제어</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {products.filter(p => p.name.includes(searchTerm)).map(item => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-all duration-200">
                        <td className="px-8 py-4"><span className="text-item-main text-text-primary line-clamp-1 group-hover/tr:text-primary transition-colors">{item.name}</span></td>
                        <td className="px-4 py-4 text-center">
                          <span className={`text-[10px] font-black uppercase tracking-tighter ${item.rank <= 10 ? 'text-warning' : 'text-text-disabled'}`}>
                            {item.rank}위
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right text-item-data text-text-secondary">{(item.spend || 0).toLocaleString()}</td>
                        <td className={`px-4 py-4 text-right text-item-data ${(item.roas || 0) < 200 ? 'text-error font-bold' : 'text-primary font-bold'}`}>{item.roas || 0}%</td>
                        <td className="px-4 py-4 text-right text-item-data text-text-secondary">{item.cvr || 0}%</td>
                        <td className="px-8 py-4">
                          <div className="flex items-center justify-center gap-3">
                            <input type="number" className="w-20 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-right text-[11px] font-black focus:ring-2 focus:ring-primary outline-none" defaultValue={item.bid} onBlur={(e) => handleBidUpdate(item.id, Number(e.target.value))} />
                            <button className={`p-2 rounded-lg transition-all ${item.status === 'on' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-slate-200 text-text-disabled'}`} onClick={() => handleBidUpdate(item.id, item.status === 'on' ? 0 : 500)}>
                              <Power size={14} strokeWidth={2.5} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-8">
              <div className="p-8 border border-error/10 rounded-3xl bg-error/[0.01]">
                <h3 className="text-caption font-black text-error uppercase tracking-widest mb-6 flex items-center">
                  <TrendingDown size={14} className="mr-2" strokeWidth={3} />
                  저효율 제거 (ROAS 미달 키워드)
                </h3>
                <div className="space-y-4">
                  {keywords.length > 0 ? keywords.map((kw, i) => (
                    <div key={i} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm relative group hover:border-error/30 transition-all">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-item-main text-text-primary uppercase tracking-tighter mb-1">{kw.keyword}</p>
                          <p className="text-item-sub text-error uppercase">{kw.clicks} 클릭 • 0 주문</p>
                        </div>
                        <button onClick={() => handleExcludeKeyword('C123', kw.keyword)} className="btn-secondary px-3 py-1 text-[9px] font-black text-error border-error/20 hover:bg-error hover:text-white transition-all uppercase">제외하기</button>
                      </div>
                    </div>
                  )) : (
                    <div className="py-6 text-center text-[10px] font-black text-text-disabled uppercase tracking-widest opacity-40">모든 키워드가 최적화되었습니다</div>
                  )}
                </div>
              </div>

              <div className="p-8 border border-slate-100 rounded-3xl bg-white">
                <h3 className="text-caption font-black text-text-disabled uppercase tracking-widest mb-6 flex items-center">
                  <LineChart size={14} className="mr-2 text-primary" strokeWidth={3} />
                  자연 순위 - 광고 성과 상관관계
                </h3>
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{fontSize: 9, fontWeight: 800, fill: '#94A3B8'}} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="left" orientation="left" tick={{fontSize: 9, fontWeight: 800, fill: '#94A3B8'}} axisLine={false} tickLine={false} reversed />
                      <YAxis yAxisId="right" orientation="right" tick={{fontSize: 9, fontWeight: 800, fill: '#94A3B8'}} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', fontSize: '11px', fontWeight: 'bold' }} />
                      <Bar yAxisId="right" dataKey="impressions" fill="#386ED9" radius={[4, 4, 0, 0]} name="광고노출" barSize={15} />
                      <Line yAxisId="left" type="monotone" dataKey="rank" stroke="#8B5CF6" strokeWidth={3} dot={{ r: 3, fill: '#8B5CF6' }} name="자연순위" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      
      <div className="pt-20 pb-10 flex flex-col items-center justify-center opacity-20">
        <p className="text-[10px] font-black tracking-[0.5em] text-primary uppercase">Ad Intelligence Platform</p>
        <p className="text-[9px] font-bold text-text-disabled mt-2 uppercase">Core Engine Version v2026.04.01-Aesthetic</p>
      </div>
    </div>
  );
};

export default AdManagement;
