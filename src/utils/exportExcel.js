import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

/**
 * Export data history ke Excel (2 sheet: detail + rekap per sales)
 * @param {Array} data - Array history data
 * @param {string} filename - Nama file
 * @param {Array} companies - Array companies (untuk lookup sales saat join tidak membawa sales_name)
 */
export const exportToExcel = (data, filename = 'report-mutiari-garden', companies = []) => {
  if (!data || data.length === 0) {
    throw new Error('Tidak ada data untuk diexport');
  }

  const companySalesMap = {};
  (companies || []).forEach(c => {
    companySalesMap[c.id] = c.sales_name || '-';
  });

  const resolveSales = (item) =>
    item.companySales || item.sales_name || companySalesMap[item.company_id] || '-';

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
    'Sales': resolveSales(item),
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
    { wch: 20 },  // Sales
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

  // Sheet 2: Rekap per Sales — sales mana pegang client apa saja
  const salesAgg = {};
  data.forEach((item) => {
    const sales = resolveSales(item);
    if (!salesAgg[sales]) {
      salesAgg[sales] = { sales, total: 0, loading: 0, perawatan: 0, media: 0, clients: new Set() };
    }
    const s = salesAgg[sales];
    s.total += 1;
    if (item.type === 'perawatan') s.perawatan += 1;
    else s.loading += 1;
    s.media += item.photo_count || 0;
    if (item.companyName) s.clients.add(item.companyName);
  });
  const rekapSales = Object.values(salesAgg)
    .sort((a, b) => b.total - a.total)
    .map((s, i) => ({
      'No': i + 1,
      'Sales': s.sales,
      'Total Dokumentasi': s.total,
      'Loading': s.loading,
      'Perawatan': s.perawatan,
      'Total Media': s.media,
      'Jumlah Client': s.clients.size,
      'Daftar Client': [...s.clients].sort().join('; '),
    }));
  if (rekapSales.length > 0) {
    const salesSheet = XLSX.utils.json_to_sheet(rekapSales);
    salesSheet['!cols'] = [
      { wch: 5 }, { wch: 20 }, { wch: 17 }, { wch: 10 },
      { wch: 10 }, { wch: 12 }, { wch: 13 }, { wch: 80 },
    ];
    XLSX.utils.book_append_sheet(workbook, salesSheet, 'Rekap Sales');
  }

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
      'Sales': company.sales_name || '-',
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
    { wch: 20 },  // Sales
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
