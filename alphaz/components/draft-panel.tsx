'use client';

import { useState, memo, useCallback, useEffect } from 'react';
import { LinkedInPostPreview } from './linkedin-post-preview';
import { ChevronLeft, ChevronRight, FileText, Trash2, Copy, Check, Loader2, Share2, X, Save } from 'lucide-react';

export interface DraftVersion {
  version: number;
  content: string;
  timestamp: Date;
  changes?: string[];
  editPrompt?: string;
}

export interface Draft {
  id: string;
  dbId?: string; // Database ID for persisted drafts
  content: string;
  timestamp: Date;
  title?: string;
  versions: DraftVersion[];
  currentVersion: number;
  parentMessageId?: string;
}

interface DraftPanelProps {
  drafts: Draft[];
  organizationName: string;
  organizationImage?: string;
  isCollapsed: boolean;
  selectedDraftId?: string | null;
  selectedVersion?: number | null;
  /** Currently streaming draft content (when AI is generating) */
  streamingContent?: string | null;
  /** Intent of the streaming content */
  streamingIntent?: 'draft' | 'edit' | null;
  /** Whether AI is currently generating draft content */
  isStreaming?: boolean;
  onToggle: () => void;
  onDeleteDraft: (id: string) => void;
  onCopyDraft: (content: string) => void;
  onInlineEdit?: (instruction: string, selectedText: string) => void;
  onPostDraft?: (content: string) => Promise<void> | void;
  isPosting?: boolean;
  /** Called when content is directly edited */
  onContentEdit?: (draftId: string, newContent: string, version: number) => Promise<void> | void;
  /** Whether a direct edit is being saved */
  isSavingEdit?: boolean;
}

export const DraftPanel = memo(({ 
  drafts, 
  organizationName, 
  organizationImage,
  isCollapsed,
  selectedDraftId,
  selectedVersion: externalSelectedVersion,
  streamingContent,
  streamingIntent,
  isStreaming,
  onToggle,
  onDeleteDraft,
  onCopyDraft,
  onInlineEdit,
  onPostDraft,
  isPosting,
  onContentEdit,
  isSavingEdit,
}: DraftPanelProps) => {
  const [selectedDraftIndex, setSelectedDraftIndex] = useState(drafts.length - 1);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null); // null means current version
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Direct edit state
  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [editedDraftContent, setEditedDraftContent] = useState('');
  
  // Auto-select draft when selectedDraftId changes
  useEffect(() => {
    if (selectedDraftId) {
      const index = drafts.findIndex(d => d.id === selectedDraftId);
      if (index !== -1) {
        setSelectedDraftIndex(index);
        // Set the version from external prop, or null for current version
        setSelectedVersion(externalSelectedVersion ?? null);
      }
    }
  }, [selectedDraftId, externalSelectedVersion, drafts]);
  
  // Reset editing state when draft changes
  useEffect(() => {
    setIsEditingDraft(false);
    setEditedDraftContent('');
  }, [selectedDraftIndex]);

  const selectedDraft = drafts[selectedDraftIndex];
  const hasDrafts = drafts.length > 0;
  
  // Get the content to display:
  // 1. If streaming, show streaming content
  // 2. Otherwise show selected version or current draft content
  const displayContent = isStreaming && streamingContent
    ? streamingContent
    : (selectedDraft && selectedVersion !== null && selectedVersion !== selectedDraft.currentVersion
      ? selectedDraft.versions.find(v => v.version === selectedVersion)?.content || selectedDraft.content
      : selectedDraft?.content);
    
  // Has multiple versions?
  const hasVersions = selectedDraft && selectedDraft.versions.length > 1;

  const handleCopyContent = useCallback(() => {
    if (!displayContent) return;
    onCopyDraft(displayContent);
    if (selectedDraft?.id) {
      setCopiedId(selectedDraft.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }, [displayContent, onCopyDraft, selectedDraft]);
  
  // Start editing mode
  const handleStartEdit = useCallback(() => {
    setIsEditingDraft(true);
    setEditedDraftContent(displayContent || selectedDraft?.content || '');
  }, [displayContent, selectedDraft]);
  
  // Cancel editing mode
  const handleCancelEdit = useCallback(() => {
    setIsEditingDraft(false);
    setEditedDraftContent('');
  }, []);
  
  // Save edited content
  const handleSaveEdit = useCallback(() => {
    if (!selectedDraft || !onContentEdit) return;
    
    // Get the current version number (the version being viewed)
    const currentVersion = selectedVersion ?? selectedDraft.currentVersion;
    
    // Call the parent handler
    onContentEdit(selectedDraft.id, editedDraftContent, currentVersion);
    
    // Reset editing state (will be called after save completes)
    setIsEditingDraft(false);
  }, [selectedDraft, selectedVersion, onContentEdit, editedDraftContent]);
  
  // Handle edited content change
  const handleEditedContentChange = useCallback((content: string) => {
    setEditedDraftContent(content);
  }, []);
  
  // Handle direct content edit (legacy, for uncontrolled mode)
  const handleContentEdit = useCallback((newContent: string) => {
    if (!selectedDraft || !onContentEdit) return;
    
    // Get the current version number (the version being viewed)
    const currentVersion = selectedVersion ?? selectedDraft.currentVersion;
    
    // Call the parent handler
    onContentEdit(selectedDraft.id, newContent, currentVersion);
  }, [selectedDraft, selectedVersion, onContentEdit]);

  // Show panel if we have drafts OR if streaming content
  if (!hasDrafts && !isStreaming) return null;

  return (
    <div 
      className={`
        relative transition-all duration-300 ease-in-out border-l border-border bg-muted/30
        ${isCollapsed ? 'w-12' : 'w-[600px]'}
      `}
    >
      {/* Collapse/Expand Button */}
      <button
        onClick={onToggle}
        className="absolute -left-3 top-6 z-20 w-6 h-6 bg-card border border-border rounded-full shadow-sm hover:shadow-md transition-all flex items-center justify-center text-muted-foreground hover:text-foreground"
        title={isCollapsed ? 'Expand drafts' : 'Collapse drafts'}
      >
        {isCollapsed ? (
          <ChevronLeft className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
      </button>

      {/* Collapsed State - Vertical Tab */}
      {isCollapsed && (
        <div className="h-full flex flex-col items-center pt-20 gap-4">
          <button
            onClick={onToggle}
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition px-2 py-4 hover:bg-muted rounded"
            style={{ writingMode: 'vertical-rl' }}
          >
            Drafts ({drafts.length})
          </button>
          <div className="flex flex-col gap-2 items-center">
            {drafts.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === selectedDraftIndex ? 'bg-blue-600 dark:bg-blue-400' : 'bg-muted-foreground/30'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Expanded State - Full Panel */}
      {!isCollapsed && (
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-border bg-card">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  {isStreaming ? (
                    <Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin" />
                  ) : (
                    <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  )}
                  <h3 className="font-semibold text-foreground">
                    {isStreaming 
                      ? (streamingIntent === 'edit' ? 'Updating Draft...' : 'Creating Draft...') 
                      : 'Post Preview'
                    }
                  </h3>
                  {!isStreaming && (
                    <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium">
                      {drafts.length}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground ml-7">
                  {isStreaming
                    ? 'AI is generating your content in real-time...'
                    : 'See how your post will appear on LinkedIn'
                  }
                </p>
              </div>
            </div>

            {/* Draft Selector - Thumbnails */}
            {drafts.length > 1 && (
              <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
                {drafts.map((draft, index) => (
                  <button
                    key={draft.id}
                    onClick={() => setSelectedDraftIndex(index)}
                    className={`
                      flex-shrink-0 px-3 py-2 rounded-lg border-2 transition-all text-left
                      ${selectedDraftIndex === index 
                        ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20' 
                        : 'border-border bg-card hover:border-muted-foreground/30'
                      }
                    `}
                  >
                    <div className="text-xs font-medium text-gray-900">
                      Draft {drafts.length - index}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(draft.timestamp).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Draft Preview */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Streaming Content View (when AI is generating) */}
            {isStreaming && streamingContent && (
              <div className="space-y-4">
                <LinkedInPostPreview
                  organizationName={organizationName}
                  organizationImage={organizationImage}
                  postContent={streamingContent}
                  timestamp="Just now"
                  enableInlineEdit={false}
                  isStreaming={true}
                />
              </div>
            )}
            
            {/* Normal Draft View (when not streaming) */}
            {!isStreaming && selectedDraft && (
              <div className="space-y-4">
                {/* Version Selector - Only show if draft has multiple versions */}
                {hasVersions && (
                  <div className="bg-card border border-border rounded-lg p-3">
                    <div className="text-xs font-medium text-muted-foreground mb-2">
                      Version History ({selectedDraft.versions.length} versions)
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedDraft.versions.map((version) => {
                        const isSelected = selectedVersion === version.version || 
                                         (selectedVersion === null && version.version === selectedDraft.currentVersion);
                        return (
                          <button
                            key={version.version}
                            onClick={() => setSelectedVersion(version.version)}
                            className={`
                              px-3 py-1.5 rounded-md text-xs font-medium transition-all
                              ${isSelected
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground hover:bg-muted-foreground/10'
                              }
                            `}
                            title={version.editPrompt || `Version ${version.version}`}
                          >
                            v{version.version}
                            {version.version === selectedDraft.currentVersion && (
                              <span className="ml-1 text-xs opacity-75">(current)</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {/* Show changes for selected version (or current version if none selected) */}
                    {(() => {
                      const versionToShow = selectedVersion ?? selectedDraft.currentVersion;
                      const versionData = selectedDraft.versions.find(v => v.version === versionToShow);
                      const changes = versionData?.changes;
                      
                      if (!changes || changes.length === 0) return null;
                      
                      return (
                        <div className="mt-3 pt-3 border-t border-border">
                          <div className="text-xs font-medium text-muted-foreground mb-1">Changes made:</div>
                          <ul className="text-xs text-foreground space-y-1">
                            {changes.map((change, i) => (
                              <li key={i} className="flex items-start gap-1">
                                <span className="text-primary mt-0.5">•</span>
                                <span>{change}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })()}
                  </div>
                )}
                
                <LinkedInPostPreview
                  organizationName={organizationName}
                  organizationImage={organizationImage}
                  postContent={displayContent || selectedDraft.content}
                  timestamp={new Date(selectedDraft.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  enableInlineEdit={!isEditingDraft}
                  onInlineEdit={onInlineEdit}
                  enableDirectEdit={true}
                  onContentChange={handleContentEdit}
                  isSaving={isSavingEdit}
                  // Controlled editing mode
                  isEditing={isEditingDraft}
                  editedContent={editedDraftContent}
                  onStartEdit={handleStartEdit}
                  onCancelEdit={handleCancelEdit}
                  onSaveEdit={handleSaveEdit}
                  onEditedContentChange={handleEditedContentChange}
                />

                {/* Draft Actions */}
                {/* <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Draft Actions</h4>
                  <div className="space-y-2">
                    <button
                      onClick={() => handleCopy(selectedDraft)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium text-sm"
                    >
                      {copiedId === selectedDraft.id ? (
                        <>
                          <Check className="h-4 w-4" />
                          Copied to Clipboard!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copy Post Content
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleDownload(selectedDraft)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-lg transition font-medium text-sm"
                    >
                      <Download className="h-4 w-4" />
                      Download as Text
                    </button>

                    <button
                      onClick={() => onDeleteDraft(selectedDraft.id)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-lg transition font-medium text-sm"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete Draft
                    </button>
                  </div>
                </div> */}

                {/* Draft Stats */}
                {/* <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Draft Info</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Characters:</span>
                      <span className="font-medium text-gray-900">
                        {selectedDraft.content.length} / 3,000
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Words:</span>
                      <span className="font-medium text-gray-900">
                        {selectedDraft.content.split(/\s+/).filter(Boolean).length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Lines:</span>
                      <span className="font-medium text-gray-900">
                        {selectedDraft.content.split('\n').length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Hashtags:</span>
                      <span className="font-medium text-gray-900">
                        {(selectedDraft.content.match(/#\w+/g) || []).length}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600">LinkedIn Character Limit</span>
                      <span className={`font-medium ${
                        selectedDraft.content.length > 3000 ? 'text-red-600' : 'text-gray-900'
                      }`}>
                        {((selectedDraft.content.length / 3000) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full transition-all rounded-full ${
                          selectedDraft.content.length > 3000
                            ? 'bg-red-500'
                            : selectedDraft.content.length > 2700
                            ? 'bg-yellow-500'
                            : 'bg-blue-600'
                        }`}
                        style={{ width: `${Math.min((selectedDraft.content.length / 3000) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </div> */}
              </div>
            )}
          </div>

          {/* Sticky action bar */}
          {!isCollapsed && (
            <div className="sticky bottom-0 left-0 right-0 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:backdrop-blur px-6 py-4">
              <div className="flex items-center justify-end gap-3">
                {/* Show Cancel/Save when editing, otherwise show Copy/Publish */}
                {isEditingDraft ? (
                  <>
                    <button
                      onClick={handleCancelEdit}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors bg-card hover:bg-muted border-border text-foreground"
                    >
                      <X className="h-4 w-4" />
                      Cancel
                    </button>

                    <button
                      onClick={handleSaveEdit}
                      disabled={isSavingEdit || editedDraftContent === (displayContent || selectedDraft?.content)}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm ${
                        isSavingEdit || editedDraftContent === (displayContent || selectedDraft?.content)
                          ? 'bg-muted text-muted-foreground cursor-not-allowed'
                          : 'bg-primary text-primary-foreground hover:bg-primary/90'
                      }`}
                    >
                      {isSavingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {isSavingEdit ? 'Saving...' : 'Save'}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleCopyContent}
                      disabled={!displayContent}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        displayContent
                          ? 'bg-card hover:bg-muted border-border text-foreground'
                          : 'bg-muted text-muted-foreground cursor-not-allowed border-border'
                      }`}
                    >
                      {copiedId === selectedDraft?.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copiedId === selectedDraft?.id ? 'Copied' : 'Copy'}
                    </button>

                    <button
                      onClick={() => displayContent && onPostDraft && onPostDraft(displayContent)}
                      disabled={!displayContent || !onPostDraft || isStreaming || isPosting}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm ${
                        !displayContent || !onPostDraft || isStreaming || isPosting
                          ? 'bg-muted text-muted-foreground cursor-not-allowed'
                          : 'bg-primary text-primary-foreground hover:bg-primary/90'
                      }`}
                    >
                      {isPosting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
                      {isPosting ? 'Publishing...' : 'Publish'}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

DraftPanel.displayName = 'DraftPanel';
