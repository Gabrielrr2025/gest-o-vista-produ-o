import React from 'react';
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { motion } from "framer-motion";

export default function KPICard({ title, value, subtitle, icon: Icon, trend, trendValue, color = "blue" }) {
  const colorMap = {
    blue: "from-blue-500 to-blue-600",
    green: "from-emerald-500 to-emerald-600",
    orange: "from-orange-500 to-orange-600",
    red: "from-red-500 to-red-600",
    purple: "from-purple-500 to-purple-600",
    cyan: "from-cyan-500 to-cyan-600"
  };

  const iconBgMap = {
    blue: "bg-blue-100 text-blue-600",
    green: "bg-emerald-100 text-emerald-600",
    orange: "bg-orange-100 text-orange-600",
    red: "bg-red-100 text-red-600",
    purple: "bg-purple-100 text-purple-600",
    cyan: "bg-cyan-100 text-cyan-600"
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="relative overflow-hidden p-5 bg-white border-0 shadow-sm hover:shadow-md transition-shadow">
        <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${colorMap[color]} opacity-5 rounded-full -translate-y-10 translate-x-10`} />
        
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
          </div>
          
          {Icon && (
            <div className={`p-2.5 rounded-xl ${iconBgMap[color]}`}>
              <Icon className="w-5 h-5" />
            </div>
          )}
        </div>

        {trendValue !== undefined && (
          <div className="flex items-center gap-1 mt-3">
            {trend === "up" && <TrendingUp className="w-4 h-4 text-emerald-500" />}
            {trend === "down" && <TrendingDown className="w-4 h-4 text-red-500" />}
            {trend === "neutral" && <Minus className="w-4 h-4 text-slate-400" />}
            <span className={`text-xs font-medium ${
              trend === "up" ? "text-emerald-600" : 
              trend === "down" ? "text-red-600" : "text-slate-500"
            }`}>
              {trendValue}
            </span>
          </div>
        )}
      </Card>
    </motion.div>
  );
}