"use client";

import { useState, useEffect, useRef } from "react";

type Option = {
    id: string;
    name: string;
    type?: string | null;
};

type Props = {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    emptyLabel?: string;
};

export function SearchableSelect({
    options,
    value,
    onChange,
    placeholder = "Select an option",
    className = "",
    emptyLabel,
}: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);

    // Initialize search term based on current value
    useEffect(() => {
        const selected = options.find((opt) => opt.id === value);
        if (selected) {
            setSearchTerm(selected.name);
        } else {
            setSearchTerm("");
        }
    }, [value, options]);

    // Handle clicking outside to close
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                // Reset search term to currently selected value name if closed without selection
                const selected = options.find((opt) => opt.id === value);
                setSearchTerm(selected ? selected.name : "");
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [value, options]);

    const filteredOptions = options.filter((opt) =>
        opt.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSelect = (option: Option) => {
        onChange(option.id);
        setSearchTerm(option.name);
        setIsOpen(false);
    };

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <input
                type="text"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
                placeholder={placeholder}
                value={searchTerm}
                onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setIsOpen(true);
                    // Optional: clear selection when user starts typing?
                    // For now, we keep the value until they explicitly select something else
                    // or we could clear it: if (value) onChange("");
                }}
                onFocus={() => setIsOpen(true)}
            />

            {/* Show Clear button if there is a value */}
            {value && (
                <button
                    type="button"
                    onClick={() => {
                        onChange("");
                        setSearchTerm("");
                    }}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                    </svg>
                </button>
            )}

            {isOpen && (
                <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                    {filteredOptions.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-slate-500">
                            Tidak ada opsi yang cocok.
                        </div>
                    ) : (
                        options.length > 0 && emptyLabel && (
                            <div
                                className="cursor-pointer px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 border-b border-slate-100"
                                onClick={() => {
                                    onChange("");
                                    setSearchTerm("");
                                    setIsOpen(false);
                                }}
                            >
                                {emptyLabel}
                            </div>
                        )
                    )}

                    {filteredOptions.map((opt) => (
                        <div
                            key={opt.id}
                            className={`cursor-pointer px-3 py-2 text-sm hover:bg-sky-50 ${opt.id === value ? "bg-sky-50 text-sky-700" : "text-slate-700"
                                }`}
                            onClick={() => handleSelect(opt)}
                        >
                            <div className="font-medium">{opt.name}</div>
                            {opt.type && (
                                <div className="text-xs text-slate-500 capitalize">{opt.type}</div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
