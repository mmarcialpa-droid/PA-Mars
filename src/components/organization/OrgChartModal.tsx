import React, { useState } from 'react';
import { X, Network, Users, Building2, Briefcase, ChevronDown, ChevronRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Position, Department } from '../../types';

export const OrgChartModal: React.FC = () => {
  const { isOrgChartOpen, setIsOrgChartOpen, positions, departments, allUsers, organization } = useApp();

  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  if (!isOrgChartOpen) return null;

  const toggleExpand = (posId: string) => {
    setExpandedNodes(prev => ({ ...prev, [posId]: !prev[posId] }));
  };

  // Find root positions (no parentPositionId)
  const rootPositions = positions.filter(p => !p.parentPositionId).sort((a, b) => b.level - a.level);

  // Helper to get subordinates
  const getSubordinates = (posId: string) => {
    return positions.filter(p => p.parentPositionId === posId).sort((a, b) => b.level - a.level);
  };

  const renderPositionNode = (pos: Position, depth = 0) => {
    const subordinates = getSubordinates(pos.id);
    const assignedUsers = allUsers.filter(u => u.positionId === pos.id);
    const dept = departments.find(d => d.id === pos.departmentId);
    const isExpanded = expandedNodes[pos.id] !== false; // Default expanded

    return (
      <div key={pos.id} className="flex flex-col items-center">
        {/* Card */}
        <div className="relative bg-white border border-slate-200/90 rounded-xl p-3 shadow-xs hover:border-slate-300 transition-all w-64 text-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">
              Level {pos.level}
            </span>
            {dept && (
              <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded truncate max-w-[120px]">
                {dept.name}
              </span>
            )}
          </div>

          <h4 className="font-bold text-slate-900 truncate text-xs">{pos.title}</h4>
          
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5">
              <Users className="w-3 h-3 text-slate-400" />
              <span>{assignedUsers.length} staff</span>
            </div>
            {assignedUsers.length > 0 && (
              <span className="font-semibold text-slate-700 truncate max-w-[120px]">
                {assignedUsers[0].name}
              </span>
            )}
          </div>

          {subordinates.length > 0 && (
            <button
              onClick={() => toggleExpand(pos.id)}
              className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center hover:bg-slate-800 shadow-xs z-10"
              title={isExpanded ? 'Collapse subordinates' : 'Expand subordinates'}
            >
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>

        {/* Tree Branch Lines & Children */}
        {subordinates.length > 0 && isExpanded && (
          <div className="flex flex-col items-center">
            {/* Vertical stem down */}
            <div className="w-0.5 h-6 bg-slate-300" />
            
            {/* Horizontal connector bar if multiple subordinates */}
            <div className="flex justify-center items-start pt-2 relative">
              {subordinates.map((sub, idx) => {
                const isOnly = subordinates.length === 1;
                const isFirst = idx === 0;
                const isLast = idx === subordinates.length - 1;

                return (
                  <div key={sub.id} className="flex flex-col items-center px-4 relative">
                    {!isOnly && (
                      <div
                        className={`absolute top-0 h-0.5 bg-slate-300 ${
                          isFirst ? 'left-1/2 right-0' : isLast ? 'left-0 right-1/2' : 'left-0 right-0'
                        }`}
                      />
                    )}
                    <div className="w-0.5 h-4 bg-slate-300 mb-2" />
                    {renderPositionNode(sub, depth + 1)}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="w-full max-w-6xl h-[85vh] bg-slate-50 rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
              <Network className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {organization?.name || 'MARS'} Organizational Chart
              </h3>
              <p className="text-[11px] text-slate-500">
                Visual supervisory lines and reporting hierarchy
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 hidden sm:inline">
              {positions.length} positions across {departments.length} departments
            </span>
            <button
              onClick={() => setIsOrgChartOpen(false)}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Canvas Body */}
        <div className="flex-1 overflow-auto p-8 flex justify-center">
          {rootPositions.length === 0 ? (
            <div className="m-auto text-center py-12 text-slate-400 text-xs">
              No positions created yet. Add positions in the Administration Hub to see the visual org tree.
            </div>
          ) : (
            <div className="flex gap-12 items-start justify-center min-w-max">
              {rootPositions.map(rootPos => renderPositionNode(rootPos))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
