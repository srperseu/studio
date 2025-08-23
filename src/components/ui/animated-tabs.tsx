// src/components/ui/animated-tabs.tsx

"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    onValueChange(value);
  };

  return (
    <Tabs
      defaultValue={defaultValue}
      onValueChange={handleTabChange}
      className={cn("relative", className)}
    >
      <TabsList className={cn("relative bg-muted p-1 h-10 grid", `grid-cols-${tabs.length}`)}>
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
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
        {/* O elemento que faz a mágica da animação */}
        <AnimatePresence>
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
        </AnimatePresence>
      </TabsList>
    </Tabs>
  );
}

    