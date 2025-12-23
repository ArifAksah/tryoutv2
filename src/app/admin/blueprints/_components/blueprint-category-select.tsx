"use client";

import { useState } from "react";
import { SearchableSelect } from "../../categories/_components/searchable-select";

type CategoryOption = {
    id: string;
    label: string;
};

type Props = {
    options: CategoryOption[];
};

export function BlueprintCategorySelect({ options }: Props) {
    // We don't have default value in props for Create? 
    // The logic in page.tsx showed it rendered a simple select.
    // We can default to empty.
    const [value, setValue] = useState("");

    const searchableOptions = options.map((opt) => ({
        id: opt.id,
        name: opt.label, // mapped label to name
        type: null,
    }));

    return (
        <>
            <input type="hidden" name="category_id" value={value} />
            <SearchableSelect
                options={searchableOptions}
                value={value}
                onChange={setValue}
                placeholder="Cari Kategori..."
                className="w-full"
            />
        </>
    );
}
