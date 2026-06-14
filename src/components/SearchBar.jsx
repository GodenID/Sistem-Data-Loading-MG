import { Search, X } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';

const SearchBar = ({ value, onChange, placeholder = "Cari nama perusahaan..." }) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);

  const handleClear = () => {
    onChange('');
    inputRef.current?.focus();
  };

  return (
    <div className={`relative w-full transition-all duration-300 ${isFocused ? 'scale-[1.02]' : ''}`}>
      <div 
        className={`
          relative flex items-center w-full bg-white rounded-2xl shadow-lg
          transition-all duration-300 border-2 overflow-hidden
          ${isFocused 
            ? 'border-garden shadow-garden/20 ring-4 ring-garden/10' 
            : 'border-transparent hover:border-gray-200'
          }
        `}
      >
        <div className="flex items-center justify-center pl-4 pr-3">
          <Search 
            className={`w-6 h-6 transition-colors duration-300 ${
              isFocused ? 'text-garden' : 'text-gray-400'
            }`} 
          />
        </div>
        
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className="
            w-full py-4 pr-4 text-lg bg-transparent outline-none
            placeholder:text-gray-400 text-gray-800
            font-medium
          "
          autoComplete="off"
          autoCapitalize="off"
        />
        
        {value && (
          <button
            onClick={handleClear}
            className="
              flex items-center justify-center p-2 mr-3
              rounded-full bg-gray-100 hover:bg-gray-200
              transition-all duration-200 active:scale-95
            "
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        )}
      </div>
    </div>
  );
};

export default SearchBar;
