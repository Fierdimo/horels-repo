import { ReactNode } from 'react';

interface Tab {
  id: string;
  label: string;
  count?: number;
  icon?: ReactNode;
}

interface ModernTabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: 'default' | 'pills';
}

export function ModernTabs({ tabs, activeTab, onChange, variant = 'default' }: ModernTabsProps) {
  if (variant === 'pills') {
    return (
      <div className="bg-gray-100 rounded-lg p-1 inline-flex gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`
              px-4 py-2 rounded-md font-medium text-sm transition-all duration-200
              ${activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }
            `}
          >
            <div className="flex items-center gap-2">
              {tab.icon && <span className="text-base">{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`
                  px-2 py-0.5 rounded-full text-xs font-semibold
                  ${activeTab === tab.id
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-gray-200 text-gray-700'
                  }
                `}>
                  {tab.count}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="border-b border-gray-200">
      <nav className="flex space-x-8" aria-label="Tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm transition-all duration-200
              flex items-center gap-2
              ${activeTab === tab.id
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            {tab.icon && <span className="text-base">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`
                px-2 py-0.5 rounded-full text-xs font-semibold
                ${activeTab === tab.id
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-gray-100 text-gray-600'
                }
              `}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}
