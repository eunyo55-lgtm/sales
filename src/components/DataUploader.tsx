import React, { useState } from 'react';
import { Upload, FileUp, CheckCircle, AlertCircle, Loader2, Trash2 } from 'lucide-react';
import { parseProductMaster, parseCoupangSales } from '../lib/parsers';
import { api } from '../lib/api';

export function DataUploader() {
    const [isUploading, setIsUploading] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });
    const [progress, setProgress] = useState(0);

    const handleReset = async () => {
        if (!confirm("⚠️ 초기화 경고: 모든 판매/재고 데이터가 삭제됩니다.")) return;
        setIsUploading(true);
        try {
            await api.resetData();
            alert("초기화 완료");
            window.location.reload();
        } catch (e: any) {
            alert("삭제 실패: " + e.message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'master' | 'sales') => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setStatus({ type: null, message: '' });
        setProgress(0);

        try {
            if (type === 'master') {
                const data = await parseProductMaster(file);
                setStatus({ type: 'success', message: `${data.length}개 상품 데이터 파싱 완료. 서버 업로드 중...` });
                await api.uploadProducts(data, (p) => setProgress(p));
                setStatus({ type: 'success', message: `✅ 상품 마스터 ${data.length}건 업로드 완료!` });
            } else {
                const data = await parseCoupangSales(file);
                setStatus({ type: 'success', message: `${data.length}개 판매 데이터 파싱 완료. 서버 업로드 중...` });
                await api.uploadSales(data, (p) => setProgress(p));
                setStatus({ type: 'success', message: `✅ 판매 데이터 ${data.length}건 업로드 완료!` });
            }
        } catch (error: any) {
            console.error(error);
            setStatus({ type: 'error', message: `오류 발생: ${error.message || '파일 처리 실패'}` });
        } finally {
            setIsUploading(false);
            // Reset input value to allow re-uploading same file if needed
            e.target.value = '';
        }
    };

    return (
        <div className="flex items-center space-x-3">
            <button
                onClick={handleReset}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                title="데이터 초기화"
            >
                <Trash2 size={20} />
            </button>
            {isUploading && (
                <div className="flex flex-col space-y-1">
                    <div className="flex items-center text-blue-600 text-sm font-medium">
                        <Loader2 className="animate-spin mr-2" size={16} />
                        처리 중... {progress}%
                    </div>
                    <div className="w-40 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-500 transition-all duration-300 ease-out"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            )}

            {!isUploading && status.message && (
                <div className={`text-sm flex items-center ${status.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                    {status.type === 'success' ? <CheckCircle size={16} className="mr-1" /> : <AlertCircle size={16} className="mr-1" />}
                    {status.message}
                </div>
            )}

            <div className="relative">
                <input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={(e) => handleFileUpload(e, 'master')}
                    className="hidden"
                    id="upload-master"
                    disabled={isUploading}
                />
                <label
                    htmlFor="upload-master"
                    className={`flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium transition-colors cursor-pointer ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    <FileUp size={16} className="text-blue-500" />
                    <span>상품 마스터 등록</span>
                </label>
            </div>

            <div className="relative">
                <input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={(e) => handleFileUpload(e, 'sales')}
                    className="hidden"
                    id="upload-sales"
                    disabled={isUploading}
                />
                <label
                    htmlFor="upload-sales"
                    className={`flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    <Upload size={16} />
                    <span>쿠팡 판매데이터 등록</span>
                </label>
            </div>
        </div>
    );
}
