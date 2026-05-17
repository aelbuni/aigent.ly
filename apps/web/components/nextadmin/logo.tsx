import Image from "next/image";
import Link from "next/link";

export function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <Link href="/admin" onClick={onClick} className="relative flex h-8 items-center gap-2 px-0 py-2.5 min-[850px]:py-0">
      <Image
        src="/images/logo/logo-icon.svg"
        width={32}
        height={32}
        alt=""
        className="size-8"
      />
      <span className="text-lg font-bold text-dark dark:text-white">Aigent.ly</span>
    </Link>
  );
}
