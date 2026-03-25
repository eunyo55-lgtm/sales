import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

interface CustomDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
}

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({ value, onChange, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(new Date(value || new Date().toISOString().split('T')[0]));
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const years = [];
  const startYear = 2024;
  const endYear = 2027;
  for (let y = startYear; y <= endYear; y++) years.push(y);

  const months = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const handlePrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const handleDateSelect = (day: number) => {
    const selected = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    const monthStr = String(selected.getMonth() + 1).padStart(2, '0');
    const dayStr = String(selected.getDate()).padStart(2, '0');
    onChange(`${selected.getFullYear()}-${monthStr}-${dayStr}`);
    setIsOpen(false);
  };

  const renderCalendar = () => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const totalDays = daysInMonth(year, month);
    const startDay = firstDayOfMonth(year, month);

    const days = [];
    // Padding for start of month
    for (let i = 0; i < startDay; i++) {
      days.push(<div key={`empty-${i}`} className="p-2"></div>);
    }
    // Actual days
    for (let d = 1; d <= totalDays; d++) {
      const isSelected = value === `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push(
        <button
          key={d}
          onClick={() => handleDateSelect(d)}
          className={`p-2 text-sm rounded-lg hover:bg-blue-50 transition-colors ${isSelected ? 'bg-blue-600 text-white hover:bg-blue-700' : 'text-gray-700'}`}
        >
          {d}
        </button>
      );
    }
    return days;
  };

  return (
    <div className="relative inline-block" ref={containerRef}>
      <div 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`flex items-center space-x-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg cursor-pointer hover:border-blue-400 transition-all shadow-sm ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span className="text-sm text-gray-700 min-w-[85px]">{value || '날짜 선택'}</span>
        <CalendarIcon size={14} className="text-gray-400" />
      </div>

      {isOpen && (
        <div className="absolute z-[100] mt-2 bg-white border border-gray-100 rounded-xl shadow-xl w-64 p-4 animate-in fade-in zoom-in duration-200 origin-top-right right-0">
          <div className="flex items-center justify-between mb-4">
            <button onClick={handlePrevMonth} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600">
              <ChevronLeft size={18} />
            </button>
            <div className="flex items-center space-x-1 font-bold text-gray-800">
              <span>{viewDate.getFullYear()}년</span>
              <span>{months[viewDate.getMonth()]}</span>
            </div>
            <button onClick={handleNextMonth} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600">
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
              <div key={d} className={`text-center text-[10px] font-bold ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-400'}`}>
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {renderCalendar()}
          </div>
          
          <div className="mt-4 pt-3 border-t border-gray-50 flex justify-between">
            <button 
              onClick={() => {
                const today = new Date().toISOString().split('T')[0];
                onChange(today);
                setIsOpen(false);
              }}
              className="text-[11px] text-blue-600 font-medium hover:underline"
            >
              오늘
            </button>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-[11px] text-gray-400 hover:text-gray-600"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
