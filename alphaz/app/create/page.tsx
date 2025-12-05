import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Paperclip, Mic, BarChart3, Send, MoreHorizontal } from "lucide-react";

export default function Create() {
  return (
    <AppLayout>
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-end p-6">
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        </div>
        
        <main className="flex-1 flex flex-col items-center justify-center px-6 pb-32">
          {/* Main Heading */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-semibold text-gray-800 mb-2">
              What are you writing today?
            </h1>
          </div>
          
          {/* Post Input Area */}
          <div className="w-full max-w-4xl">
            <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow border border-gray-200 p-6">
              <Textarea
                placeholder="Describe your LinkedIn post idea..."
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
                
                <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white rounded-full px-4">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </AppLayout>
  );
}