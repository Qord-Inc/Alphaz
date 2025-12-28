"use client";

import { useState, useCallback, useEffect, memo } from "react";
import { ThumbsUp, ThumbsDown, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface MessageFeedbackProps {
  messageId: string;
  threadId: string;
  userId: string;
  existingFeedback?: { type: 'up' | 'down'; text?: string } | null;
  onFeedbackSaved?: (messageId: string, type: 'up' | 'down', text?: string) => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export const MessageFeedback = memo(({
  messageId,
  threadId,
  userId,
  existingFeedback,
  onFeedbackSaved
}: MessageFeedbackProps) => {
  const [selectedType, setSelectedType] = useState<'up' | 'down' | null>(
    existingFeedback?.type || null
  );
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingType, setPendingType] = useState<'up' | 'down' | null>(null);

  // Sync selectedType when existingFeedback changes (e.g., after fetching from API)
  useEffect(() => {
    setSelectedType(existingFeedback?.type || null);
  }, [existingFeedback?.type]);

  const saveFeedback = useCallback(async (type: 'up' | 'down', text?: string) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          messageId,
          threadId,
          feedbackType: type,
          feedbackText: text || undefined
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save feedback');
      }

      setSelectedType(type);
      setShowFeedbackInput(false);
      setFeedbackText('');
      setPendingType(null);
      onFeedbackSaved?.(messageId, type, text);
    } catch (err) {
      console.error('Error saving feedback:', err);
    } finally {
      setIsSubmitting(false);
    }
  }, [userId, messageId, threadId, onFeedbackSaved]);

  const handleThumbClick = useCallback((type: 'up' | 'down') => {
    // Immediately update visual selection
    setSelectedType(type);
    
    // Show feedback input for the selected type
    setPendingType(type);
    setShowFeedbackInput(true);
  }, []);

  const handleSubmitFeedback = useCallback(() => {
    if (pendingType) {
      saveFeedback(pendingType, feedbackText.trim() || undefined);
    }
  }, [pendingType, feedbackText, saveFeedback]);

  const handleQuickFeedback = useCallback((type: 'up' | 'down') => {
    // Quick feedback without text (just click and save)
    saveFeedback(type);
  }, [saveFeedback]);

  const handleCancel = useCallback(() => {
    setShowFeedbackInput(false);
    setFeedbackText('');
    setPendingType(null);
  }, []);

  // Use pendingType when input is open, otherwise use selectedType
  const displayType = showFeedbackInput ? pendingType : selectedType;

  return (
    <div className="flex flex-col gap-2">
      {/* Thumbs buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => handleThumbClick('up')}
          onDoubleClick={() => handleQuickFeedback('up')}
          disabled={isSubmitting}
          className={`p-1.5 rounded-md transition-colors ${
            displayType === 'up'
              ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
          title={displayType === 'up' ? 'Good response (click to add comment)' : 'Good response'}
        >
          <ThumbsUp className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => handleThumbClick('down')}
          onDoubleClick={() => handleQuickFeedback('down')}
          disabled={isSubmitting}
          className={`p-1.5 rounded-md transition-colors ${
            displayType === 'down'
              ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
          title={displayType === 'down' ? 'Poor response (click to add comment)' : 'Poor response'}
        >
          <ThumbsDown className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Feedback text input */}
      {showFeedbackInput && (
        <div className="mt-1 p-2 bg-muted/50 rounded-lg border border-border animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-muted-foreground">
              {pendingType === 'up' ? '👍 What was good?' : '👎 What could be better?'}
            </span>
            <span className="text-xs text-muted-foreground/60">(optional)</span>
          </div>
          <Textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder={
              pendingType === 'up' 
                ? "e.g., Great draft, matched my tone perfectly..." 
                : "e.g., Too generic, didn't capture my voice..."
            }
            className="min-h-[60px] text-sm resize-none"
            disabled={isSubmitting}
          />
          <div className="flex justify-end gap-2 mt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={isSubmitting}
              className="h-7 text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmitFeedback}
              disabled={isSubmitting}
              className="h-7 text-xs"
            >
              {isSubmitting ? (
                <span className="animate-pulse">Saving...</span>
              ) : (
                <>
                  <Send className="h-3 w-3 mr-1" />
                  Submit
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
});

MessageFeedback.displayName = 'MessageFeedback';
