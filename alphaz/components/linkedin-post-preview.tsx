'use client';

import { Building2, Pencil, Check, X, ImagePlus, Trash2, Loader2 } from 'lucide-react';
import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { InlineEditPopup } from './inline-edit-popup';

export interface UploadedImage {
  file: File;
  preview: string; // Data URL for preview
  assetUrn?: string; // LinkedIn asset URN after upload
  isUploading?: boolean;
  error?: string;
}

interface LinkedInPostPreviewProps {
  /** Display name (organization name or user's LinkedIn name) */
  displayName: string;
  /** Display image (organization logo or user's LinkedIn profile pic) */
  displayImage?: string;
  /** Whether this is a personal profile (affects subtitle text) */
  isPersonalProfile?: boolean;
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
  /** Controlled editing state - if provided, component is controlled */
  isEditing?: boolean;
  /** Called when edit mode should start */
  onStartEdit?: () => void;
  /** Called when edit is cancelled */
  onCancelEdit?: () => void;
  /** Called when edit is saved */
  onSaveEdit?: () => void;
  /** Current edited content (for controlled mode) */
  editedContent?: string;
  /** Called when edited content changes */
  onEditedContentChange?: (content: string) => void;
  /** Uploaded images for this post */
  uploadedImages?: UploadedImage[];
  /** Called when user adds images */
  onImagesChange?: (images: UploadedImage[]) => void;
  /** Enable image upload feature */
  enableImageUpload?: boolean;
}

export const LinkedInPostPreview = memo(({ 
  displayName, 
  displayImage, 
  isPersonalProfile = false,
  postContent,
  timestamp = 'Just now',
  enableInlineEdit = false,
  onInlineEdit,
  isStreaming = false,
  enableDirectEdit = false,
  onContentChange,
  isSaving = false,
  // Controlled editing props
  isEditing: controlledIsEditing,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  editedContent: controlledEditedContent,
  onEditedContentChange,
  // Image upload props
  uploadedImages = [],
  onImagesChange,
  enableImageUpload = false,
}: LinkedInPostPreviewProps) => {
  const [selectedText, setSelectedText] = useState('');
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null);
  
  // Internal state for uncontrolled mode
  const [internalIsEditing, setInternalIsEditing] = useState(false);
  const [internalEditedContent, setInternalEditedContent] = useState(postContent);
  
  // Use controlled or uncontrolled state
  const isControlled = controlledIsEditing !== undefined;
  const isEditing = isControlled ? controlledIsEditing : internalIsEditing;
  const editedContent = isControlled ? (controlledEditedContent ?? postContent) : internalEditedContent;
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Handle image selection
  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !onImagesChange) return;
    
    const newImages: UploadedImage[] = [];
    
    Array.from(files).forEach(file => {
      // Only accept images
      if (!file.type.startsWith('image/')) return;
      
      // Check file size (8MB limit for LinkedIn)
      if (file.size > 8 * 1024 * 1024) {
        alert(`File "${file.name}" is too large. Maximum size is 8MB.`);
        return;
      }
      
      // Create preview URL
      const preview = URL.createObjectURL(file);
      newImages.push({ file, preview });
    });
    
    if (newImages.length > 0) {
      // LinkedIn allows up to 9 images per post
      const maxImages = 9;
      const currentCount = uploadedImages.length;
      const availableSlots = maxImages - currentCount;
      const imagesToAdd = newImages.slice(0, availableSlots);
      
      if (newImages.length > availableSlots) {
        alert(`You can only add up to ${maxImages} images. Adding ${imagesToAdd.length} of ${newImages.length} selected.`);
      }
      
      onImagesChange([...uploadedImages, ...imagesToAdd]);
    }
    
    // Reset input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [uploadedImages, onImagesChange]);
  
  // Remove an image
  const handleRemoveImage = useCallback((index: number) => {
    if (!onImagesChange) return;
    
    // Revoke the object URL to free memory
    const imageToRemove = uploadedImages[index];
    if (imageToRemove?.preview) {
      URL.revokeObjectURL(imageToRemove.preview);
    }
    
    const newImages = uploadedImages.filter((_, i) => i !== index);
    onImagesChange(newImages);
  }, [uploadedImages, onImagesChange]);
  
  // Trigger file input click
  const handleAddImageClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);
  
  // Sync editedContent when postContent changes from external source
  useEffect(() => {
    if (!isEditing && !isControlled) {
      setInternalEditedContent(postContent);
    }
  }, [postContent, isEditing, isControlled]);
  
  // Auto-resize textarea to fit content while preserving scroll position
  const adjustTextareaHeight = useCallback(() => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      
      // Save scroll positions
      const scrollContainer = textarea.closest('.overflow-y-auto') as HTMLElement;
      const savedScrollTop = scrollContainer?.scrollTop ?? 0;
      const savedTextareaScrollTop = textarea.scrollTop;
      
      // Temporarily set height to auto to measure content
      textarea.style.height = 'auto';
      const newHeight = textarea.scrollHeight;
      textarea.style.height = `${newHeight}px`;
      
      // Restore scroll positions
      if (scrollContainer) {
        scrollContainer.scrollTop = savedScrollTop;
      }
      textarea.scrollTop = savedTextareaScrollTop;
    }
  }, []);
  
  // Start editing mode
  const handleStartEdit = useCallback(() => {
    if (isControlled && onStartEdit) {
      onStartEdit();
    } else {
      setInternalIsEditing(true);
      setInternalEditedContent(postContent);
    }
    // Focus textarea after render
    setTimeout(() => {
      textareaRef.current?.focus();
      adjustTextareaHeight();
    }, 0);
  }, [postContent, adjustTextareaHeight, isControlled, onStartEdit]);
  
  // Cancel editing
  const handleCancelEdit = useCallback(() => {
    if (isControlled && onCancelEdit) {
      onCancelEdit();
    } else {
      setInternalIsEditing(false);
      setInternalEditedContent(postContent);
    }
  }, [postContent, isControlled, onCancelEdit]);
  
  // Save edited content
  const handleSaveEdit = useCallback(() => {
    if (isControlled && onSaveEdit) {
      onSaveEdit();
    } else {
      if (onContentChange && editedContent !== postContent) {
        onContentChange(editedContent);
      }
      setInternalIsEditing(false);
    }
  }, [onContentChange, editedContent, postContent, isControlled, onSaveEdit]);
  
  // Handle textarea changes
  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isControlled && onEditedContentChange) {
      onEditedContentChange(e.target.value);
    } else {
      setInternalEditedContent(e.target.value);
    }
    adjustTextareaHeight();
  }, [adjustTextareaHeight, isControlled, onEditedContentChange]);
  
  // Handle keyboard shortcuts in edit mode
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      handleCancelEdit();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSaveEdit();
    }
  }, [handleCancelEdit, handleSaveEdit]);

  // Store the selection range info for highlighting
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null);

  const handleTextSelection = useCallback(() => {
    if (!enableInlineEdit) return;

    const selection = window.getSelection();
    const text = selection?.toString().trim();
    
    if (text && text.length > 0) {
      // Get selection position
      const range = selection?.getRangeAt(0);
      const rect = range?.getBoundingClientRect();
      
      if (rect && postContent) {
        // Find the position of selected text in postContent
        const start = postContent.indexOf(text);
        if (start !== -1) {
          setSelectionRange({ start, end: start + text.length });
        }
        
        setSelectedText(text);
        // Position popup below the selection
        setPopupPosition({
          x: rect.left,
          y: rect.bottom + window.scrollY + 8
        });
        
        // Clear browser selection since we'll show our own highlight
        setTimeout(() => {
          window.getSelection()?.removeAllRanges();
        }, 0);
      }
    }
  }, [enableInlineEdit, postContent]);

  const handleClosePopup = useCallback(() => {
    setSelectedText('');
    setPopupPosition(null);
    setSelectionRange(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  const handleInlineEditSubmit = useCallback((instruction: string, selectedText: string) => {
    if (onInlineEdit) {
      onInlineEdit(instruction, selectedText);
    }
    // Clear selection after submit
    handleClosePopup();
  }, [onInlineEdit, handleClosePopup]);

  return (
    <>
    <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
      {/* Post Header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Profile Avatar */}
          <div className="flex-shrink-0">
            {displayImage ? (
              <img 
                src={displayImage} 
                alt={displayName}
                className={`w-12 h-12 object-cover ${isPersonalProfile ? 'rounded-full' : 'rounded'}`}
              />
            ) : (
              <div className={`w-12 h-12 bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center ${isPersonalProfile ? 'rounded-full' : 'rounded'}`}>
                {isPersonalProfile ? (
                  <span className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                    {displayName?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                ) : (
                  <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                )}
              </div>
            )}
          </div>

          {/* Profile Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground text-sm truncate">
              {displayName}
            </h3>
            <p className="text-xs text-muted-foreground">
              {isPersonalProfile ? 'Member' : 'Company'} • Follow
            </p>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              {timestamp} • 🌎
            </p>
          </div>

          {/* Edit Button - Always visible in top right */}
          {enableDirectEdit && postContent && !isStreaming && !isEditing ? (
            <button 
              onClick={handleStartEdit}
              className="text-muted-foreground hover:text-primary hover:bg-muted rounded p-1.5 transition"
              title="Edit post content"
            >
              <Pencil className="h-4 w-4" />
            </button>
          ) : (
            <button className="text-muted-foreground hover:bg-muted rounded p-1">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>
          )}
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
            {/* Only show inline Cancel/Save buttons in uncontrolled mode */}
            {!isControlled && (
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
            )}
          </div>
        ) : (
          /* View Mode */
          <div>
            <div 
              className={`text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed ${
                enableInlineEdit ? 'select-text cursor-text' : ''
              }`}
              onMouseUp={handleTextSelection}
            >
              {postContent ? (
                <>
                  {selectionRange ? (
                    // Render with highlight
                    <>
                      {postContent.slice(0, selectionRange.start)}
                      <mark className="bg-primary/30 text-foreground rounded px-0.5">{postContent.slice(selectionRange.start, selectionRange.end)}</mark>
                      {postContent.slice(selectionRange.end)}
                    </>
                  ) : (
                    postContent
                  )}
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

      {/* Image Upload Section */}
      {enableImageUpload && (
        <>
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageSelect}
            className="hidden"
          />
          
          {/* Image previews */}
          {uploadedImages.length > 0 && (
            <div className="px-4 pb-3">
              <div className={`grid gap-2 ${
                uploadedImages.length === 1 ? 'grid-cols-1' : 
                uploadedImages.length === 2 ? 'grid-cols-2' :
                uploadedImages.length === 3 ? 'grid-cols-3' :
                'grid-cols-2'
              }`}>
                {uploadedImages.map((image, index) => (
                  <div 
                    key={index}
                    className="relative group rounded-lg overflow-hidden bg-muted aspect-square"
                  >
                    <img
                      src={image.preview}
                      alt={`Upload ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {/* Remove button */}
                    <button
                      onClick={() => handleRemoveImage(index)}
                      className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition"
                      title="Remove image"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                    {/* Upload status */}
                    {image.isUploading && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 text-white animate-spin" />
                      </div>
                    )}
                    {image.error && (
                      <div className="absolute bottom-0 left-0 right-0 bg-red-500/90 text-white text-xs p-1 text-center">
                        {image.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add image button */}
          {uploadedImages.length < 9 && postContent && !isStreaming && (
            <div className="px-4 pb-3">
              <button
                onClick={handleAddImageClick}
                className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg border border-dashed border-border transition w-full justify-center"
              >
                <ImagePlus className="h-4 w-4" />
                <span>{uploadedImages.length === 0 ? 'Add photo' : `Add more photos (${uploadedImages.length}/9)`}</span>
              </button>
            </div>
          )}
        </>
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
