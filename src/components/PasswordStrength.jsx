import React from 'react';

// Skor 0-5: panjang >=8, panjang >=12, huruf kecil+besar, angka, simbol.
export function scorePassword(pw = '') {
  let s = 0;
  if (pw.length >= 8) s += 1;
  if (pw.length >= 12) s += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s += 1;
  if (/\d/.test(pw)) s += 1;
  if (/[^a-zA-Z0-9]/.test(pw)) s += 1;
  return s;
}

export function strengthLabel(score) {
  if (score <= 1) return { text: 'Lemah', color: 'bg-red-500', textColor: 'text-red-600' };
  if (score <= 3) return { text: 'Sedang', color: 'bg-amber-500', textColor: 'text-amber-600' };
  return { text: 'Kuat', color: 'bg-green-600', textColor: 'text-green-700' };
}

const PasswordStrength = ({ password }) => {
  if (!password) return null;
  const score = scorePassword(password);
  const { text, color, textColor } = strengthLabel(score);
  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full ${i <= score ? color : 'bg-gray-200'}`}
          />
        ))}
      </div>
      <p className={`text-xs font-semibold mt-1 ${textColor}`}>
        {text}
        {score <= 3 && (
          <span className="font-normal text-gray-500">
            {' '}— tambah panjang, kapital, angka & simbol
          </span>
        )}
      </p>
    </div>
  );
};

export default PasswordStrength;
