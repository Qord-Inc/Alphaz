'use client';

import { useState, memo, useCallback } from 'react';
import { LinkedInPostPreview } from './linkedin-post-preview';
import { ChevronLeft, ChevronRight, FileText, Trash2, Copy, Download, Check } from 'lucide-react';

export interface Draft {
  id: string;
  content: string;
  timestamp: Date;
  title?: string;
}

interface DraftPanelProps {
  drafts: Draft[];
  organizationName: string;
  organizationImage?: string;
  isCollapsed: boolean;
  onToggle: () => void;
  onDeleteDraft: (id: string) => void;
  onCopyDraft: (content: string) => void;
}

export const DraftPanel = memo(({ 
  drafts, 
  organizationName, 
  organizationImage,
  isCollapsed,
  onToggle,
  onDeleteDraft,
  onCopyDraft,
}: DraftPanelProps) => {
  const [selectedDraftIndex, setSelectedDraftIndex] = useState(drafts.length - 1);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const selectedDraft = drafts[selectedDraftIndex];
  const hasDrafts = drafts.length > 0;

  const handleCopy = useCallback((draft: Draft) => {
    onCopyDraft(draft.content);
    setCopiedId(draft.id);
    setTimeout(() => setCopiedId(null), 2000);
  }, [onCopyDraft]);

  const handleDownload = useCallback((draft: Draft) => {
    const blob = new Blob([draft.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `linkedin-draft-${new Date(draft.timestamp).toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  if (!hasDrafts) return null;

  return (
    <div 
      className={`
        relative transition-all duration-300 ease-in-out border-r border-border bg-muted/30
        ${isCollapsed ? 'w-12' : 'w-[600px]'}
      `}
    >
      {/* Collapse/Expand Button */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-6 z-20 w-6 h-6 bg-card border border-border rounded-full shadow-sm hover:shadow-md transition-all flex items-center justify-center text-muted-foreground hover:text-foreground"
        title={isCollapsed ? 'Expand drafts' : 'Collapse drafts'}
      >
        {isCollapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
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
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <h3 className="font-semibold text-foreground">Draft Posts</h3>
                <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium">
                  {drafts.length}
                </span>
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
            {selectedDraft && (
              <div className="space-y-4">
                <LinkedInPostPreview
                  organizationName={organizationName}
                  organizationImage={organizationImage}
                  postContent={selectedDraft.content}
                  timestamp={new Date(selectedDraft.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
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
        </div>
      )}
    </div>
  );
});

DraftPanel.displayName = 'DraftPanel';
