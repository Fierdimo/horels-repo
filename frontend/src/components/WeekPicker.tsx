import React, { useState, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface WeekPickerProps {
  selectedWeek: number | null;
  onSelectWeek: (weekNumber: number) => void;
  year?: number;
  disabledWeeks?: number[];
  occupiedWeeksInfo?: Array<{ 
    week_number: number; 
    owners: Array<{ owner_name?: string; owner_email?: string }>;
    count: number;
    available: number;
    is_fully_occupied: boolean;
  }>;
  totalUnits?: number;
}

interface WeekInfo {
  weekNumber: number;
  startDate: Date;
  endDate: Date;
  monthName: string;
}

/**
 * WeekPicker - Selector visual de semanas del año
 * Muestra un calendario de las 52 semanas con fechas aproximadas
 */
export const WeekPicker: React.FC<WeekPickerProps> = ({
  selectedWeek,
  onSelectWeek,
  year = new Date().getFullYear(),
  disabledWeeks = [],
  occupiedWeeksInfo = [],
  totalUnits = 1
}) => {
  /**
   * Calcula la fecha de inicio de una semana ISO
   * Semana 1 = Primera semana con al menos 4 días en el nuevo año
   */
  const getWeekStartDate = (weekNumber: number, year: number): Date => {
    const jan4 = new Date(year, 0, 4);
    const monday = new Date(jan4);
    monday.setDate(jan4.getDate() - (jan4.getDay() || 7) + 1);
    monday.setDate(monday.getDate() + (weekNumber - 1) * 7);
    return monday;
  };

  /**
   * Calcula el número de semana actual
   */
  const getCurrentWeek = (): number => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now.getTime() - start.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);
    return Math.ceil(dayOfYear / 7);
  };

  const currentYear = new Date().getFullYear();
  const currentWeek = getCurrentWeek();

  // Inicializar el mes actual basado en la fecha actual (si es el año actual)
  const getInitialMonth = (): number => {
    if (year !== currentYear) return 0; // Si es otro año, empezar en enero
    
    // Si es el año actual, usar el mes actual directamente
    return new Date().getMonth();
  };

  const [currentMonth, setCurrentMonth] = useState(getInitialMonth());

  /**
   * Genera info de todas las 52 semanas del año
   */
  const allWeeks = useMemo(() => {
    const weeks: WeekInfo[] = [];
    for (let week = 1; week <= 52; week++) {
      const startDate = getWeekStartDate(week, year);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);

      weeks.push({
        weekNumber: week,
        startDate,
        endDate,
        monthName: startDate.toLocaleDateString('es-ES', { month: 'short' })
      });
    }
    return weeks;
  }, [year]);

  /**
   * Filtra semanas por mes actual
   */
  const weeksInMonth = useMemo(() => {
    return allWeeks.filter(week => {
      const weekMonth = week.startDate.getMonth();
      return weekMonth === currentMonth || week.endDate.getMonth() === currentMonth;
    });
  }, [allWeeks, currentMonth]);

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const formatDateRange = (week: WeekInfo) => {
    const start = week.startDate.getDate();
    const end = week.endDate.getDate();
    const startMonth = week.startDate.toLocaleDateString('es-ES', { month: 'short' });
    const endMonth = week.endDate.toLocaleDateString('es-ES', { month: 'short' });
    
    if (startMonth === endMonth) {
      return `${start}-${end} ${startMonth}`;
    }
    return `${start} ${startMonth} - ${end} ${endMonth}`;
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(prev => (prev === 0 ? 11 : prev - 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(prev => (prev === 11 ? 0 : prev + 1));
  };

  // Calcular estadísticas considerando cantidad de unidades
  const fullyOccupiedWeeks = occupiedWeeksInfo.filter(info => info.is_fully_occupied).length;
  const partiallyOccupiedWeeks = occupiedWeeksInfo.filter(info => !info.is_fully_occupied).length;
  const totalAvailableSlots = 52 * totalUnits;
  const usedSlots = occupiedWeeksInfo.reduce((sum, info) => sum + info.count, 0);
  const occupancyPercentage = Math.round((usedSlots / totalAvailableSlots) * 100);

  return (
    <div className="bg-white border border-gray-300 rounded-lg p-4">
      {/* Header con navegación de meses */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={goToPreviousMonth}
          className="p-1 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ChevronLeft className="h-5 w-5 text-gray-600" />
        </button>
        
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              {monthNames[currentMonth]} {year}
            </h3>
          </div>
          {occupiedWeeksInfo.length > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-500">
                {fullyOccupiedWeeks} llenas • {partiallyOccupiedWeeks} parciales
              </span>
              <span className="text-xs text-gray-300">•</span>
              <span className="text-xs text-gray-400">
                {occupancyPercentage}% ocupado
              </span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={goToNextMonth}
          className="p-1 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ChevronRight className="h-5 w-5 text-gray-600" />
        </button>
      </div>

      <div className="border-t mb-4" />

      {/* Grid de semanas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {weeksInMonth.map(week => {
          const isSelected = selectedWeek === week.weekNumber;
          const occupiedInfo = occupiedWeeksInfo.find(info => info.week_number === week.weekNumber);
          const isFullyOccupied = occupiedInfo?.is_fully_occupied || false;
          
          // Deshabilitar semanas pasadas (comparar fecha de fin de semana con hoy)
          const today = new Date();
          today.setHours(0, 0, 0, 0); // Normalizar a medianoche para comparación
          const weekEndDate = new Date(week.endDate);
          weekEndDate.setHours(23, 59, 59, 999); // Fin del día de la fecha de fin
          const isPastWeek = year < currentYear || weekEndDate < today;
          const isDisabled = isFullyOccupied || isPastWeek;

          return (
            <div key={week.weekNumber} className="relative group">
              <button
                type="button"
                onClick={() => !isDisabled && onSelectWeek(week.weekNumber)}
                disabled={isDisabled}
                className={`
                  w-full p-3 rounded-lg border-2 transition-all text-left
                  ${isSelected 
                    ? 'border-blue-500 bg-blue-50 shadow-md' 
                    : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                  }
                  ${isDisabled 
                    ? 'opacity-40 cursor-not-allowed bg-gray-100' 
                    : 'cursor-pointer'
                  }
                  ${occupiedInfo && !isFullyOccupied && !isPastWeek
                    ? 'border-yellow-300 bg-yellow-50'
                    : ''
                  }
                `}
              >
                <div className="flex items-start justify-between mb-1">
                  <span className={`
                    text-xs font-semibold px-2 py-0.5 rounded-full
                    ${isSelected 
                      ? 'bg-blue-600 text-white' 
                      : occupiedInfo && !isFullyOccupied
                      ? 'bg-yellow-500 text-white'
                      : 'bg-gray-200 text-gray-700'
                    }
                  `}>
                    Sem {week.weekNumber}
                  </span>
                  {isSelected && (
                    <div className="h-2 w-2 bg-blue-600 rounded-full" />
                  )}
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  {formatDateRange(week)}
                </p>
                {occupiedInfo && (
                  <p className="text-xs text-gray-500 mt-1">
                    {occupiedInfo.available} de {totalUnits} disponibles
                  </p>
                )}
              </button>

              {/* Tooltip para semanas pasadas */}
              {isPastWeek && !occupiedInfo && (
                <div className="absolute z-10 hidden group-hover:block bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48">
                  <div className="bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg">
                    <div className="font-semibold mb-1">
                      Semana {week.weekNumber}
                    </div>
                    <div className="text-gray-300">
                      Esta semana ya pasó y no puede ser asignada
                    </div>
                  </div>
                </div>
              )}

              {/* Tooltip para semanas con ownerships */}
              {occupiedInfo && (
                <div className="absolute z-10 hidden group-hover:block bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-56">
                  <div className="bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg">
                    <div className="font-semibold mb-2">
                      Semana {week.weekNumber}
                    </div>
                    <div className="space-y-1 mb-2">
                      <div className="text-yellow-300">
                        {occupiedInfo.count} de {totalUnits} asignadas
                      </div>
                      <div className="text-green-300">
                        {occupiedInfo.available} disponibles
                      </div>
                    </div>
                    {occupiedInfo.owners.length > 0 && (
                      <>
                        <div className="border-t border-gray-700 pt-2 mt-2">
                          <div className="font-semibold mb-1">Propietarios:</div>
                          {occupiedInfo.owners.map((owner, idx) => (
                            <div key={idx} className="text-gray-300 mb-1">
                              {owner.owner_name || 'Sin nombre'}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
                      <div className="border-8 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Info adicional */}
      {selectedWeek !== null && (
        <div className="mt-4 pt-3 border-t bg-blue-50 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
              {selectedWeek}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">
                Semana {selectedWeek} seleccionada
              </p>
              <p className="text-xs text-gray-600">
                {formatDateRange(allWeeks[selectedWeek - 1])} • {year}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Navegación rápida por trimestres */}
      <div className="mt-4 pt-3 border-t">
        <p className="text-xs text-gray-500 mb-2">Ir a:</p>
        <div className="flex gap-2">
          {[
            { label: 'Q1', month: 0 },
            { label: 'Q2', month: 3 },
            { label: 'Q3', month: 6 },
            { label: 'Q4', month: 9 }
          ].map(quarter => (
            <button
              key={quarter.label}
              type="button"
              onClick={() => setCurrentMonth(quarter.month)}
              className={`
                flex-1 px-3 py-1.5 text-xs font-medium rounded border
                ${currentMonth >= quarter.month && currentMonth < quarter.month + 3
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }
              `}
            >
              {quarter.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WeekPicker;
