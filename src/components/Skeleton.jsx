import React from 'react';

const Skeleton = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-200 rounded-xl ${className}`} />
);

Skeleton.Text = ({ lines = 1, className = '' }) => (
  <div className={`space-y-2 ${className}`}>
    {Array.from({ length: lines }).map((_, i) => (
      <div
        key={i}
        className="animate-pulse bg-gray-200 rounded-lg"
        style={{ width: i === lines - 1 ? '60%' : '100%', height: '14px' }}
      />
    ))}
  </div>
);

Skeleton.Card = ({ className = '' }) => (
  <div className={`bg-white rounded-2xl border border-gray-100 overflow-hidden ${className}`}>
    <Skeleton className="h-32 rounded-none" />
    <div className="p-4 space-y-3">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-full" />
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-8 w-20 rounded-full" />
        <Skeleton className="h-8 w-24 rounded-full" />
      </div>
    </div>
  </div>
);

Skeleton.Table = ({ rows = 5, cols = 4 }) => (
  <div className="space-y-3">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex gap-4">
        {Array.from({ length: cols }).map((_, j) => (
          <Skeleton
            key={j}
            className="h-5"
            style={{ width: `${60 + Math.random() * 40}%`, flex: 1 }}
          />
        ))}
      </div>
    ))}
  </div>
);

Skeleton.Image = ({ className = '' }) => (
  <Skeleton className={`aspect-square ${className}`} />
);

Skeleton.Avatar = ({ className = '' }) => (
  <Skeleton className={`rounded-full ${className}`} />
);

Skeleton.Page = () => (
  <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
    <div className="flex items-center gap-4">
      <Skeleton.Avatar className="w-12 h-12" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton.Card key={i} />
      ))}
    </div>
    <Skeleton className="h-48" />
  </div>
);

export default Skeleton;
