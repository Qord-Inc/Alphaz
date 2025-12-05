import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface ChartCardProps {
  title: string
  children: React.ReactNode
}

export function ChartCard({ title, children }: ChartCardProps) {
  return (
    <Card className="col-span-1">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
    </Card>
  )
}

// Simple chart components for demonstration
export function LineChart({ data }: { data: number[] }) {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 350
    const y = 120 - ((value - min) / (max - min)) * 80
    return `${x},${y}`
  }).join(' ')

  const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6']

  return (
    <div className="w-full h-40 relative">
      {/* Y-axis labels */}
      <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-muted-foreground py-2">
        <span>4000</span>
        <span>3000</span>
        <span>2000</span>
        <span>1000</span>
        <span>0</span>
      </div>
      
      <div className="ml-8">
        <svg className="w-full h-32" viewBox="0 0 350 120">
          {/* Grid lines */}
          {[0, 1, 2, 3, 4].map((i) => (
            <line
              key={i}
              x1="0"
              y1={20 + i * 20}
              x2="350"
              y2={20 + i * 20}
              stroke="#f1f5f9"
              strokeWidth="1"
            />
          ))}
          
          <polyline
            points={points}
            fill="none"
            stroke="#ff6b35"
            strokeWidth="3"
          />
          {data.map((value, index) => {
            const x = (index / (data.length - 1)) * 350
            const y = 120 - ((value - min) / (max - min)) * 80
            return (
              <circle
                key={index}
                cx={x}
                cy={y}
                r="4"
                fill="#ff6b35"
              />
            )
          })}
        </svg>
        
        {/* X-axis labels */}
        <div className="flex justify-between text-xs text-muted-foreground mt-2">
          {weeks.map((week) => (
            <span key={week}>{week}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

export function BarChart({ data }: { data: { likes: number; comments: number; shares: number }[] }) {
  const maxValue = Math.max(...data.flatMap(d => [d.likes, d.comments, d.shares]))
  const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6']
  const barWidth = 15
  const groupWidth = 60

  return (
    <div className="w-full h-40 relative">
      {/* Y-axis labels */}
      <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-muted-foreground py-2">
        <span>800</span>
        <span>600</span>
        <span>400</span>
        <span>200</span>
        <span>0</span>
      </div>
      
      <div className="ml-8">
        <svg className="w-full h-32" viewBox="0 0 380 120">
          {/* Grid lines */}
          {[0, 1, 2, 3, 4].map((i) => (
            <line
              key={i}
              x1="0"
              y1={20 + i * 20}
              x2="380"
              y2={20 + i * 20}
              stroke="#f1f5f9"
              strokeWidth="1"
            />
          ))}
          
          {data.map((item, index) => {
            const x = index * groupWidth + 20
            
            // Likes bar (orange)
            const likesHeight = (item.likes / maxValue) * 80
            
            // Comments bar (purple)
            const commentsHeight = (item.comments / maxValue) * 80
            
            // Shares bar (blue)
            const sharesHeight = (item.shares / maxValue) * 80
            
            return (
              <g key={index}>
                <rect
                  x={x}
                  y={100 - likesHeight}
                  width={barWidth}
                  height={likesHeight}
                  fill="#ff6b35"
                  rx="2"
                />
                <rect
                  x={x + barWidth + 2}
                  y={100 - commentsHeight}
                  width={barWidth}
                  height={commentsHeight}
                  fill="#8b5cf6"
                  rx="2"
                />
                <rect
                  x={x + (barWidth + 2) * 2}
                  y={100 - sharesHeight}
                  width={barWidth}
                  height={sharesHeight}
                  fill="#3b82f6"
                  rx="2"
                />
              </g>
            )
          })}
        </svg>
        
        {/* X-axis labels */}
        <div className="flex justify-between text-xs text-muted-foreground mt-2 px-6">
          {weeks.map((week) => (
            <span key={week}>{week}</span>
          ))}
        </div>
        
        {/* Legend */}
        <div className="flex justify-center gap-6 mt-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-purple-500 rounded"></div>
            <span className="text-purple-500">comments</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-orange-500 rounded"></div>
            <span className="text-orange-500">likes</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span className="text-blue-500">shares</span>
          </div>
        </div>
      </div>
    </div>
  )
}