// src/components/ui/animated-tabs.tsx

"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface AnimatedTabsProps {
  tabs: {
    value: string;
    label: string;
  }[];
  defaultValue: string;
  onValueChange: (value: string) => void;
  className?: string;
  tabClassName?: string;
}

export function AnimatedTabs({
  tabs,
  defaultValue,
  onValueChange,
  className,
  tabClassName,
}: AnimatedTabsProps) {
  const [activeTab, setActiveTab] = React.useState(defaultValue);

  React.useEffect(() => {
    onValueChange(activeTab);
  }, [activeTab, onValueChange]);

  return (
      <TabsList className={cn("relative p-1 h-10 grid", `grid-cols-${tabs.length}`, className)}>
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              "relative z-10 transition-colors duration-200 ease-in-out",
              tabClassName,
              activeTab !== tab.value &&
                "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </TabsTrigger>
        ))}
        {activeTab && (
            <motion.div
              layoutId={`active-tab-indicator-barberflow-${defaultValue}`}
              className="absolute inset-0 z-0 h-full p-1"
              style={{
                width: `calc(100% / ${tabs.length})`,
                left: `calc(100% / ${tabs.length} * ${tabs.findIndex(t => t.value === activeTab)})`
              }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
            >
              <div className="bg-card h-full w-full rounded-md shadow-sm" />
            </motion.div>
        )}
      </TabsList>
  );
}
