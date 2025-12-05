import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { LucideIcon } from "lucide-react"

interface MetricsCardProps {
  title: string
  value: string
  change: string
  changeType: "positive" | "negative"
  icon: LucideIcon
  iconColor: string
}

export function MetricsCard({ 
  title, 
  value, 
  change, 
  changeType, 
  icon: Icon, 
  iconColor 
}: MetricsCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className={cn("h-5 w-5", iconColor)} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <div className={cn(
          "text-xs flex items-center gap-1 mt-1",
          changeType === "positive" ? "text-green-600" : "text-red-600"
        )}>
          <span className={changeType === "positive" ? "↗" : "↘"}></span>
          {change}
        </div>
      </CardContent>
    </Card>
  )
}