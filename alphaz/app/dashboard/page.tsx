import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Users, TrendingUp, DollarSign, PenTool } from "lucide-react";
import Link from "next/link";

export default function Dashboard() {
  return (
    <AppLayout>
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-background">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Overview of your LinkedIn performance
            </p>
          </div>
          <Link href="/create">
            <Button className="flex items-center gap-2">
              <PenTool className="h-4 w-4" />
              Create new post
            </Button>
          </Link>
        </div>
        
        <main className="flex-1 overflow-auto p-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Reach
                </CardTitle>
                <BarChart3 className="h-5 w-5 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">125.8K</div>
                <div className="text-xs text-green-600 flex items-center gap-1 mt-1">
                  <span className="↗"></span>
                  +15.2% from last month
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  New Followers
                </CardTitle>
                <Users className="h-5 w-5 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">2,847</div>
                <div className="text-xs text-green-600 flex items-center gap-1 mt-1">
                  <span className="↗"></span>
                  +22.1% from last month
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Engagement
                </CardTitle>
                <TrendingUp className="h-5 w-5 text-pink-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">8.5%</div>
                <div className="text-xs text-red-600 flex items-center gap-1 mt-1">
                  <span className="↘"></span>
                  -1.2% from last month
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Revenue Impact
                </CardTitle>
                <DollarSign className="h-5 w-5 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">$12.5K</div>
                <div className="text-xs text-green-600 flex items-center gap-1 mt-1">
                  <span className="↗"></span>
                  +8.7% from last month
                </div>
              </CardContent>
            </Card>
          </div>
          

          {/* Placeholder for more dashboard content */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Activity feed will be displayed here...</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Top Performing Posts</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Top posts analytics will be shown here...</p>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </AppLayout>
  );
}