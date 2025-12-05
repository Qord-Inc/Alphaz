import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Target, TrendingUp, Clock, Plus, BarChart3 } from "lucide-react";

export default function Plan() {
  return (
    <AppLayout>
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-background">
          <div>
            <h1 className="text-3xl font-bold">Plan</h1>
            <p className="text-muted-foreground mt-1">
              Plan your content strategy and set goals
            </p>
          </div>
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New Goal
          </Button>
        </div>
        
        <main className="flex-1 overflow-auto p-6">
          {/* Goals Overview */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Current Goals</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Follower Growth
                  </CardTitle>
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">5,000</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Target: +1,158 more
                  </div>
                  <div className="mt-2 bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full" style={{width: '76.8%'}}></div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">76.8% complete</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Engagement Rate
                  </CardTitle>
                  <Target className="h-5 w-5 text-purple-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">8%</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Target: 2.2% more
                  </div>
                  <div className="mt-2 bg-gray-200 rounded-full h-2">
                    <div className="bg-purple-500 h-2 rounded-full" style={{width: '72.5%'}}></div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">72.5% complete</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Posts per Week
                  </CardTitle>
                  <Clock className="h-5 w-5 text-pink-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">5</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Target: 2 more
                  </div>
                  <div className="mt-2 bg-gray-200 rounded-full h-2">
                    <div className="bg-pink-500 h-2 rounded-full" style={{width: '60%'}}></div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">60% complete</div>
                </CardContent>
              </Card>
            </div>
          </div>
          
          {/* Content Calendar */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Content Calendar</h2>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  December 2025
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-2 text-center">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="font-semibold text-sm text-muted-foreground p-2">
                      {day}
                    </div>
                  ))}
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                    <div key={day} className="p-2 border rounded hover:bg-gray-50 cursor-pointer">
                      <div className="text-sm">{day}</div>
                      {day === 24 && <div className="w-2 h-2 bg-blue-500 rounded-full mx-auto mt-1"></div>}
                      {day === 26 && <div className="w-2 h-2 bg-purple-500 rounded-full mx-auto mt-1"></div>}
                      {day === 28 && <div className="w-2 h-2 bg-pink-500 rounded-full mx-auto mt-1"></div>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Analytics Insights */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Strategy Insights</h2>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                    <p className="text-sm">Post more video content - videos get 3x more engagement</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
                    <p className="text-sm">Optimal posting time: Tuesday-Thursday, 9-11 AM</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-pink-500 rounded-full mt-2"></div>
                    <p className="text-sm">Use more industry hashtags to reach target audience</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </AppLayout>
  );
}