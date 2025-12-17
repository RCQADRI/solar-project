import * as React from "react";

export function CreditFooter({ className }: { className?: string }) {
  return (
    <div
      className={
        "text-center text-xs text-muted-foreground animate-in fade-in-0 slide-in-from-bottom-1 duration-700 motion-reduce:animate-none " +
        (className ?? "")
      }
    >
      <div>
        Built by <span className="font-medium text-foreground">SQS</span>
      </div>
      <div>
        <span className="font-medium text-foreground">Smart Solar Monitoring</span>
      </div>
    </div>
  );
}
