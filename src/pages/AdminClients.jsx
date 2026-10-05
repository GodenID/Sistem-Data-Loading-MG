import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Users, 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  Building2,
  MapPin,
  Phone,
  User,
  X,
  Check,
  AlertTriangle,
  FileSpreadsheet,
  Loader2,
  CheckCircle,
  AlertCircle,
  Camera,
  Trash2 as TrashIcon,
  Wand2,
  Upload,
  Download,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { getCompanies, deleteCompany, updateCompany, addCompany, getLoadingHistory } from '../utils/supabase';
import AppFooter from '../components/AppFooter';
import { exportCompaniesToExcel } from '../utils/exportExcel';
import { uploadCompanyLogo, deleteOldLogo } from '../utils/logoHandler';
import { toast } from '../utils/toast';
import * as XLSX from 'xlsx';

const AdminClients = () => {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [enableMonthFilter, setEnableMonthFilter] = useState(false);
  const today = new Date();
  const [filterMonth, setFilterMonth] = useState(today.getMonth());
  const [filterYear, setFilterYear] = useState(today.getFullYear());
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [editingClient, setEditingClient] = useState(null);
  
  // Export states
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    pic_name: '',
    contact: '',
    sales_name: '',
    pic_loading: '',
    tanaman_meja: 0,
    tanaman_lantai: 0,
    anggrek_bulan: 0,
    anggrek_dendro: 0,
    planter_box: 0,
    vertical_garden: 0,
    mini_garden: 0,
    center_piece: 0,
    logo_url: ''
  });
  
  // Logo upload state
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [removeBgEnabled, setRemoveBgEnabled] = useState(true);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  
  // Import batch state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });
  const [importResults, setImportResults] = useState(null);

  // Fetch data from Supabase
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [companiesData, historyData] = await Promise.all([
          getCompanies(),
          getLoadingHistory()
        ]);
        setCompanies(companiesData);
        setLoadingHistory(historyData);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, []);

  // Filter companies
  const clientsWithStatus = useMemo(() => {
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

    return companies.map(company => {
      const latestDoc = [...loadingHistory]
        .filter(h => h.company_id === company.id)
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

      const isActive = !!latestDoc && new Date(latestDoc.date) >= twoMonthsAgo;
      return { ...company, isActive };
    });
  }, [companies, loadingHistory]);

  const filteredCompanies = useMemo(() => {
    let result = clientsWithStatus;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(company =>
        (company.name || '').toLowerCase().includes(query) ||
        (company.address || '').toLowerCase().includes(query) ||
        (company.pic_name || '').toLowerCase().includes(query)
      );
    }

    if (statusFilter === 'active') {
      result = result.filter(company => company.isActive);
    } else     if (statusFilter === 'inactive') {
      result = result.filter(company => !company.isActive);
    }

    // Month filter: only show clients with documentation in selected month
    if (enableMonthFilter) {
      const monthStart = new Date(filterYear, filterMonth, 1);
      const monthEnd = new Date(filterYear, filterMonth + 1, 0);
      result = result.filter(company => {
        const docsInMonth = loadingHistory.filter(h =>
          h.company_id === company.id &&
          new Date(h.date) >= monthStart &&
          new Date(h.date) <= monthEnd
        );
        return docsInMonth.length > 0;
      });
    }

    return result;
  }, [clientsWithStatus, searchQuery, statusFilter, loadingHistory, filterMonth, filterYear, enableMonthFilter]);

  // Hitung statistik per client
  const getClientStats = (companyId) => {
    const rotations = loadingHistory.filter(item => item.company_id === companyId);
    const totalPhotos = rotations.reduce((acc, item) => acc + (item.photo_count || 0), 0);
    return {
      rotationCount: rotations.length,
      totalPhotos
    };
  };

  const handleOpenModal = (client = null) => {
    if (client) {
      setEditingClient(client);
      setFormData({
        name: client.name,
        address: client.address || '',
        contact: client.contact || '',
        pic_name: client.pic_name || '',
        sales_name: client.sales_name || '',
        pic_loading: client.pic_loading || '',
        tanaman_meja: client.tanaman_meja || 0,
        tanaman_lantai: client.tanaman_lantai || 0,
        anggrek_bulan: client.anggrek_bulan || 0,
        anggrek_dendro: client.anggrek_dendro || 0,
        planter_box: client.planter_box || 0,
        vertical_garden: client.vertical_garden || 0,
        mini_garden: client.mini_garden || 0,
        center_piece: client.center_piece || 0,
        logo_url: client.logo_url || ''
      });
      setLogoPreview(client.logo_url || null);
    } else {
      setEditingClient(null);
      setFormData({
        name: '',
        address: '',
        pic_name: '',
        contact: '',
        sales_name: '',
        pic_loading: '',
        tanaman_meja: 0,
        tanaman_lantai: 0,
        anggrek_bulan: 0,
        anggrek_dendro: 0,
        planter_box: 0,
        vertical_garden: 0,
        mini_garden: 0,
        center_piece: 0,
        logo_url: ''
      });
      setLogoPreview(null);
    }
    setLogoFile(null);
    setRemoveBgEnabled(true);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingClient(null);
    setFormData({
      name: '',
      address: '',
      pic_name: '',
      contact: '',
      sales_name: '',
      pic_loading: '',
      tanaman_meja: 0,
      tanaman_lantai: 0,
      anggrek_bulan: 0,
      anggrek_dendro: 0,
      planter_box: 0,
      vertical_garden: 0,
      mini_garden: 0,
      center_piece: 0,
      logo_url: ''
    });
    setLogoFile(null);
    setLogoPreview(null);
    setRemoveBgEnabled(true);
  };
  
  // Handle logo file selection
  const handleLogoSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar');
      return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 5MB');
      return;
    }
    
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };
  
  // Remove selected logo
  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setFormData(prev => ({ ...prev, logo_url: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    setIsUploadingLogo(true);
    
    try {
      let logoUrl = formData.logo_url;

      // Upload logo baru jika ada
      if (logoFile) {
        const previousLogoUrl = editingClient?.logo_url;

        // Upload logo baru dulu; logo lama baru dihapus setelah upload sukses
        // agar logo lama tidak hilang kalau upload gagal.
        logoUrl = await uploadCompanyLogo(logoFile, formData.name, removeBgEnabled);

        if (previousLogoUrl && previousLogoUrl !== logoUrl) {
          await deleteOldLogo(previousLogoUrl);
        }
      }
      
      console.log('Final logoUrl to save:', logoUrl);
      
      // Convert string numbers to integers for plant counts
      const dataToSave = {
        ...formData,
        logo_url: logoUrl,
        pic_loading: formData.pic_loading,
        tanaman_meja: parseInt(formData.tanaman_meja) || 0,
        tanaman_lantai: parseInt(formData.tanaman_lantai) || 0,
        anggrek_bulan: parseInt(formData.anggrek_bulan) || 0,
        anggrek_dendro: parseInt(formData.anggrek_dendro) || 0,
        planter_box: parseInt(formData.planter_box) || 0,
        vertical_garden: parseInt(formData.vertical_garden) || 0,
        mini_garden: parseInt(formData.mini_garden) || 0,
        center_piece: parseInt(formData.center_piece) || 0
      };
      
      console.log('Saving data:', dataToSave);
      
      if (editingClient) {
        // Edit existing
        const updated = await updateCompany(editingClient.id, dataToSave);
        console.log('Updated company:', updated);
        
        // Refresh data from server to ensure consistency
        const refreshedCompanies = await getCompanies();
        setCompanies(refreshedCompanies);
      } else {
        // Add new
        const newCompany = await addCompany(dataToSave);
        setCompanies(prev => [...prev, newCompany]);
      }
      
      handleCloseModal();
      toast.success(editingClient ? 'Client berhasil diupdate!' : 'Client berhasil ditambahkan!');
    } catch (error) {
      console.error('Error saving company:', error);
      toast.error('Gagal menyimpan data: ' + error.message);
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleDelete = async (companyId) => {
    try {
      await deleteCompany(companyId);
      setCompanies(prev => prev.filter(c => c.id !== companyId));
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting company:', error);
      toast.error('Gagal menghapus data: ' + error.message);
    }
  };

  // Handle Export Excel
  const handleExport = async () => {
    if (companies.length === 0) {
      setExportStatus({
        type: 'error',
        message: 'Tidak ada data client untuk diexport'
      });
      return;
    }

    setIsExporting(true);
    setExportStatus({ type: 'loading', message: 'Mempersiapkan export...' });

    try {
      const result = await exportCompaniesToExcel(companies, loadingHistory);
      setExportStatus({
        type: 'success',
        message: `Berhasil export ${result.count} client ke ${result.filename}`
      });
      
      setTimeout(() => setExportStatus(null), 3000);
    } catch (error) {
      console.error('Export error:', error);
      setExportStatus({
        type: 'error',
        message: error.message || 'Gagal export data'
      });
    } finally {
      setIsExporting(false);
    }
  };

  const isFormValid = formData.name;

  // Import batch functions
  const handleImportFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/csv'
    ];
    
    if (!validTypes.includes(file.type) && !file.name.endsWith('.xlsx') && !file.name.endsWith('.csv')) {
      toast.error('File harus berupa Excel (.xlsx) atau CSV (.csv)');
      return;
    }
    
    setImportFile(file);
    parseImportFile(file);
  };
  
  const parseImportFile = (file) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length < 2) {
          toast.error('File kosong atau tidak memiliki data');
          return;
        }
        
        // Parse headers (first row)
        const headers = jsonData[0].map(h => String(h).toLowerCase().trim());
        
        // Required columns
        const requiredCols = ['nama perusahaan'];
        const hasRequired = requiredCols.some(req => 
          headers.some(h => h.includes(req))
        );
        
        if (!hasRequired) {
          toast.error('Format file tidak valid. Kolom "Nama Perusahaan" wajib ada.');
          return;
        }
        
        // Map column indices
        const getColIndex = (keywords) => {
          return headers.findIndex(h => 
            keywords.some(k => h.includes(k.toLowerCase()))
          );
        };
        
        const colIndices = {
          name: getColIndex(['nama perusahaan', 'company name', 'name']),
          address: getColIndex(['alamat', 'address']),
          pic_name: getColIndex(['pic', 'contact person']),
          contact: getColIndex(['kontak', 'contact', 'phone', 'telp', 'whatsapp', 'wa']),
          sales_name: getColIndex(['sales', 'nama sales']),
          pic_loading: getColIndex(['pic loading', 'pic_loading']),
          tanaman_meja: getColIndex(['meja', 'table']),
          tanaman_lantai: getColIndex(['lantai', 'floor']),
          anggrek_bulan: getColIndex(['anggrek bulan', 'anggrek_bulan']),
          anggrek_dendro: getColIndex(['anggrek dendro', 'anggrek_dendro']),
          planter_box: getColIndex(['planter box', 'planter_box']),
          vertical_garden: getColIndex(['vertical', 'vertikal']),
          mini_garden: getColIndex(['mini', 'taman mini']),
          center_piece: getColIndex(['center', 'piece', 'tengah'])
        };
        
        // Parse data rows
        const parsedData = [];
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row[colIndices.name]) continue; // Skip empty rows
          
          parsedData.push({
            name: String(row[colIndices.name] || '').trim(),
            address: String(row[colIndices.address] || '').trim(),
            pic_name: String(row[colIndices.pic_name] || '').trim(),
            contact: String(row[colIndices.contact] || '').trim(),
            sales_name: String(row[colIndices.sales_name] || '').trim(),
            pic_loading: String(row[colIndices.pic_loading] || '').trim(),
            tanaman_meja: parseInt(row[colIndices.tanaman_meja]) || 0,
            tanaman_lantai: parseInt(row[colIndices.tanaman_lantai]) || 0,
            anggrek_bulan: parseInt(row[colIndices.anggrek_bulan]) || 0,
            anggrek_dendro: parseInt(row[colIndices.anggrek_dendro]) || 0,
            planter_box: parseInt(row[colIndices.planter_box]) || 0,
            vertical_garden: parseInt(row[colIndices.vertical_garden]) || 0,
            mini_garden: parseInt(row[colIndices.mini_garden]) || 0,
            center_piece: parseInt(row[colIndices.center_piece]) || 0
          });
        }
        
        setImportPreview(parsedData);
      } catch (error) {
        console.error('Error parsing file:', error);
        toast.error('Gagal membaca file: ' + error.message);
      }
    };
    
    reader.readAsArrayBuffer(file);
  };
  
  const handleImport = async () => {
    if (importPreview.length === 0) return;
    
    setIsImporting(true);
    setImportProgress({ current: 0, total: importPreview.length, success: 0, failed: 0 });
    setImportResults([]);
    
    const results = [];
    let successCount = 0;
    let failedCount = 0;
    
    for (let i = 0; i < importPreview.length; i++) {
      const client = importPreview[i];
      
      try {
        // Check if company already exists
        const existing = companies.find(c => 
          (c.name || '').toLowerCase() === (client.name || '').toLowerCase()
        );
        
        if (existing) {
          results.push({ ...client, status: 'skipped', reason: 'Sudah ada' });
          continue;
        }
        
        // Add new company
        const newCompany = await addCompany(client);
        results.push({ ...client, status: 'success', id: newCompany.id });
        successCount++;
      } catch (error) {
        console.error('Error importing client:', error);
        results.push({ ...client, status: 'failed', reason: error.message });
        failedCount++;
      }
      
      setImportProgress({
        current: i + 1,
        total: importPreview.length,
        success: successCount,
        failed: failedCount
      });
    }
    
    setImportResults(results);
    
    // Refresh companies list
    const refreshed = await getCompanies();
    setCompanies(refreshed);
    
    setIsImporting(false);
  };
  
  const downloadTemplate = () => {
    const template = [
      {
        'Nama Perusahaan': 'PT. Contoh Indonesia',
        'Alamat': 'Jl. Sudirman No. 123, Jakarta',
        'PIC': 'Budi Santoso',
        'Kontak': '08123456789',
        'Nama Sales': 'Andi Sales',
        'PIC Loading': 'Budi Santoso',
        'Tanaman Meja': 5,
        'Tanaman Lantai': 3,
        'Anggrek Bulan': 2,
        'Anggrek Dendro': 1,
        'Planter Box': 2,
        'Vertical Garden': 1,
        'Mini Garden': 0,
        'Center Piece': 4
      }
    ];
    
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'template-import-client.xlsx');
  };
  
  const closeImportModal = () => {
    setShowImportModal(false);
    setImportFile(null);
    setImportPreview([]);
    setImportResults(null);
    setImportProgress({ current: 0, total: 0, success: 0, failed: 0 });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/admin')}
              className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="flex-1">
              <h1 className="text-lg font-bold text-gray-900">Manajemen Client</h1>
              <p className="text-xs text-gray-500">{filteredCompanies.length} client</p>
            </div>
            <button
              onClick={handleExport}
              disabled={isExporting || companies.length === 0}
              className={`
                flex items-center gap-2 px-3 py-2 rounded-xl font-medium text-sm
                transition-all duration-200
                ${isExporting || companies.length === 0
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
                }
              `}
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">Export</span>
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 transition-colors"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Import</span>
            </button>
            <button
              onClick={() => handleOpenModal()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-garden text-white font-medium hover:bg-garden-dark transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Tambah</span>
              <span className="sm:hidden">Tambah</span>
            </button>
          </div>
        </div>
      </header>

      {/* Search */}
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari client..."
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-garden focus:ring-2 focus:ring-garden/10 bg-white"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              statusFilter === 'all'
                ? 'bg-garden text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Semua
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              statusFilter === 'active'
                ? 'bg-garden text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Aktif
          </button>
          <button
            onClick={() => setStatusFilter('inactive')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              statusFilter === 'inactive'
                ? 'bg-red-500 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Tidak Aktif
          </button>
        </div>

        {/* Month Picker */}
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={() => setEnableMonthFilter(!enableMonthFilter)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              enableMonthFilter
                ? 'bg-garden text-white'
                : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            Filter Bulan
          </button>
          {enableMonthFilter && (
            <>
              <button
                onClick={() => {
                  const d = new Date(filterYear, filterMonth - 1);
                  setFilterMonth(d.getMonth());
                  setFilterYear(d.getFullYear());
                }}
                className="px-2 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(parseInt(e.target.value))}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 bg-white focus:outline-none focus:border-garden"
              >
                {['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'].map((name, i) => (
                  <option key={i} value={i}>{name}</option>
                ))}
              </select>
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(parseInt(e.target.value))}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 bg-white focus:outline-none focus:border-garden"
              >
                {Array.from({length: 5}, (_, i) => today.getFullYear() - 2 + i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <button
                onClick={() => {
                  const d = new Date(filterYear, filterMonth + 1);
                  setFilterMonth(d.getMonth());
                  setFilterYear(d.getFullYear());
                }}
                className="px-2 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <span className="text-xs text-gray-400">
                {loadingHistory.filter(h => {
                  const d = new Date(h.date);
                  return d.getMonth() === filterMonth && d.getFullYear() === filterYear;
                }).length} dokumentasi
              </span>
            </>
          )}
        </div>

        {/* Quick Stats */}
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            Total: <strong className="text-gray-800">{companies.length}</strong>
          </span>
        </div>
        
        {/* Export Status */}
        {exportStatus && (
          <div className={`
            mt-3 p-3 rounded-xl flex items-center gap-2 text-sm
            ${exportStatus.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : ''}
            ${exportStatus.type === 'error' ? 'bg-red-50 text-red-700 border border-red-100' : ''}
            ${exportStatus.type === 'loading' ? 'bg-blue-50 text-blue-700 border border-blue-100' : ''}
          `}>
            {exportStatus.type === 'success' && <CheckCircle className="w-4 h-4 flex-shrink-0" />}
            {exportStatus.type === 'error' && <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            {exportStatus.type === 'loading' && <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />}
            <span>{exportStatus.message}</span>
          </div>
        )}
      </div>

      {/* Clients List */}
      <main className="max-w-6xl mx-auto px-4 pb-8">
        {isLoading ? (
          <div className="text-center py-16">
            <Loader2 className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-4" />
            <p className="text-gray-500">Memuat data client...</p>
          </div>
        ) : filteredCompanies.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCompanies.map((company) => {
              const stats = getClientStats(company.id);
              return (
                <div 
                  key={company.id}
                  className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-lg hover:border-garden/30 transition-all duration-300"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden bg-white border border-gray-200">
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
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-garden to-garden-dark">
                          <Building2 className="w-6 h-6 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleOpenModal(company)}
                        className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(company)}
                        className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-100 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Info */}
                  <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2 flex-wrap" title={company.name}>
                    <span className="line-clamp-2">{company.name}</span>
                    {!company.isActive && (
                      <span className="shrink-0 px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-[10px] font-medium leading-normal">
                        Tidak Aktif
                      </span>
                    )}
                  </h3>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-600 line-clamp-2">{company.address || '-'}</span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex gap-3 pt-4 border-t border-gray-100">
                    <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2 text-center">
                      <p className="text-xs text-gray-500 mb-0.5">Dokumentasi</p>
                      <p className="font-bold text-gray-900">{stats.rotationCount}</p>
                    </div>
                    <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2 text-center">
                                <p className="text-xs text-gray-500 mb-0.5">Media</p>
                      <p className="font-bold text-gray-900">{stats.totalPhotos}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium">Tidak ada client</p>
            <p className="text-sm text-gray-400 mt-1">
              {searchQuery ? 'Coba kata kunci lain' : 'Tambahkan client baru'}
            </p>
          </div>
        )}
      </main>
      <AppFooter />

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden animate-slide-up">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                {editingClient ? 'Edit Client' : 'Tambah Client Baru'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
              {/* Logo Upload */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Logo Perusahaan
                </label>
                
                {logoPreview ? (
                  <div className="relative w-32 h-32 mx-auto mb-3">
                    <img
                      src={logoPreview}
                      alt="Logo Preview"
                      className="w-full h-full object-contain rounded-xl border-2 border-gray-200 bg-white"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-garden hover:bg-garden/5 transition-all">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Camera className="w-8 h-8 text-gray-400 mb-2" />
                      <p className="text-sm text-gray-500">Tap untuk upload logo</p>
                      <p className="text-xs text-gray-400">PNG, JPG (max 5MB)</p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoSelect}
                      className="hidden"
                    />
                  </label>
                )}
                
                {/* Remove Background Toggle */}
                {logoPreview && (
                  <div className="flex items-center justify-center gap-2 mt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={removeBgEnabled}
                        onChange={(e) => setRemoveBgEnabled(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-garden focus:ring-garden"
                      />
                      <span className="text-sm text-gray-600 flex items-center gap-1">
                        <Wand2 className="w-3.5 h-3.5" />
                        Hapus background otomatis
                      </span>
                    </label>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Nama Perusahaan <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="PT. Nama Perusahaan"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-garden focus:ring-2 focus:ring-garden/10"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Alamat
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Alamat lengkap perusahaan"
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-garden focus:ring-2 focus:ring-garden/10 resize-none"
                />
              </div>

              {/* PIC & Kontak */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    <User className="w-3.5 h-3.5 inline mr-1" />
                    PIC
                  </label>
                  <input
                    type="text"
                    value={formData.pic_name}
                    onChange={(e) => setFormData({ ...formData, pic_name: e.target.value })}
                    placeholder="Nama PIC"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-garden focus:ring-2 focus:ring-garden/10"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    <Phone className="w-3.5 h-3.5 inline mr-1" />
                    Kontak
                  </label>
                  <input
                    type="text"
                    value={formData.contact}
                    onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                    placeholder="Nomor telepon/WhatsApp"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-garden focus:ring-2 focus:ring-garden/10"
                  />
                </div>
              </div>

              {/* Sales */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Nama Sales
                </label>
                <input
                  type="text"
                  value={formData.sales_name}
                  onChange={(e) => setFormData({ ...formData, sales_name: e.target.value })}
                  placeholder="Nama sales yang handle client ini"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-garden focus:ring-2 focus:ring-garden/10"
                />
              </div>

              {/* PIC Loading */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  PIC Loading
                </label>
                <input
                  type="text"
                  value={formData.pic_loading}
                  onChange={(e) => setFormData({ ...formData, pic_loading: e.target.value })}
                  placeholder="Nama default PIC untuk loading/perawatan"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-garden focus:ring-2 focus:ring-garden/10"
                />
              </div>

              {/* Jumlah Tanaman */}
              <div className="pt-4 border-t border-gray-100">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Jumlah Tanaman</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Tanaman Meja</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.tanaman_meja}
                      onChange={(e) => setFormData({ ...formData, tanaman_meja: e.target.value })}
                      placeholder="0"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-garden focus:ring-2 focus:ring-garden/10"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Tanaman Lantai</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.tanaman_lantai}
                      onChange={(e) => setFormData({ ...formData, tanaman_lantai: e.target.value })}
                      placeholder="0"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-garden focus:ring-2 focus:ring-garden/10"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Anggrek Bulan</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.anggrek_bulan}
                      onChange={(e) => setFormData({ ...formData, anggrek_bulan: e.target.value })}
                      placeholder="0"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-garden focus:ring-2 focus:ring-garden/10"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Anggrek Dendro</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.anggrek_dendro}
                      onChange={(e) => setFormData({ ...formData, anggrek_dendro: e.target.value })}
                      placeholder="0"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-garden focus:ring-2 focus:ring-garden/10"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Planter Box</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.planter_box}
                      onChange={(e) => setFormData({ ...formData, planter_box: e.target.value })}
                      placeholder="0"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-garden focus:ring-2 focus:ring-garden/10"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Vertical Garden</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.vertical_garden}
                      onChange={(e) => setFormData({ ...formData, vertical_garden: e.target.value })}
                      placeholder="0"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-garden focus:ring-2 focus:ring-garden/10"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Mini Garden</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.mini_garden}
                      onChange={(e) => setFormData({ ...formData, mini_garden: e.target.value })}
                      placeholder="0"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-garden focus:ring-2 focus:ring-garden/10"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Center Piece</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.center_piece}
                      onChange={(e) => setFormData({ ...formData, center_piece: e.target.value })}
                      placeholder="0"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-garden focus:ring-2 focus:ring-garden/10"
                    />
                  </div>
                </div>
              </div>
            </form>

            {/* Footer */}
            <div className="flex gap-3 p-6 border-t border-gray-100 bg-gray-50">
              <button
                type="button"
                onClick={handleCloseModal}
                className="flex-1 py-3 rounded-xl bg-white border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSubmit}
                disabled={!isFormValid || isUploadingLogo}
                className={`flex-1 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
                  isFormValid && !isUploadingLogo
                    ? 'bg-garden text-white hover:bg-garden-dark'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {isUploadingLogo ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{editingClient ? 'Simpan Perubahan' : 'Tambah Client'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 animate-slide-up">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Hapus Client?</h3>
              <p className="text-gray-500">
                Apakah Anda yakin ingin menghapus <strong>{showDeleteConfirm.name}</strong>?
                <br />Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm.id)}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Batch Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden animate-slide-up flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Import Client (Batch)</h2>
                <p className="text-xs text-gray-500">Import banyak client dari file Excel/CSV</p>
              </div>
              <button
                onClick={closeImportModal}
                disabled={isImporting}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {!importFile ? (
                /* Upload Step */
                <div className="space-y-4">
                  <div className="bg-blue-50 rounded-xl p-4">
                    <h3 className="font-semibold text-blue-900 mb-2">Format File</h3>
                    <ul className="text-sm text-blue-700 space-y-1">
                      <li>• File Excel (.xlsx) atau CSV (.csv)</li>
                      <li>• Kolom wajib: <strong>Nama Perusahaan</strong></li>
                      <li>• Kolom opsional: Alamat, PIC, Kontak, Nama Sales, PIC Loading, Tanaman Meja, Tanaman Lantai, Anggrek Bulan, Anggrek Dendro, Planter Box, Vertical Garden, Mini Garden, Center Piece</li>
                    </ul>
                  </div>

                  <button
                    onClick={downloadTemplate}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download Template Excel
                  </button>

                  <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-garden hover:bg-garden/5 transition-all">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-10 h-10 text-gray-400 mb-2" />
                      <p className="text-sm text-gray-500">Klik untuk upload file Excel/CSV</p>
                      <p className="text-xs text-gray-400">.xlsx atau .csv</p>
                    </div>
                    <input
                      type="file"
                      accept=".xlsx,.csv"
                      onChange={handleImportFileSelect}
                      className="hidden"
                    />
                  </label>
                </div>
              ) : importResults ? (
                /* Results Step */
                <div className="space-y-4">
                  <div className="bg-green-50 rounded-xl p-4">
                    <h3 className="font-semibold text-green-900 mb-2">Import Selesai!</h3>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="bg-white rounded-lg p-3">
                        <p className="text-2xl font-bold text-green-600">{importProgress.success}</p>
                        <p className="text-xs text-gray-500">Berhasil</p>
                      </div>
                      <div className="bg-white rounded-lg p-3">
                        <p className="text-2xl font-bold text-yellow-600">{importPreview.length - importProgress.success - importProgress.failed}</p>
                        <p className="text-xs text-gray-500">Dilewati</p>
                      </div>
                      <div className="bg-white rounded-lg p-3">
                        <p className="text-2xl font-bold text-red-600">{importProgress.failed}</p>
                        <p className="text-xs text-gray-500">Gagal</p>
                      </div>
                    </div>
                  </div>

                  <div className="border rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left">Nama</th>
                          <th className="px-4 py-2 text-center">Status</th>
                          <th className="px-4 py-2 text-left">Keterangan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {importResults.map((result, idx) => (
                          <tr key={idx} className={result.status === 'success' ? 'bg-green-50/50' : result.status === 'failed' ? 'bg-red-50/50' : 'bg-yellow-50/50'}>
                            <td className="px-4 py-2">{result.name}</td>
                            <td className="px-4 py-2 text-center">
                              {result.status === 'success' && <CheckCircle className="w-4 h-4 text-green-600 mx-auto" />}
                              {result.status === 'failed' && <AlertCircle className="w-4 h-4 text-red-600 mx-auto" />}
                              {result.status === 'skipped' && <span className="text-xs text-yellow-600">Lewati</span>}
                            </td>
                            <td className="px-4 py-2 text-xs text-gray-500">{result.reason || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* Preview Step */
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">Preview Data ({importPreview.length} client)</h3>
                    <button
                      onClick={() => { setImportFile(null); setImportPreview([]); }}
                      disabled={isImporting}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Ganti File
                    </button>
                  </div>

                  {isImporting ? (
                    <div className="bg-blue-50 rounded-xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-blue-900 font-medium">Sedang import...</span>
                        <span className="text-blue-600 font-bold">{importProgress.current} / {importProgress.total}</span>
                      </div>
                      <div className="h-3 bg-blue-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 transition-all duration-300"
                          style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                        />
                      </div>
                      <div className="flex justify-between mt-2 text-xs text-blue-700">
                        <span>Berhasil: {importProgress.success}</span>
                        <span>Gagal: {importProgress.failed}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="border rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left">Nama Perusahaan</th>
                            <th className="px-3 py-2 text-left">PIC</th>
                            <th className="px-3 py-2 text-left">Sales</th>
                            <th className="px-3 py-2 text-center">Meja</th>
                            <th className="px-3 py-2 text-center">Lantai</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {importPreview.map((client, idx) => (
                            <tr key={idx}>
                              <td className="px-3 py-2 font-medium">{client.name}</td>
                              <td className="px-3 py-2 text-gray-600">{client.pic_name || '-'}</td>
                              <td className="px-3 py-2 text-gray-600">{client.sales_name || '-'}</td>
                              <td className="px-3 py-2 text-center">{client.tanaman_meja}</td>
                              <td className="px-3 py-2 text-center">{client.tanaman_lantai}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 p-6 border-t border-gray-100 bg-gray-50">
              <button
                onClick={closeImportModal}
                disabled={isImporting}
                className="flex-1 py-3 rounded-xl bg-white border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {importResults ? 'Tutup' : 'Batal'}
              </button>
              {importPreview.length > 0 && !importResults && (
                <button
                  onClick={handleImport}
                  disabled={isImporting}
                  className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Importing...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Import {importPreview.length} Client</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminClients;
