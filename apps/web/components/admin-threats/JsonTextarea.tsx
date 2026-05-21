"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";

interface JsonTextareaProps {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  rows?: number;
}

export function JsonTextarea({ name, defaultValue, placeholder, rows = 8 }: JsonTextareaProps) {
  const [error, setError] = useState<string | null>(null);

  const validate = (val: string) => {
    if (!val.trim()) {
      setError(null);
      return;
    }
    try {
      JSON.parse(val);
      setError(null);
    } catch {
      setError("Invalid JSON — check syntax");
    }
  };

  return (
    <div>
      <Textarea
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        onBlur={(e) => validate(e.target.value)}
        className={error ? "border-[#D34053] focus-visible:border-[#D34053] focus-visible:ring-[#D34053]/20" : ""}
        rows={rows}
      />
      {error && <p className="text-xs text-[#D34053] mt-1">{error}</p>}
    </div>
  );
}
