'use client';

export default function MCPenetesPage() {
  return (
    <div className="h-full w-full flex flex-col">
      <iframe 
        src="http://localhost:3002" 
        className="w-full h-full border-none"
        title="MCPenetes"
      />
    </div>
  );
}
