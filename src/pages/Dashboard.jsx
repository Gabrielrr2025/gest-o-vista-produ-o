import React from 'react';
import { createPageUrl } from "@/utils";

// Dashboard redirect to Products
export default function Dashboard() {
  React.useEffect(() => {
    window.location.replace(createPageUrl("Products"));
  }, []);

  return (
    <div className="flex items-center justify-center h-64">
      <p className="text-slate-500">Redirecionando...</p>
    </div>
  );
}