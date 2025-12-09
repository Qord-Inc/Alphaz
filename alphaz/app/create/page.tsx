"use client"

import { useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useOrganization } from "@/contexts/OrganizationContext";
import { 
  Paperclip, 
  Mic, 
  BarChart3, 
  Send, 
  Menu, 
  Plus, 
  MessageSquare,
  X,
  Building2,
  User,
  Lock
} from "lucide-react";

// Mock chat threads data
const mockThreads = [
  { id: "1", title: "LinkedIn post about AI trends", date: "Today" },
  { id: "2", title: "Company announcement draft", date: "Yesterday" },
  { id: "3", title: "Product launch content", date: "Dec 5" },
  { id: "4", title: "Team hiring post", date: "Dec 3" },
];

export default function Create() {
  const [showThreadsPanel, setShowThreadsPanel] = useState(false);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const { selectedOrganization, isPersonalProfile } = useOrganization();

  // Check if user is on personal profile (not organization)
  const isBlocked = isPersonalProfile;

  return (
    <AppLayout>
      <div className="flex-1 flex overflow-hidden relative">
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              {selectedOrganization ? (
                <>
                  <Building2 className="h-5 w-5 text-blue-600" />
                  <span className="font-medium text-gray-800">{selectedOrganization.name}</span>
                </>
              ) : (
                <>
                  <User className="h-5 w-5 text-gray-500" />
                  <span className="font-medium text-gray-500">Personal Profile</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setSelectedThread(null)}
                title="New Chat"
              >
                <Plus className="h-5 w-5" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setShowThreadsPanel(!showThreadsPanel)}
                title="Chat History"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </div>
          </div>
          
          {/* Blocked State for Personal Profile */}
          {isBlocked ? (
            <main className="flex-1 flex flex-col items-center justify-center px-6">
              <div className="text-center max-w-md">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Lock className="h-8 w-8 text-gray-400" />
                </div>
                <h2 className="text-2xl font-semibold text-gray-800 mb-3">
                  Organization Required
                </h2>
                <p className="text-gray-500 mb-6">
                  To create content with AI assistance, please select an organization from the sidebar. 
                  Personal profile content creation is coming soon.
                </p>
                <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                  <Building2 className="h-4 w-4" />
                  <span>Switch to an organization in the sidebar to continue</span>
                </div>
              </div>
            </main>
          ) : (
            /* Chat Interface */
            <main className="flex-1 flex flex-col items-center justify-center px-6 pb-32">
              {/* Main Heading */}
              <div className="text-center mb-12">
                <h1 className="text-4xl font-semibold text-gray-800 mb-2">
                  What are you writing today?
                </h1>
                <p className="text-gray-500">
                  Create content for <span className="font-medium text-blue-600">{selectedOrganization?.name}</span>
                </p>
              </div>
              
              {/* Post Input Area */}
              <div className="w-full max-w-4xl">
                <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow border border-gray-200 p-6">
                  <Textarea
                    placeholder="Describe your LinkedIn post idea..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    className="min-h-[40px] border-0 text-base placeholder:text-gray-400 resize-none focus-visible:ring-0 focus-visible:ring-offset-0 p-0"
                  />
                  
                  {/* Action Bar */}
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
                    <div className="flex items-center space-x-4">
                      <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-700">
                        <Paperclip className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-700">
                        <Mic className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-700">
                        <BarChart3 className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <Button 
                      size="sm" 
                      className="bg-orange-500 hover:bg-orange-600 text-white rounded-full px-4"
                      disabled={!inputValue.trim()}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </main>
          )}
        </div>

        {/* Threads Panel (Slide-out) */}
        <div 
          className={`absolute right-0 top-0 h-full w-80 bg-white border-l border-gray-200 shadow-lg transform transition-transform duration-300 ease-in-out z-10 ${
            showThreadsPanel ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {/* Panel Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">Chat History</h3>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setSelectedThread(null)}
                title="New Chat"
                className="h-8 w-8"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setShowThreadsPanel(false)}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Threads List */}
          <div className="flex-1 overflow-y-auto p-2">
            {mockThreads.map((thread) => (
              <button
                key={thread.id}
                onClick={() => {
                  setSelectedThread(thread.id);
                  setShowThreadsPanel(false);
                }}
                className={`w-full text-left p-3 rounded-lg mb-1 hover:bg-gray-50 transition-colors ${
                  selectedThread === thread.id ? 'bg-gray-100' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <MessageSquare className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {thread.title}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {thread.date}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Panel Footer */}
          <div className="p-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center">
              {mockThreads.length} conversations
            </p>
          </div>
        </div>

        {/* Overlay when panel is open */}
        {showThreadsPanel && (
          <div 
            className="absolute inset-0 bg-black/10 z-0"
            onClick={() => setShowThreadsPanel(false)}
          />
        )}
      </div>
    </AppLayout>
  );
}