import { ArrowDownIcon, ArrowUpIcon } from "@/components/nextadmin/assets/icons";
import { cn } from "@/lib/utils";
import type { JSX, SVGProps } from "react";

type PropsType = {
  label: string;
  data: {
    value: number | string;
    growthRate: number;
  };
  Icon: (props: SVGProps<SVGSVGElement>) => JSX.Element;
};

export function OverviewCard({ label, data, Icon }: PropsType) {
  const isDecreasing = data.growthRate < 0;

  return (
    <div className="rounded-[10px] border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
      <Icon />

      <div className="mt-6 flex items-end justify-between">
        <dl>
          <dt className="mb-1.5 text-heading-5 font-bold text-dark dark:text-white">
            {data.value}
          </dt>

          <dd className="text-sm font-medium text-dark-6">{label}</dd>
        </dl>

        {data.growthRate !== 0 && (
          <dl
            className={cn(
              "text-sm font-medium",
              isDecreasing ? "text-[#D34053]" : "text-[#219653]",
            )}
          >
            <dt className="flex items-center gap-1.5">
              {data.growthRate}%
              {isDecreasing ? (
                <ArrowDownIcon aria-hidden />
              ) : (
                <ArrowUpIcon aria-hidden />
              )}
            </dt>

            <dd className="sr-only">
              {label} {isDecreasing ? "Decreased" : "Increased"} by{" "}
              {data.growthRate}%
            </dd>
          </dl>
        )}
      </div>
    </div>
  );
}
