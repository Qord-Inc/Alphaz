'use client';

import { Building2, Pencil, Check, X } from 'lucide-react';
import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { InlineEditPopup } from './inline-edit-popup';

interface LinkedInPostPreviewProps {
  organizationName: string;
  organizationImage?: string;
  postContent: string;
  timestamp?: string;
  enableInlineEdit?: boolean;
  onInlineEdit?: (instruction: string, selectedText: string) => void;
  /** Whether content is currently streaming from AI */
  isStreaming?: boolean;
  /** Enable direct editing mode (like MS Word) */
  enableDirectEdit?: boolean;
  /** Called when content is directly edited */
  onContentChange?: (newContent: string) => void;
  /** Whether changes are being saved */
  isSaving?: boolean;
}

export const LinkedInPostPreview = memo(({ 
  organizationName, 
  organizationImage, 
  postContent,
  timestamp = 'Just now',
  enableInlineEdit = false,
  onInlineEdit,
  isStreaming = false,
  enableDirectEdit = false,
  onContentChange,
  isSaving = false,
}: LinkedInPostPreviewProps) => {
  const [selectedText, setSelectedText] = useState('');
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(postContent);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Sync editedContent when postContent changes from external source
  useEffect(() => {
    if (!isEditing) {
      setEditedContent(postContent);
    }
  }, [postContent, isEditing]);
  
  // Auto-resize textarea to fit content
  const adjustTextareaHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, []);
  
  // Start editing mode
  const handleStartEdit = useCallback(() => {
    setIsEditing(true);
    setEditedContent(postContent);
    // Focus textarea after render
    setTimeout(() => {
      textareaRef.current?.focus();
      adjustTextareaHeight();
    }, 0);
  }, [postContent, adjustTextareaHeight]);
  
  // Cancel editing
  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditedContent(postContent);
  }, [postContent]);
  
  // Save edited content
  const handleSaveEdit = useCallback(() => {
    if (onContentChange && editedContent !== postContent) {
      onContentChange(editedContent);
    }
    setIsEditing(false);
  }, [onContentChange, editedContent, postContent]);
  
  // Handle textarea changes
  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditedContent(e.target.value);
    adjustTextareaHeight();
  }, [adjustTextareaHeight]);
  
  // Handle keyboard shortcuts in edit mode
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      handleCancelEdit();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSaveEdit();
    }
  }, [handleCancelEdit, handleSaveEdit]);

  const handleTextSelection = useCallback(() => {
    if (!enableInlineEdit) return;

    const selection = window.getSelection();
    const text = selection?.toString().trim();
    
    if (text && text.length > 0) {
      // Get selection position
      const range = selection?.getRangeAt(0);
      const rect = range?.getBoundingClientRect();
      
      if (rect) {
        setSelectedText(text);
        // Position popup below the selection
        setPopupPosition({
          x: rect.left,
          y: rect.bottom + window.scrollY + 8
        });
      }
    }
  }, [enableInlineEdit]);

  const handleClosePopup = useCallback(() => {
    setSelectedText('');
    setPopupPosition(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  const handleInlineEditSubmit = useCallback((instruction: string, selectedText: string) => {
    if (onInlineEdit) {
      onInlineEdit(instruction, selectedText);
    }
    handleClosePopup();
  }, [onInlineEdit, handleClosePopup]);

  return (
    <>
    <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
      {/* Post Header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Organization Avatar */}
          <div className="flex-shrink-0">
            {organizationImage ? (
              <img 
                src={organizationImage} 
                alt={organizationName}
                className="w-12 h-12 rounded object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            )}
          </div>

          {/* Organization Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground text-sm truncate">
              {organizationName}
            </h3>
            <p className="text-xs text-muted-foreground">
              Company • Follow
            </p>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              {timestamp} • 🌎
            </p>
          </div>

          {/* More Options */}
          <button className="text-muted-foreground hover:bg-muted rounded p-1">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Post Content */}
      <div className="px-4 pb-3">
        {/* Edit Mode */}
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              ref={textareaRef}
              value={editedContent}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              className="w-full text-sm text-foreground bg-muted/50 border border-primary/30 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 leading-relaxed"
              style={{ minHeight: '150px' }}
              placeholder="Write your post content..."
            />
            <div className="flex items-center justify-between">

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCancelEdit}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition"
                >
                  <X className="h-3 w-3" />
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={isSaving || editedContent === postContent}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Check className="h-3 w-3" />
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* View Mode */
          <div className="relative group">
            <div 
              className={`text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed ${
                enableInlineEdit ? 'select-text cursor-text' : ''
              } ${enableDirectEdit && !isStreaming ? 'pr-8' : ''}`}
              onMouseUp={handleTextSelection}
            >
              {postContent ? (
                <>
                  {postContent}
                  {isStreaming && (
                    <span className="inline-block w-2 h-4 bg-blue-500 dark:bg-blue-400 ml-0.5 animate-pulse rounded-sm" />
                  )}
                </>
              ) : (
                <span className="text-muted-foreground italic">
                  {isStreaming ? 'Generating your post...' : 'Your post content will appear here...'}
                </span>
              )}
            </div>
            {/* Edit Button - Shows on hover when direct edit is enabled */}
            {enableDirectEdit && postContent && !isStreaming && (
              <button
                onClick={handleStartEdit}
                className="absolute top-0 right-0 p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded-md transition opacity-0 group-hover:opacity-100"
                title="Edit post content"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>
      
      {/* Inline Edit Popup */}
      {popupPosition && selectedText && (
        <InlineEditPopup
          selectedText={selectedText}
          position={popupPosition}
          onSubmit={handleInlineEditSubmit}
          onClose={handleClosePopup}
        />
      )}

      {/* Post Stats */}
      <div className="px-4 py-2 border-t border-border">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="flex -space-x-1">
              <div className="w-4 h-4 rounded-full bg-blue-500 border border-white flex items-center justify-center">
                <span className="text-white text-[8px]">👍</span>
              </div>
              <div className="w-4 h-4 rounded-full bg-red-500 border border-white flex items-center justify-center">
                <span className="text-white text-[8px]">❤️</span>
              </div>
              <div className="w-4 h-4 rounded-full bg-green-500 border border-white flex items-center justify-center">
                <span className="text-white text-[8px]">💡</span>
              </div>
            </div>
            <span>0</span>
          </div>
          <div className="flex items-center gap-3">
            <span>0 comments</span>
            <span>•</span>
            <span>0 reposts</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-4 py-2 border-t border-border">
        <div className="flex items-center justify-around">
          <button className="flex items-center gap-2 px-4 py-2 hover:bg-muted rounded transition text-muted-foreground hover:text-foreground">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
            </svg>
            <span className="text-sm font-medium">Like</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 hover:bg-muted rounded transition text-muted-foreground hover:text-foreground">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="text-sm font-medium">Comment</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 hover:bg-muted rounded transition text-muted-foreground hover:text-foreground">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            <span className="text-sm font-medium">Repost</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 hover:bg-muted rounded transition text-muted-foreground hover:text-foreground">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            <span className="text-sm font-medium">Send</span>
          </button>
        </div>
      </div>
    </div>
    </>
  );
});

LinkedInPostPreview.displayName = 'LinkedInPostPreview';
