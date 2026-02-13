import { AlertCircle } from 'lucide-react';

interface RiskItem {
    name: string;
    imageUrl?: string;
    currentStock: number;
    avgDailySales: number;
    daysLeft: number;
}

interface StockRiskAlertProps {
    riskItems: RiskItem[];
}

export default function StockRiskAlert({ riskItems }: StockRiskAlertProps) {
    if (!riskItems || riskItems.length === 0) return null;

    return (
        <div className="bg-red-50 border border-red-100 rounded-xl p-6 relative overflow-hidden mb-6">
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <AlertCircle size={100} className="text-red-500" />
            </div>
            <div className="relative z-10">
                <h3 className="font-bold text-red-800 flex items-center mb-4 text-lg">
                    <AlertCircle className="mr-2 text-red-600 animate-pulse" />
                    품절 임박 경보 (3일 내 소진 예상)
                    <span className="ml-2 bg-red-200 text-red-800 text-xs px-2 py-1 rounded-full">{riskItems.length}건</span>
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-red-700 bg-red-100/50 uppercase">
                            <tr>
                                <th className="px-4 py-2 rounded-l-lg">상품명</th>
                                <th className="px-4 py-2 text-right">현재 재고</th>
                                <th className="px-4 py-2 text-right">일평균 판매 (7일)</th>
                                <th className="px-4 py-2 text-right rounded-r-lg">소진 예상</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-red-100">
                            {riskItems.slice(0, 10).map((item) => (
                                <tr key={item.name} className="hover:bg-red-100/30 transition-colors">
                                    <td className="px-4 py-3 font-medium text-gray-900 flex items-center">
                                        {item.imageUrl && (
                                            <img
                                                src={item.imageUrl}
                                                alt=""
                                                className="w-8 h-8 rounded object-cover mr-3 bg-white"
                                            />
                                        )}
                                        {item.name}
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-red-600">
                                        {item.currentStock.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-right text-gray-600">
                                        {item.avgDailySales.toFixed(1)}개
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-red-700">
                                        {item.daysLeft.toFixed(1)}일 후
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {riskItems.length > 10 && (
                        <p className="text-center text-xs text-red-500 mt-4 font-medium">
                            관리자 페이지 등에서 전체 목록을 확인하시기 바랍니다.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
