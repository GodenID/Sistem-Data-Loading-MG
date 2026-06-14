import React from 'react'
import { Building2, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createSlug } from '../utils/slug';

const CompanyCard = ({ company, index, isActive = true, category = '' }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    // Gunakan slug dari database kalau ada, kalau tidak generate dari nama
    const slug = company.slug || createSlug(company.name);
    navigate(`/client/${slug}`);
  };

  return (
    <div
      onClick={handleClick}
      className="
        group relative bg-white rounded-2xl p-5 cursor-pointer
        border border-gray-100 shadow-sm hover:shadow-xl
        transition-all duration-300 ease-out
        hover:border-garden/30 hover:-translate-y-1
        animate-slide-up
      "
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      {/* Gradient overlay on hover */}
      <div className="
        absolute inset-0 rounded-2xl bg-gradient-to-br from-garden/5 to-transparent
        opacity-0 group-hover:opacity-100 transition-opacity duration-300
      " />
      
      <div className="relative flex items-start gap-4">
        {/* Company Logo */}
        <div className="
          flex-shrink-0 w-14 h-14 rounded-xl
          flex items-center justify-center shadow-lg shadow-garden/25
          group-hover:scale-105 transition-transform duration-300
          overflow-hidden
          bg-white border border-gray-200
          relative
        ">
          {company.logo_url ? (
            <img
              src={company.logo_url}
              alt={company.name}
              className="w-full h-full object-contain p-1.5"
              onError={(e) => {
                console.error('Logo failed to load:', company.logo_url);
                e.target.style.display = 'none';
              }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-garden to-garden-dark flex items-center justify-center">
              <Building2 className="w-7 h-7 text-white" />
            </div>
          )}
        </div>
        
        {/* Company Name */}
        <div className="flex-1 min-w-0">
          <h3 className="
            text-lg font-bold text-gray-900
            group-hover:text-garden transition-colors duration-300
            leading-tight
          ">
            <span className="line-clamp-2">{company.name}</span>
            {category === 'sewa_bulanan' && (
              <span className="inline-block ml-2 px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 text-[10px] font-medium leading-normal align-middle">
                Sewa Bulanan
              </span>
            )}
            {category === 'project' && (
              <span className="inline-block ml-2 px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-medium leading-normal align-middle">
                Project
              </span>
            )}
            {!isActive && category !== 'project' && (
              <span className="inline-block ml-2 px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-[10px] font-medium leading-normal align-middle">
                Tidak Aktif
              </span>
            )}
          </h3>
        </div>
        
        {/* Arrow */}
        <div className="
          flex-shrink-0 self-center
          w-10 h-10 rounded-full bg-gray-50
          flex items-center justify-center
          group-hover:bg-garden group-hover:shadow-lg group-hover:shadow-garden/30
          transition-all duration-300
        ">
          <ChevronRight className="
            w-5 h-5 text-gray-400
            group-hover:text-white group-hover:translate-x-0.5
            transition-all duration-300
          " />
        </div>
      </div>
    </div>
  );
};

export default CompanyCard;
