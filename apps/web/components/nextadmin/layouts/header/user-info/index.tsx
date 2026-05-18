"use client";

import { ChevronUpIcon } from "@/components/nextadmin/assets/icons";
import {
  Dropdown,
  DropdownContent,
  DropdownTrigger,
} from "@/components/nextadmin/ui/dropdown";
import { cn } from "@/lib/utils";
import { signOut, useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { LogOutIcon, UserIcon } from "./icons";

function UserAvatarImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      width={48}
      height={48}
      className={cn("size-12 overflow-hidden rounded-full object-cover", className)}
    />
  );
}

export function UserInfo() {
  const [isOpen, setIsOpen] = useState(false);
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex items-center gap-3" role="presentation">
        <span className="inline-block size-12 animate-pulse rounded-full bg-gray-200" />
      </div>
    );
  }

  const user = session?.user;

  return (
    <Dropdown isOpen={isOpen} setIsOpen={setIsOpen}>
      <DropdownTrigger className="cursor-pointer rounded align-middle ring-primary ring-offset-2 outline-none focus-visible:ring-1 dark:ring-offset-gray-dark">
        <span className="sr-only">My Account</span>
        <figure className="flex items-center gap-3">
          {user?.image ? (
            <UserAvatarImage
              src={user.image}
              alt={`Avatar of ${user.name ?? "Admin"}`}
            />
          ) : (
            <UserAvatarPlaceholder />
          )}
          <figcaption className="flex items-center gap-1 font-medium text-dark max-[1024px]:sr-only dark:text-dark-6">
            <span className="max-w-24 truncate">{user?.name ?? "Admin"}</span>
            <ChevronUpIcon
              aria-hidden
              className={cn("rotate-180 transition-transform", isOpen && "rotate-0")}
              strokeWidth={1.5}
            />
          </figcaption>
        </figure>
      </DropdownTrigger>

      <DropdownContent
        className="border-stroke dark:border-stroke-dark dark:bg-gray-dark min-[230px]:min-w-70 border bg-white shadow-md"
        align="end"
      >
        <figure className="flex items-center gap-2.5 px-5 py-3.5">
          {user?.image ? (
            <UserAvatarImage
              src={user.image}
              alt={`Avatar of ${user.name ?? "Admin"}`}
              className="shrink-0"
            />
          ) : (
            <UserAvatarPlaceholder />
          )}
          <figcaption className="space-y-1 text-base font-medium">
            <div className="mb-2 leading-none text-dark dark:text-white">
              {user?.name}
            </div>
            <div className="text-gray-6 w-full max-w-47.5 truncate leading-none">
              {user?.email}
            </div>
          </figcaption>
        </figure>

        <hr className="dark:border-dark-3 border-[#E8E8E8]" />

        <div className="dark:text-dark-6 p-2 text-base text-[#4B5563]">
          <Link
            href="/"
            onClick={() => setIsOpen(false)}
            className="hover:bg-gray-2 hover:text-dark dark:hover:bg-dark-3 dark:hover:text-white flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.25"
          >
            <span className="text-base font-medium">Back to site</span>
          </Link>
          <button
            type="button"
            className="hover:bg-gray-2 hover:text-dark dark:hover:bg-dark-3 dark:hover:text-white flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2.25"
            onClick={() => signOut({ callbackUrl: "/" })}
          >
            <LogOutIcon />
            <span className="text-base font-medium">Log out</span>
          </button>
        </div>
      </DropdownContent>
    </Dropdown>
  );
}

function UserAvatarPlaceholder() {
  return (
    <span className="bg-gray-2 text-dark dark:border-dark-4 dark:bg-dark-2 flex size-12 items-center justify-center rounded-full border dark:text-white">
      <UserIcon />
    </span>
  );
}
