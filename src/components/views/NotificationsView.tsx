import React, { useState } from 'react';
import { 
  Bell, 
  CheckCircle2, 
  ShieldCheck, 
  AlertCircle, 
  MessageSquare, 
  Check, 
  Clock 
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const NotificationsView: React.FC = () => {
  const { 
    notifications, 
    currentUser, 
    markNotificationAsRead, 
    markAllNotificationsAsRead, 
    setSelectedTaskId,
    setActiveProjectId,
    setActiveProjectTab 
  } = useApp();

  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const userNotifications = notifications.filter(n => {
    if (!currentUser || n.recipientId !== currentUser.id) return false;
    if (filter === 'unread' && n.isRead) return false;
    return true;
  });

  const handleNotificationClick = (notif: typeof notifications[0]) => {
    markNotificationAsRead(notif.id);
    if (notif.projectId) {
      setActiveProjectId(notif.projectId);
      if (notif.targetType === 'approval' || notif.targetType === 'task') {
        setSelectedTaskId(notif.targetId);
      } else if (notif.targetType === 'discussion') {
        setActiveProjectTab('discussions');
      }
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-display text-slate-900 tracking-tight">
            Notifications Center
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Task assignments, approval requests, revision notes, mentions, and updates.
          </p>
        </div>

        <button
          onClick={markAllNotificationsAsRead}
          className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
        >
          Mark all as read
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
            filter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          All Notifications ({currentUser ? notifications.filter(n => n.recipientId === currentUser.id).length : 0})
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
            filter === 'unread' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Unread ({currentUser ? notifications.filter(n => n.recipientId === currentUser.id && !n.isRead).length : 0})
        </button>
      </div>

      {/* Notification List */}
      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden shadow-2xs">
        {userNotifications.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-400">
            No notifications matching this view.
          </div>
        ) : (
          userNotifications.map(notif => (
            <div
              key={notif.id}
              onClick={() => handleNotificationClick(notif)}
              className={`p-4 hover:bg-slate-50 cursor-pointer transition-colors flex items-start justify-between gap-4 text-xs ${
                !notif.isRead ? 'bg-blue-50/30' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  {notif.type === 'submitted_approval' && <ShieldCheck className="w-4 h-4 text-amber-600" />}
                  {notif.type === 'revision_requested' && <AlertCircle className="w-4 h-4 text-orange-600" />}
                  {notif.type === 'approved' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                  {notif.type === 'commented' && <MessageSquare className="w-4 h-4 text-blue-600" />}
                  {notif.type === 'assigned' && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{notif.title}</span>
                    {!notif.isRead && (
                      <span className="w-2 h-2 rounded-full bg-blue-600" />
                    )}
                  </div>
                  <p className="text-slate-600 text-xs mt-1 leading-relaxed">
                    {notif.message}
                  </p>
                  <span className="text-[10px] text-slate-400 font-mono-tabular mt-1 block">
                    {new Date(notif.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>

              {!notif.isRead && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    markNotificationAsRead(notif.id);
                  }}
                  className="p-1 text-slate-400 hover:text-slate-700"
                  title="Mark read"
                >
                  <Check className="w-4 h-4" />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
