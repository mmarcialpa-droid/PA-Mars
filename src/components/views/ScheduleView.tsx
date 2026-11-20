import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const ScheduleView: React.FC = () => {
  const { events, projects, createEvent, deleteEvent, isAdmin, isSuperAdmin } = useApp();

  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newProjId, setNewProjId] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newTime, setNewTime] = useState('10:00 - 11:00');
  const [newType, setNewType] = useState<'deadline' | 'milestone' | 'meeting' | 'review'>('meeting');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (projects.length > 0 && (!newProjId || !projects.some((p) => p.id === newProjId))) {
      setNewProjId(projects[0].id);
    }
  }, [projects, newProjId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newProjId) return;

    setSubmitting(true);
    try {
      await createEvent({
        projectId: newProjId,
        title: newTitle.trim(),
        date: newDate,
        time: newTime,
        type: newType,
        attendeeIds: []
      });

      setIsAddingEvent(false);
      setNewTitle('');
    } finally {
      setSubmitting(false);
    }
  };

  const sortedEvents = [...events].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-display text-slate-900 tracking-tight">
            Schedule & Milestones
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Global timeline of project deadlines, review gates, code freezes, and deliverables.
          </p>
        </div>

        <button
          onClick={() => setIsAddingEvent(true)}
          disabled={projects.length === 0}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 disabled:opacity-40 transition-colors shadow-xs self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Milestone / Event</span>
        </button>
      </div>

      {isAddingEvent && (
        <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="text-xs font-bold text-slate-900">Add Schedule Event</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Title *</label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Design Freeze & Client Review"
                className="w-full text-xs p-2 border border-slate-200 rounded-lg outline-hidden focus:border-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Project *</label>
              <select
                value={newProjId}
                onChange={(e) => setNewProjId(e.target.value)}
                required
                className="w-full text-xs p-2 border border-slate-200 rounded-lg outline-hidden bg-white"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Date *</label>
              <input
                type="date"
                required
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full text-xs p-2 border border-slate-200 rounded-lg outline-hidden bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Time Window</label>
              <input
                type="text"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                placeholder="10:00 - 11:00"
                className="w-full text-xs p-2 border border-slate-200 rounded-lg outline-hidden bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Event Type</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as any)}
                className="w-full text-xs p-2 border border-slate-200 rounded-lg outline-hidden bg-white"
              >
                <option value="milestone">Milestone</option>
                <option value="review">Review Gate</option>
                <option value="deadline">Task Deadline</option>
                <option value="meeting">Team Meeting</option>
              </select>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAddingEvent(false)}
              className="px-3 py-1.5 text-xs text-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !newTitle.trim() || !newProjId}
              className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 disabled:opacity-40"
            >
              {submitting ? 'Saving...' : 'Save Event'}
            </button>
          </div>
        </form>
      )}

      {sortedEvents.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <CalendarIcon className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-slate-800">No scheduled events yet</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {projects.length === 0
              ? 'Create a project workspace first to schedule milestones and review dates.'
              : 'Add project milestones, client review gates, or team meetings to track upcoming dates.'}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden shadow-2xs">
          {sortedEvents.map((event) => {
            const proj = projects.find((p) => p.id === event.projectId);
            return (
              <div
                key={event.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <span
                    className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
                    style={{ backgroundColor: proj?.color || '#0284c7' }}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{event.title}</span>
                      <span className="px-2 py-0.2 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 capitalize">
                        {event.type}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {proj?.name || 'Project'} · {event.description || 'Project schedule item'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 font-mono-tabular shrink-0">
                  <div className="text-right">
                    <span className="font-bold text-slate-900">{event.date}</span>
                    {event.time && <div className="text-[11px] text-slate-500">{event.time}</div>}
                  </div>
                  {(isAdmin || isSuperAdmin) && (
                    <button
                      type="button"
                      onClick={() => deleteEvent(event.projectId, event.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded"
                      title="Delete Event"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
