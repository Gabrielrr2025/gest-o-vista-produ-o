import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from 'recharts';

export default function AssertivityChart({ value, title = "Assertividade Geral" }) {
  const data = [{ name: 'Assertividade', value: value || 0, fill: value >= 80 ? '#10b981' : value >= 60 ? '#f59e0b' : '#ef4444' }];

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-0">
        <CardTitle className="text-base font-semibold text-slate-800">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48 relative">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart 
              cx="50%" 
              cy="50%" 
              innerRadius="60%" 
              outerRadius="90%" 
              barSize={12} 
              data={data}
              startAngle={180}
              endAngle={0}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
              <RadialBar
                background={{ fill: '#f1f5f9' }}
                dataKey="value"
                cornerRadius={10}
                angleAxisId={0}
              />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center mt-4">
              <span className="text-3xl font-bold text-slate-900">{value?.toFixed(1) || 0}%</span>
              <p className="text-xs text-slate-500 mt-1">
                {value >= 80 ? "Excelente" : value >= 60 ? "Bom" : "Atenção"}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}