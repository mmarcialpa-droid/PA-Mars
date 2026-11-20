import React, { useState } from 'react';
import { Briefcase, Plus, Edit2, X, AlertCircle, Trash2, Power } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Position } from '../../types';
import { organizationService } from '../../services/organization/organizationService';

export const PositionManager: React.FC = () => {
  const { positions, departments, createPosition, updatePosition, deletePosition, isSuperAdmin, isAdmin, showToast } = useApp();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPos, setEditingPos] = useState<Position | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState(5);
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [parentPositionId, setParentPositionId] = useState<string | null>(null);

  const [filterDept, setFilterDept] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenCreate = () => {
    setEditingPos(null);
    setTitle('');
    setDescription('');
    setLevel(5);
    setDepartmentId(departments[0]?.id || null);
    setParentPositionId(null);
    setError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (pos: Position) => {
    setEditingPos(pos);
    setTitle(pos.title);
    setDescription(pos.description || '');
    setLevel(pos.level);
    setDepartmentId(pos.departmentId || null);
    setParentPositionId(pos.parentPositionId || null);
    setError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setError(null);

    // Validate circular reference if editing
    if (editingPos && parentPositionId) {
      if (parentPositionId === editingPos.id) {
        setError('A position cannot report to itself.');
        return;
      }
      const isCycle = organizationService.detectReportingCycle(positions, editingPos.id, parentPositionId);
      if (isCycle) {
        setError('Circular reporting detected! A position cannot report to any of its subordinate positions.');
        return;
      }
    }

    setLoading(true);
    try {
      if (editingPos) {
        await updatePosition(editingPos.id, {
          title: title.trim(),
          description: description.trim(),
          level: Number(level),
          organizationalLevel: Number(level),
          departmentId: departmentId || undefined,
          parentPositionId: parentPositionId || undefined
        });
      } else {
        await createPosition({
          title: title.trim(),
          description: description.trim(),
          level: Number(level),
          organizationalLevel: Number(level),
          departmentId: departmentId || undefined,
          parentPositionId: parentPositionId || undefined
        });
      }
      setIsModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not save position.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const filteredPositions = positions.filter(p => {
    if (filterDept === 'all') return true;
    return p.departmentId === filterDept;
  }).sort((a, b) => b.level - a.level);

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            Organizational Positions & Reporting Hierarchy
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Define corporate job titles, seniority levels (1-10), and direct reporting lines.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700"
          >
            <option value="all">All Departments</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          {(isSuperAdmin || isAdmin) && (
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Position</span>
            </button>
          )}
        </div>
      </div>

      {/* Position List */}
      {filteredPositions.length === 0 ? (
        <div className="py-12 text-center bg-white border border-slate-200 rounded-xl p-8">
          <Briefcase className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-800">No positions configured</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Positions establish organizational levels and supervisory relationships.
          </p>
          <button
            onClick={handleOpenCreate}
            className="mt-3 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold"
          >
            Add First Position
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="divide-y divide-slate-100">
            {filteredPositions.map(pos => {
              const dept = departments.find(d => d.id === pos.departmentId);
              const parentPos = positions.find(p => p.id === pos.parentPositionId);

              return (
                <div key={pos.id} className="p-4 hover:bg-slate-50/70 transition-colors flex items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center font-mono font-bold text-xs shrink-0">
                      L{pos.level}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 truncate">{pos.title}</span>
                        <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-medium">
                          {dept?.name || 'Cross-departmental'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                        {pos.description || 'No description provided.'}
                      </p>
                      {parentPos && (
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-1">
                          <span className="text-slate-400">Reports to:</span>
                          <span className="font-semibold text-slate-700">{parentPos.title}</span>
                          <span className="text-slate-400">(Level {parentPos.level})</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {(isSuperAdmin || isAdmin) && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => updatePosition(pos.id, { status: pos.status === 'active' ? 'archived' : 'active' })}
                        className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors ${
                          pos.status === 'active'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                        title={pos.status === 'active' ? 'Deactivate Position' : 'Activate Position'}
                      >
                        <Power className="w-3 h-3 inline mr-1" />
                        {pos.status === 'active' ? 'Active' : 'Inactive'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(pos)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100"
                        title="Edit Position"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await deletePosition(pos.id);
                          } catch (err: unknown) {
                            showToast('error', err instanceof Error ? err.message : 'Cannot delete position.');
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50"
                        title="Delete Position"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingPos ? 'Edit Position' : 'Create New Position'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Position Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Lead Full-Stack Architect"
                  required
                  className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Seniority Level Scale (1 to 10)
                </label>
                <select
                  value={level}
                  onChange={(e) => setLevel(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  <option value={10}>Level 10 - Executive / C-Suite</option>
                  <option value={9}>Level 9 - Vice President / Principal Director</option>
                  <option value={8}>Level 8 - Department Head / Director</option>
                  <option value={7}>Level 7 - Senior Manager / Principal Lead</option>
                  <option value={6}>Level 6 - Team Leader / Manager</option>
                  <option value={5}>Level 5 - Senior Professional</option>
                  <option value={4}>Level 4 - Mid-Level Specialist</option>
                  <option value={3}>Level 3 - Associate Professional</option>
                  <option value={2}>Level 2 - Junior Staff</option>
                  <option value={1}>Level 1 - Entry Level / Trainee</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Assigned Department
                </label>
                <select
                  value={departmentId || ''}
                  onChange={(e) => setDepartmentId(e.target.value ? e.target.value : null)}
                  className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  <option value="">Cross-Departmental / Global</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Reports To (Parent Position)
                </label>
                <select
                  value={parentPositionId || ''}
                  onChange={(e) => setParentPositionId(e.target.value ? e.target.value : null)}
                  className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  <option value="">None (Top-Level Executive / Independent)</option>
                  {positions
                    .filter(p => !editingPos || p.id !== editingPos.id)
                    .map(p => (
                      <option key={p.id} value={p.id}>{p.title} (Level {p.level})</option>
                    ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Reporting cycles are automatically validated to prevent circular reporting relationships.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Description / Responsibilities
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Primary duties and responsibilities..."
                  className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !title.trim()}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg font-semibold flex items-center gap-1.5"
                >
                  {loading ? 'Saving...' : 'Save Position'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
