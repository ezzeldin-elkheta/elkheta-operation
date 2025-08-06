import React from "react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Year } from "@/types/common";

interface YearDropdownProps {
  selectedYear: Year;
  onYearChange: (year: Year) => void;
}

const YearDropdown: React.FC<YearDropdownProps> = ({ selectedYear, onYearChange }) => {
  const startYear = 2023;
  const endYear = 2033;
  const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => (startYear + i).toString() as Year);

  return (
    <Select value={selectedYear} onValueChange={(value) => onYearChange(value as Year)}>
      <SelectTrigger className="w-[120px]">
        <SelectValue placeholder="Year" />
      </SelectTrigger>
      <SelectContent>
        {years.map((year) => (
          <SelectItem key={year} value={year}>
            {year}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default YearDropdown; 