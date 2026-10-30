'use client';

import React, { useState, useEffect, useRef, useTransition } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  MessageSquare,
  AlertTriangle,
  FileCheck,
  UserCheck,
  Info,
  ExternalLink,
} from 'lucide-react';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../actions';
import type { NotificationItem, NotificationCategory } from '../types';
import Link from 'next/link';

interface NotificationBellProps {
  initialUnreadCount?: number;
  initialNotifications?: NotificationItem[];
}

export function NotificationBell({
  initialUnreadCount = 0,
  initialNotifications = [],
}: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);
  const [unreadCount, setUnreadCount] = useState<number>(initialUnreadCount);
  const [isPending, startTransition] = useTransition();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Fetch notifications on open or mount
  const refreshNotifications = async () => {
    startTransition(async () => {
      const items = await getNotifications(15);
      setNotifications(items);
      setUnreadCount(items.filter((item) => !item.isRead).length);
    });
  };

  const handleToggle = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      refreshNotifications();
    }
  };

  const handleMarkOne = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      const res = await markNotificationAsRead(id);
      if (res.success) {
        setNotifications((prev) =>
          prev.map((item) => (item.id === id ? { ...item, isRead: true } : item))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    });
  };

  const handleMarkAll = async () => {
    startTransition(async () => {
      const res = await markAllNotificationsAsRead();
      if (res.success) {
        setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
        setUnreadCount(0);
      }
    });
  };

  const getCategoryIcon = (category: NotificationCategory) => {
    switch (category) {
      case 'inquiry':
        return <MessageSquare className="w-4 h-4 text-blue-600" />;
      case 'approval':
        return <FileCheck className="w-4 h-4 text-emerald-600" />;
      case 'overdue':
        return <AlertTriangle className="w-4 h-4 text-amber-600" />;
      case 'assignment':
        return <UserCheck className="w-4 h-4 text-purple-600" />;
      default:
        return <Info className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={handleToggle}
        aria-label={`Notifications (${unreadCount} unread)`}
        aria-expanded={isOpen}
        className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[1.125rem] h-4.5 px-1 text-[11px] font-bold text-white bg-red-600 rounded-full border-2 border-white animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Flyout Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-lg shadow-xl border border-slate-200 z-50 overflow-hidden transition-all animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-800 text-sm">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                disabled={isPending}
                className="text-xs text-teal-700 hover:text-teal-900 font-medium flex items-center gap-1 hover:underline disabled:opacity-50"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[22rem] overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="py-8 px-4 text-center text-slate-500">
                <Bell className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-sm font-medium">No notifications yet</p>
                <p className="text-xs text-slate-400 mt-1">You are completely caught up!</p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 transition-colors ${
                    item.isRead ? 'bg-white hover:bg-slate-50' : 'bg-blue-50/40 hover:bg-blue-50/70'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 p-1.5 rounded-md bg-slate-100 border border-slate-200 flex-shrink-0">
                      {getCategoryIcon(item.category)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className={`text-xs truncate ${item.isRead ? 'font-medium text-slate-700' : 'font-bold text-slate-900'}`}>
                          {item.title}
                        </p>
                        {!item.isRead && (
                          <span className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">
                        {item.message}
                      </p>
                      <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100/80">
                        <span className="text-[10px] text-slate-400">
                          {new Date(item.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <div className="flex items-center gap-2">
                          {item.actionUrl && (
                            <Link
                              href={item.actionUrl}
                              onClick={() => {
                                if (!item.isRead) {
                                  markNotificationAsRead(item.id);
                                }
                                setIsOpen(false);
                              }}
                              className="text-[11px] text-teal-700 hover:text-teal-900 font-medium flex items-center gap-1 hover:underline"
                            >
                              View <ExternalLink className="w-3 h-3" />
                            </Link>
                          )}
                          {!item.isRead && (
                            <button
                              type="button"
                              onClick={(e) => handleMarkOne(item.id, e)}
                              title="Mark as read"
                              className="text-[11px] text-slate-400 hover:text-slate-700 p-0.5 rounded"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
