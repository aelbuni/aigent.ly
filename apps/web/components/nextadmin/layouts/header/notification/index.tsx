"use client";

import {
  Dropdown,
  DropdownContent,
  DropdownTrigger,
} from "@/components/nextadmin/ui/dropdown";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState } from "react";
import { BellIcon } from "./icons";

export function Notification() {
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useIsMobile();

  return (
    <Dropdown isOpen={isOpen} setIsOpen={setIsOpen}>
      <DropdownTrigger
        className="grid size-12 cursor-pointer place-items-center rounded-full border bg-gray-2 text-dark outline-none hover:text-primary focus-visible:border-primary focus-visible:text-primary dark:border-dark-4 dark:bg-dark-2 dark:text-white dark:hover:bg-dark-3 dark:focus-visible:border-primary"
        aria-label="View Notifications"
      >
        <BellIcon />
      </DropdownTrigger>

      <DropdownContent
        align={isMobile ? "end" : "center"}
        className="border border-stroke bg-white px-3.5 py-3 shadow-md min-[350px]:min-w-[20rem] dark:border-dark-3 dark:bg-gray-dark"
      >
        <div className="mb-1 flex items-center justify-between px-2 py-1.5">
          <span className="text-lg font-medium text-dark dark:text-white">
            Notifications
          </span>
        </div>
        <div className="px-2 py-6 text-center text-sm text-gray-500 dark:text-dark-6">
          No notifications yet.
        </div>
      </DropdownContent>
    </Dropdown>
  );
}
