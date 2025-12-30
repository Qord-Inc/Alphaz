"use client";

import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as CalendarIcon, List, Clock, CheckCircle2, Trash2, Edit2, ExternalLink, ChevronLeft, ChevronRight, Linkedin, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useUser } from "@/hooks/useUser";
import { useOrganization } from "@/contexts/OrganizationContext";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DateTimePicker } from "@/components/ui/date-time-picker";

interface ScheduledDraft {
  id: string;
  user_clerk_id: string;
  organization_id: string | null;
  draft_version_id: string | null;
  draft_id: string | null;
  thread_id: string | null;
  content: string;
  title: string | null;
  scheduled_at: string | null;
  status: 'saved' | 'scheduled' | 'posted';
  notes: string | null;
  created_at: string;
  updated_at: string;
  posted_at: string | null;
}

export default function Plan() {
  const { user, loading: userLoading } = useUser();
  const { selectedOrganization, isPersonalProfile } = useOrganization();
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [drafts, setDrafts] = useState<ScheduledDraft[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [loading, setLoading] = useState(true);
  const [selectedDraft, setSelectedDraft] = useState<ScheduledDraft | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    content: '',
    title: '',
    scheduledAt: undefined as Date | undefined,
    notes: ''
  });
  const [isPosting, setIsPosting] = useState<string | null>(null); // draft id being posted
  const [postStatus, setPostStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false);
  const [draftToPublish, setDraftToPublish] = useState<ScheduledDraft | null>(null);

  useEffect(() => {
    if (userLoading) {
      setLoading(true);
      return;
    }
    
    if (user?.clerk_user_id) {
      fetchDrafts();
    } else {
      // User is not authenticated or doesn't exist
      setLoading(false);
      setDrafts([]);
    }
  }, [user?.clerk_user_id, selectedOrganization, isPersonalProfile, userLoading]);

  const fetchDrafts = async () => {
    if (!user?.clerk_user_id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (isPersonalProfile) {
        params.append('isPersonal', 'true');
      } else if (selectedOrganization?.id) {
        params.append('organizationId', selectedOrganization.id);
      }
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/scheduled-drafts/${user.clerk_user_id}?${params}`,
        { credentials: 'include' }
      );
      
      if (response.ok) {
        const data = await response.json();
        setDrafts(data.drafts || []);
      } else {
        console.error('Failed to fetch drafts:', response.status);
        setDrafts([]);
      }
    } catch (error) {
      console.error('Error fetching drafts:', error);
      setDrafts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsPosted = async (draftId: string) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/scheduled-drafts/${draftId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ status: 'posted' })
        }
      );
      
      if (response.ok) {
        fetchDrafts();
      }
    } catch (error) {
      console.error('Error marking draft as posted:', error);
    }
  };

  const handleDelete = async (draftId: string) => {
    if (!confirm('Are you sure you want to delete this draft?')) return;
    
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/scheduled-drafts/${draftId}`,
        {
          method: 'DELETE',
          credentials: 'include'
        }
      );
      
      if (response.ok) {
        fetchDrafts();
      }
    } catch (error) {
      console.error('Error deleting draft:', error);
    }
  };

  const handleEdit = (draft: ScheduledDraft) => {
    setSelectedDraft(draft);
    setEditForm({
      content: draft.content,
      title: draft.title || '',
      scheduledAt: draft.scheduled_at ? new Date(draft.scheduled_at) : undefined,
      notes: draft.notes || ''
    });
    setIsEditDialogOpen(true);
  };

  const handlePublishClick = (draft: ScheduledDraft) => {
    setDraftToPublish(draft);
    setIsPublishDialogOpen(true);
  };

  const handleConfirmPublish = async () => {
    if (!draftToPublish) return;
    setIsPublishDialogOpen(false);
    await handlePostToLinkedIn(draftToPublish);
    setDraftToPublish(null);
  };

  const handlePostToLinkedIn = async (draft: ScheduledDraft) => {
    if (!draft.content) return;
    if (!user?.clerk_user_id) {
      setPostStatus({ type: 'error', message: 'User not loaded yet.' });
      return;
    }

    try {
      setIsPosting(draft.id);
      setPostStatus({ type: 'info', message: 'Publishing to LinkedIn...' });
      
      const endpoint = isPersonalProfile 
        ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/linkedin/post/personal`
        : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/linkedin/post`;
      
      const payload = isPersonalProfile
        ? { clerkUserId: user.clerk_user_id, content: draft.content }
        : { clerkUserId: user.clerk_user_id, organizationId: selectedOrganization?.id, content: draft.content };
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = typeof data?.details === 'string' ? data.details : (data?.details?.message || data?.details?.messageText);
        const msg = data?.error || detail || 'Failed to post to LinkedIn';
        throw new Error(msg);
      }

      // Mark as posted in the database
      await handleMarkAsPosted(draft.id);
      setPostStatus({ type: 'success', message: 'Published to LinkedIn!' });
      
      // Clear status after 3 seconds
      setTimeout(() => setPostStatus(null), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to publish to LinkedIn';
      setPostStatus({ type: 'error', message: msg });
      setTimeout(() => setPostStatus(null), 5000);
    } finally {
      setIsPosting(null);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedDraft) return;
    
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/scheduled-drafts/${selectedDraft.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            content: editForm.content,
            title: editForm.title || null,
            scheduledAt: editForm.scheduledAt?.toISOString() || null,
            notes: editForm.notes || null
          })
        }
      );
      
      if (response.ok) {
        setIsEditDialogOpen(false);
        setSelectedDraft(null);
        fetchDrafts();
      }
    } catch (error) {
      console.error('Error updating draft:', error);
    }
  };

  const savedDrafts = drafts.filter(d => d.status === 'saved');
  const scheduledDrafts = drafts.filter(d => d.status === 'scheduled');
  const postedDrafts = drafts.filter(d => d.status === 'posted');

  const getDraftsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return scheduledDrafts.filter(d => {
      if (!d.scheduled_at) return false;
      return format(new Date(d.scheduled_at), 'yyyy-MM-dd') === dateStr;
    });
  };

  const datesWithDrafts = scheduledDrafts
    .filter(d => d.scheduled_at)
    .map(d => new Date(d.scheduled_at!));

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-background">
          <div>
            <h1 className="text-3xl font-bold">Plan</h1>
            <p className="text-muted-foreground mt-1">
              Manage your scheduled and saved drafts
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={view === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setView('list')}
              className="flex items-center gap-2"
            >
              <List className="h-4 w-4" />
              List
            </Button>
            <Button
              variant={view === 'calendar' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setView('calendar')}
              className="flex items-center gap-2"
            >
              <CalendarIcon className="h-4 w-4" />
              Calendar
            </Button>
          </div>
        </div>
        
        <main className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-muted-foreground">Loading drafts...</div>
            </div>
          ) : view === 'list' ? (
            <div className="space-y-6">
              {/* Scheduled Drafts */}
              <div>
                <h2 className="text-xl font-semibold mb-4">Scheduled ({scheduledDrafts.length})</h2>
                {scheduledDrafts.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No scheduled drafts. Schedule drafts from the Create page.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {scheduledDrafts.map((draft) => (
                      <Card key={draft.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <Clock className="h-4 w-4 text-blue-500 flex-shrink-0" />
                                <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                  {draft.scheduled_at && format(new Date(draft.scheduled_at), 'MMM d, yyyy • h:mm a')}
                                </span>
                              </div>
                              {draft.title && (
                                <h3 className="font-semibold mb-2">{draft.title}</h3>
                              )}
                              <p className="text-sm text-muted-foreground line-clamp-3 mb-2">
                                {draft.content}
                              </p>
                              {draft.notes && (
                                <p className="text-xs text-muted-foreground italic">Note: {draft.notes}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Button
                                size="sm"
                                onClick={() => handlePublishClick(draft)}
                                disabled={isPosting === draft.id}
                                title="Publish on LinkedIn"
                                className="mr-2 bg-[#0A66C2] hover:bg-[#004182] text-white"
                              >
                                {isPosting === draft.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Linkedin className="h-4 w-4" />
                                )}
                                <span className="ml-1 hidden sm:inline">Publish</span>
                              </Button>
                              {draft.thread_id && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const params = new URLSearchParams();
                                    if (draft.draft_id) params.set('draftId', draft.draft_id);
                                    if (draft.draft_version_id) params.set('versionId', draft.draft_version_id);
                                    const queryString = params.toString();
                                    window.location.href = `/create/${draft.thread_id}${queryString ? `?${queryString}` : ''}`;
                                  }}
                                  title="View thread & draft"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(draft)}
                                title="Edit"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMarkAsPosted(draft.id)}
                                title="Mark as posted"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(draft.id)}
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* Saved for Later */}
              <div>
                <h2 className="text-xl font-semibold mb-4">Saved for Later ({savedDrafts.length})</h2>
                {savedDrafts.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No saved drafts. Save drafts from the Create page.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {savedDrafts.map((draft) => (
                      <Card key={draft.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              {draft.title && (
                                <h3 className="font-semibold mb-2">{draft.title}</h3>
                              )}
                              <p className="text-sm text-muted-foreground line-clamp-3 mb-2">
                                {draft.content}
                              </p>
                              {draft.notes && (
                                <p className="text-xs text-muted-foreground italic">Note: {draft.notes}</p>
                              )}
                              <p className="text-xs text-muted-foreground mt-2">
                                Saved {format(new Date(draft.created_at), 'MMM d, yyyy')}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Button
                                size="sm"
                                onClick={() => handlePublishClick(draft)}
                                disabled={isPosting === draft.id}
                                title="Publish on LinkedIn"
                                className="mr-2 bg-[#0A66C2] hover:bg-[#004182] text-white"
                              >
                                {isPosting === draft.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Linkedin className="h-4 w-4" />
                                )}
                                <span className="ml-1 hidden sm:inline">Publish</span>
                              </Button>
                              {draft.thread_id && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const params = new URLSearchParams();
                                    if (draft.draft_id) params.set('draftId', draft.draft_id);
                                    if (draft.draft_version_id) params.set('versionId', draft.draft_version_id);
                                    const queryString = params.toString();
                                    window.location.href = `/create/${draft.thread_id}${queryString ? `?${queryString}` : ''}`;
                                  }}
                                  title="View thread & draft"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(draft)}
                                title="Edit"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMarkAsPosted(draft.id)}
                                title="Mark as posted"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(draft.id)}
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* Posted */}
              {postedDrafts.length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold mb-4">Posted ({postedDrafts.length})</h2>
                  <div className="space-y-3">
                    {postedDrafts.map((draft) => (
                      <Card key={draft.id} className="opacity-60">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                                <span className="text-sm font-medium text-green-600 dark:text-green-400">
                                  Posted {draft.posted_at && format(new Date(draft.posted_at), 'MMM d, yyyy')}
                                </span>
                              </div>
                              {draft.title && (
                                <h3 className="font-semibold mb-2">{draft.title}</h3>
                              )}
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {draft.content}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(draft.id)}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Calendar View - Bigger and Better */}
              <div className="xl:col-span-2">
                <Card>
                  <CardContent className="p-6">
                    {/* Custom Large Calendar */}
                    <div className="w-full">
                      {/* Month Navigation */}
                      <div className="flex items-center justify-between mb-6">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            const newDate = new Date(selectedDate || new Date());
                            newDate.setMonth(newDate.getMonth() - 1);
                            setSelectedDate(newDate);
                          }}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <h2 className="text-xl font-semibold">
                          {format(selectedDate || new Date(), 'MMMM yyyy')}
                        </h2>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            const newDate = new Date(selectedDate || new Date());
                            newDate.setMonth(newDate.getMonth() + 1);
                            setSelectedDate(newDate);
                          }}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      {/* Weekday Headers */}
                      <div className="grid grid-cols-7 gap-1 mb-2">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                          <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                            {day}
                          </div>
                        ))}
                      </div>
                      
                      {/* Calendar Days */}
                      <div className="grid grid-cols-7 gap-1">
                        {(() => {
                          const currentMonth = selectedDate || new Date();
                          const year = currentMonth.getFullYear();
                          const month = currentMonth.getMonth();
                          
                          const firstDay = new Date(year, month, 1);
                          const lastDay = new Date(year, month + 1, 0);
                          const startPadding = firstDay.getDay();
                          const daysInMonth = lastDay.getDate();
                          
                          const days = [];
                          
                          // Previous month padding
                          const prevMonthLastDay = new Date(year, month, 0).getDate();
                          for (let i = startPadding - 1; i >= 0; i--) {
                            const date = new Date(year, month - 1, prevMonthLastDay - i);
                            days.push({ date, isCurrentMonth: false });
                          }
                          
                          // Current month days
                          for (let i = 1; i <= daysInMonth; i++) {
                            const date = new Date(year, month, i);
                            days.push({ date, isCurrentMonth: true });
                          }
                          
                          // Next month padding
                          const remainingDays = 42 - days.length; // 6 rows × 7 days
                          for (let i = 1; i <= remainingDays; i++) {
                            const date = new Date(year, month + 1, i);
                            days.push({ date, isCurrentMonth: false });
                          }
                          
                          return days.map(({ date, isCurrentMonth }, index) => {
                            const dayDrafts = getDraftsForDate(date);
                            const hasScheduled = dayDrafts.length > 0;
                            const isSelected = selectedDate && format(date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
                            const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                            
                            return (
                              <button
                                key={index}
                                onClick={() => setSelectedDate(date)}
                                className={`
                                  relative min-h-[80px] p-2 rounded-lg border transition-all
                                  flex flex-col items-center
                                  ${!isCurrentMonth ? 'opacity-40' : ''}
                                  ${isSelected 
                                    ? 'bg-primary text-primary-foreground border-primary' 
                                    : isToday 
                                      ? 'bg-accent border-accent-foreground/20' 
                                      : 'hover:bg-accent border-transparent hover:border-border'
                                  }
                                `}
                              >
                                <span className={`text-sm ${isToday && !isSelected ? 'font-bold' : ''} ${hasScheduled ? 'font-semibold' : ''}`}>
                                  {date.getDate()}
                                </span>
                                
                                {hasScheduled && (
                                  <div className="flex flex-col items-center mt-1 gap-1">
                                    <div className="flex gap-1 flex-wrap justify-center">
                                      {dayDrafts.slice(0, 3).map((_, i) => (
                                        <div
                                          key={i}
                                          className={`w-2 h-2 rounded-full ${isSelected ? 'bg-primary-foreground' : !isCurrentMonth ? 'bg-primary/60' : 'bg-primary'}`}
                                        />
                                      ))}
                                    </div>
                                    {dayDrafts.length > 0 && (
                                      <span className={`text-[10px] ${isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                                        {dayDrafts.length} draft{dayDrafts.length > 1 ? 's' : ''}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </button>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Drafts for Selected Date */}
              <div>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {selectedDate ? format(selectedDate, 'MMMM d, yyyy') : 'Select a date'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedDate && (() => {
                      const dayDrafts = getDraftsForDate(selectedDate);
                      return dayDrafts.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          No drafts scheduled for this date
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {dayDrafts.map((draft) => (
                            <div key={draft.id} className="border rounded-lg p-3 hover:bg-accent transition-colors">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                                  {draft.scheduled_at && format(new Date(draft.scheduled_at), 'h:mm a')}
                                </span>
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    className="h-6 px-2 text-xs bg-[#0A66C2] hover:bg-[#004182] text-white"
                                    onClick={() => handlePublishClick(draft)}
                                    disabled={isPosting === draft.id}
                                    title="Publish on LinkedIn"
                                  >
                                    {isPosting === draft.id ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Linkedin className="h-3 w-3" />
                                    )}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={() => handleEdit(draft)}
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={() => handleMarkAsPosted(draft.id)}
                                  >
                                    <CheckCircle2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                              {draft.title && (
                                <h4 className="font-medium text-sm mb-1">{draft.title}</h4>
                              )}
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {draft.content}
                              </p>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </main>

        {/* Post Status Toast */}
        {postStatus && (
          <div className={`fixed bottom-4 right-4 z-50 p-4 rounded-lg shadow-lg ${
            postStatus.type === 'success' ? 'bg-green-500 text-white' :
            postStatus.type === 'error' ? 'bg-red-500 text-white' :
            'bg-blue-500 text-white'
          }`}>
            {postStatus.message}
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Draft</DialogTitle>
              <DialogDescription>
                Edit the content, schedule, title, or notes for this draft
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="content">Content</Label>
                <Textarea
                  id="content"
                  value={editForm.content}
                  onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                  placeholder="Write your post content..."
                  rows={8}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {editForm.content.length} characters
                  {selectedDraft?.draft_version_id && (
                    <span className="ml-2">• Changes will also update the original draft version</span>
                  )}
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="title">Title (optional)</Label>
                  <Input
                    id="title"
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    placeholder="Add a title..."
                  />
                </div>
                <div>
                  <Label htmlFor="scheduledAt">
                    <div className="flex items-center gap-2 mb-2">
                      <CalendarIcon className="h-4 w-4" />
                      Scheduled Date & Time
                    </div>
                  </Label>
                  <DateTimePicker
                    date={editForm.scheduledAt}
                    setDate={(date) => setEditForm({ ...editForm, scheduledAt: date })}
                    placeholder="Save for later (no date)"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  placeholder="Add notes or reminders..."
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit}>
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Publish Confirmation Dialog */}
        <Dialog open={isPublishDialogOpen} onOpenChange={setIsPublishDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Linkedin className="h-5 w-5 text-[#0A66C2]" />
                Publish to LinkedIn
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to publish this post to LinkedIn? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            {draftToPublish && (
              <div className="my-4 p-3 bg-muted rounded-md text-sm max-h-40 overflow-auto">
                {draftToPublish.content.length > 300 
                  ? `${draftToPublish.content.substring(0, 300)}...` 
                  : draftToPublish.content}
              </div>
            )}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => {
                setIsPublishDialogOpen(false);
                setDraftToPublish(null);
              }}>
                Cancel
              </Button>
              <Button 
                onClick={handleConfirmPublish}
                className="bg-[#0A66C2] hover:bg-[#004182] text-white"
              >
                <Linkedin className="h-4 w-4 mr-2" />
                Publish Now
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}