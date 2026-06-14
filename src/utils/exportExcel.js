import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

/**
 * Export data history ke Excel
 * @param {Array} data - Array history data
 * @param {string} filename - Nama file
 */
export const exportToExcel = (data, filename = 'report-mutiari-garden') => {
  if (!data || data.length === 0) {
    throw new Error('Tidak ada data untuk diexport');
  }

  // Format data untuk Excel
  const formattedData = data.map((item, index) => ({
    'No': index + 1,
    'Tanggal': new Date(item.date).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }),
    'Jenis': item.type === 'perawatan' ? 'Perawatan' : 'Loading',
    'Nama Perusahaan': item.companyName,
    'PIC/Perawatan Oleh': item.pic,
    'Jumlah Media': item.photo_count || 0,
    'Waktu Input': item.created_at ? new Date(item.created_at).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) : '-'
  }));

  // Buat worksheet
  const worksheet = XLSX.utils.json_to_sheet(formattedData);

  // Set column widths
  const colWidths = [
    { wch: 5 },   // No
    { wch: 20 },  // Tanggal
    { wch: 12 },  // Jenis
    { wch: 35 },  // Nama Perusahaan
    { wch: 25 },  // PIC
    { wch: 12 },  // Jumlah Media
    { wch: 20 },  // Waktu Input
  ];
  worksheet['!cols'] = colWidths;

  // Style header
  const headerRange = XLSX.utils.decode_range(worksheet['!ref']);
  for (let C = headerRange.s.c; C <= headerRange.e.c; ++C) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
    if (!worksheet[cellAddress]) continue;
    
    worksheet[cellAddress].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '4CAF50' } },
      alignment: { horizontal: 'center', vertical: 'center' }
    };
  }

  // Buat workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Report Data');

  // Generate file
  const excelBuffer = XLSX.write(workbook, { 
    bookType: 'xlsx', 
    type: 'array',
    cellStyles: true 
  });
  
  const blob = new Blob([excelBuffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });

  // Simpan file dengan nama yang rapih
  const dateStr = new Date().toISOString().split('T')[0];
  const fullFilename = `${filename}_${dateStr}.xlsx`;
  
  saveAs(blob, fullFilename);
  
  return {
    success: true,
    filename: fullFilename,
    count: data.length
  };
};

/**
 * Export data perusahaan ke Excel
 * @param {Array} companies - Array companies
 * @param {Array} history - Array history untuk hitung statistik
 */
export const exportCompaniesToExcel = (companies, history) => {
  if (!companies || companies.length === 0) {
    throw new Error('Tidak ada data perusahaan');
  }

  // Hitung statistik per perusahaan
  const formattedData = companies.map((company, index) => {
    const companyHistory = history.filter(h => h.company_id === company.id);
    const loadingCount = companyHistory.filter(h => h.type === 'loading' || !h.type).length;
    const perawatanCount = companyHistory.filter(h => h.type === 'perawatan').length;
    const totalPhotos = companyHistory.reduce((acc, h) => acc + (h.photo_count || 0), 0);

    return {
      'No': index + 1,
      'Nama Perusahaan': company.name,
      'Alamat': company.address || '-',
      'PIC': company.pic_name || '-',
      'Kontak': company.contact || '-',
      'PIC Loading': company.pic_loading || '-',
      'Tanaman Meja': company.tanaman_meja || 0,
      'Tanaman Lantai': company.tanaman_lantai || 0,
      'Anggrek Bulan': company.anggrek_bulan || 0,
      'Anggrek Dendro': company.anggrek_dendro || 0,
      'Planter Box': company.planter_box || 0,
      'Vertical Garden': company.vertical_garden || 0,
      'Mini Garden': company.mini_garden || 0,
      'Center Piece': company.center_piece || 0,
      'Total Loading': loadingCount,
      'Total Perawatan': perawatanCount,
      'Total Media': totalPhotos
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(formattedData);
  
  worksheet['!cols'] = [
    { wch: 5 },   // No
    { wch: 35 },  // Nama
    { wch: 40 },  // Alamat
    { wch: 20 },  // PIC
    { wch: 15 },  // Kontak
    { wch: 12 },  // Tanaman Meja
    { wch: 12 },  // Tanaman Lantai
    { wch: 12 },  // Anggrek Bulan
    { wch: 12 },  // Anggrek Dendro
    { wch: 12 },  // Planter Box
    { wch: 12 },  // Vertical Garden
    { wch: 12 },  // Mini Garden
    { wch: 12 },  // Center Piece
    { wch: 12 },  // Loading
    { wch: 12 },  // Perawatan
    { wch: 10 },  // Media
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Client');

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });

  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `data-client-mutiari-garden_${dateStr}.xlsx`;
  
  saveAs(blob, filename);
  
  return { success: true, filename, count: companies.length };
};
