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
  Save
} from 'lucide-react';
import { 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  ComposedChart, 
  Line,
  Legend
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
      console.log("Summary Data:", summaryData);
      setSummary(summaryData);

      // 2. Fetch Product Report
      const productReport = await api.getAdProductReport(creds.customerId);
      console.log("Product Report:", productReport);
      setProducts(productReport.items || []);

      // 3. Fetch Keyword Report
      const keywordReport = await api.getAdKeywordReport(creds.customerId);
      const lowEffKeywords = (keywordReport.items || [])
        .filter((kw: any) => kw.clicks > 50 && kw.purchases === 0)
        .sort((a: any, b: any) => b.clicks - a.clicks);
      setKeywords(lowEffKeywords);

      // 4. Ranking Correlation (Merge with local DB)
      // Logic: Fetch natural ranking from local DB and match with impressions from ad report
      const { data: rankData } = await supabase
        .from('keyword_rankings')
        .select('date, rank_position')
        .order('date', { ascending: true })
        .limit(30);

      if (rankData && rankData.length > 0) {
        // Merge with keywordReport impressions if available
        const chartMap = new Map();
        rankData.forEach(r => chartMap.set(r.date, { date: r.date.slice(5), rank: r.rank_position, impressions: 0 }));
        
        // Mocking impression distribution if real daily ad report is not yet implemented
        // In a real scenario, we would fetch /v1/report/daily and merge here
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
    fetchAdData();
    // Fetch current settings from DB
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
      
      alert('설정이 저장되었습니다. 데이터를 다시 불러옵니다.');
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
      alert('입찰가가 수정되었습니다.');
      fetchAdData();
    } catch (err) {
      alert('입찰가 수정 실패');
    }
  };

  const handleExcludeKeyword = async (campaignId: string, keyword: string) => {
    if (!confirm(`'${keyword}' 키워드를 제외하시겠습니까?`)) return;
    try {
      await api.excludeAdKeyword(campaignId, keyword);
      alert('키워드가 제외되었습니다.');
      fetchAdData();
    } catch (err) {
      alert('키워드 제외 실패');
    }
  };

  if (loading && !summary) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-blue-500 mb-4" size={40} />
        <p className="text-gray-500 animate-pulse">쿠팡 광고 데이터를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header with Settings toggle */}
      <div className="flex justify-between items-center mb-2">
        <div>
          <p className="text-sm text-gray-400">마지막 업데이트: {new Date().toLocaleString()}</p>
        </div>
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
        >
          <Settings size={16} />
          <span>API 설정</span>
        </button>
      </div>

      {/* Settings Panel Overlay */}
      {showSettings && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 mb-6 animate-in slide-in-from-top duration-300">
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-bold text-blue-900 flex items-center">
              <Settings size={18} className="mr-2" />
              쿠팡 광고 API 설정
            </h3>
            <button onClick={() => setShowSettings(false)} className="text-blue-400 hover:text-blue-600">
              <XCircle size={20} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold text-blue-700 mb-1">Access Key</label>
              <input 
                type="password" 
                value={creds.accessKey}
                onChange={e => setCreds({...creds, accessKey: e.target.value})}
                className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="CEA..."
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-blue-700 mb-1">Secret Key</label>
              <input 
                type="password" 
                value={creds.secretKey}
                onChange={e => setCreds({...creds, secretKey: e.target.value})}
                className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-blue-700 mb-1">Customer ID</label>
              <input 
                type="text" 
                value={creds.customerId}
                onChange={e => setCreds({...creds, customerId: e.target.value})}
                className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="A12345..."
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button 
              onClick={handleSaveSettings}
              disabled={savingCreds}
              className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-all shadow-md"
            >
              {savingCreds ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              <span>설정 저장 및 데이터 갱신</span>
            </button>
          </div>
          <p className="mt-4 text-xs text-blue-400 italic">
            * 입력하신 정보는 본인의 Supabase DB에만 안전하게 저장됩니다.
          </p>
        </div>
      )}

      {error === 'CREDENTIALS_REQUIRED' && !showSettings && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-10 text-center">
          <AlertCircle size={48} className="text-amber-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-amber-900 mb-2">광고 API 설정이 필요합니다</h3>
          <p className="text-amber-700 mb-6">쿠팡 광고 데이터를 불러오려면 API Key 설정이 완료되어야 합니다.</p>
          <button 
            onClick={() => setShowSettings(true)}
            className="px-8 py-3 bg-amber-600 text-white rounded-xl font-bold shadow-lg hover:bg-amber-700 transition-all"
          >
            설정하러 가기
          </button>
        </div>
      )}

      {error && error !== 'CREDENTIALS_REQUIRED' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-center space-x-4 text-red-800">
          <AlertCircle size={24} className="flex-shrink-0" />
          <div className="flex-1">
            <p className="font-bold text-sm">데이터를 불러오는 중 오류가 발생했습니다.</p>
            <p className="text-xs mt-1">{error}</p>
          </div>
          <button 
            onClick={fetchAdData}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700"
          >
            다시 시도
          </button>
        </div>
      )}

      {summary && (
        <>
          {/* 1. 요약 카드 (Summary) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden group">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                  <CreditCard size={20} />
                </div>
                <span className="text-xs font-bold text-blue-500 bg-blue-50 px-2 py-1 rounded">오늘 집행</span>
              </div>
              <h3 className="text-sm font-medium text-gray-500">총 광고 집행 금액</h3>
              <div className="mt-2 flex items-baseline space-x-2">
                <span className="text-2xl font-bold text-gray-900">{(summary.totalSpend || 0).toLocaleString()}원</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                  <Target size={20} />
                </div>
                <span className="text-xs font-bold text-emerald-500 bg-emerald-50 px-2 py-1 rounded">오늘 매출</span>
              </div>
              <h3 className="text-sm font-medium text-gray-500">총 광고 매출</h3>
              <div className="mt-2 flex items-baseline space-x-2">
                <span className="text-2xl font-bold text-gray-900">{(summary.totalRevenue || 0).toLocaleString()}원</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                  <BarChart3 size={20} />
                </div>
                {(summary.roasDiff || 0) < 0 && (
                  <span className="flex items-center text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded animate-pulse">
                    <AlertCircle size={10} className="mr-1" /> 특이점 발생
                  </span>
                )}
              </div>
              <h3 className="text-sm font-medium text-gray-500">평균 ROAS</h3>
              <div className="mt-2 flex items-baseline space-x-2">
                <span className="text-2xl font-bold text-gray-900">{(summary.roas || 0)}%</span>
                {summary.roasDiff && (
                  <span className={`text-xs font-medium flex items-center ${summary.roasDiff < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                    {summary.roasDiff < 0 ? <TrendingDown size={12} className="mr-0.5" /> : <TrendingUp size={12} className="mr-0.5" />} 
                    {Math.abs(summary.roasDiff)}% {summary.roasDiff < 0 ? '낮음' : '높음'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 2. 메인 컨텐츠 영역 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 성과 테이블 (2/3 영역) */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-50 flex justify-between items-center">
                <h3 className="font-bold text-gray-800 flex items-center">
                  <BarChart3 size={18} className="mr-2 text-blue-500" />
                  상품별 광고 성과
                </h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input 
                    type="text" 
                    placeholder="상품명 검색..." 
                    className="pl-10 pr-4 py-2 bg-gray-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-500 font-medium">
                    <tr>
                      <th className="px-6 py-4">상품명</th>
                      <th className="px-4 py-4 text-center">현재 랭킹</th>
                      <th className="px-4 py-4 text-right">광고비</th>
                      <th className="px-4 py-4 text-right">ROAS</th>
                      <th className="px-4 py-4 text-right">CVR</th>
                      <th className="px-6 py-4 text-center">입찰가/상태</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {products.filter(p => p.name.includes(searchTerm)).map(item => (
                      <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-800">{item.name}</td>
                        <td className="px-4 py-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${item.rank <= 10 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                            {item.rank}위
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right font-mono">{(item.spend || 0).toLocaleString()}원</td>
                        <td className={`px-4 py-4 text-right font-bold ${(item.roas || 0) < 200 ? 'text-red-500' : 'text-blue-600'}`}>{item.roas || 0}%</td>
                        <td className="px-4 py-4 text-right font-medium">{item.cvr || 0}%</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center space-x-3">
                            <input 
                              type="number" 
                              className="w-20 px-2 py-1 bg-gray-50 border border-gray-200 rounded text-right text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                              defaultValue={item.bid}
                              onBlur={(e) => handleBidUpdate(item.id, Number(e.target.value))}
                            />
                            <button 
                              className={`p-1.5 rounded-md transition-colors ${item.status === 'on' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}
                              onClick={() => handleBidUpdate(item.id, item.status === 'on' ? 0 : 500)} // Toggle logic placeholder
                            >
                              <Power size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 오른쪽 사이드 패널 (1/3 영역) */}
            <div className="space-y-6">
              {/* 저효율 키워드 추출 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center">
                  <TrendingDown size={18} className="mr-2 text-red-500" />
                  저효율 키워드 추출
                </h3>
                <div className="space-y-4">
                  {keywords.map((kw, i) => (
                    <div key={i} className="p-4 bg-red-50/50 rounded-xl border border-red-100 relative group">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-red-900 text-sm mb-1">{kw.keyword}</p>
                          <p className="text-xs text-red-700">클릭 {kw.clicks} / 지출 {kw.spend.toLocaleString()}원</p>
                        </div>
                        <button 
                          onClick={() => handleExcludeKeyword('C123', kw.keyword)}
                          className="p-1 px-2 bg-red-600 text-white text-[10px] rounded hover:bg-red-700 transition-colors shadow-sm font-bold"
                        >
                          제외하기
                        </button>
                      </div>
                    </div>
                  ))}
                  <p className="text-[11px] text-gray-400 text-center uppercase tracking-wider font-medium pt-2">
                    자동 추출 조건: 클릭 {'>'} 50 & 구매 0
                  </p>
                </div>
              </div>

              {/* 랭킹-광고 연동 차트 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center">
                  <LineChart size={18} className="mr-2 text-purple-500" />
                  랭킹 - 광고 노출 분석
                </h3>
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis dataKey="date" fontSize={10} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="left" orientation="left" fontSize={10} axisLine={false} tickLine={false} reversed unit="위" />
                      <YAxis yAxisId="right" orientation="right" fontSize={10} axisLine={false} tickLine={false} unit="회" />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Legend verticalAlign="top" height={36} iconType="circle" />
                      <Bar yAxisId="right" dataKey="impressions" fill="#3b82f6" radius={[4, 4, 0, 0]} name="광고 노출" barSize={20} />
                      <Line yAxisId="left" type="monotone" dataKey="rank" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} name="자연 랭킹" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdManagement;
