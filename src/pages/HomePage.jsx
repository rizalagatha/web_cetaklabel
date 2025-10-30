import React, { useState, useRef, useEffect, useCallback } from "react";
import { QRCodeCanvas } from "qrcode.react"; // -> Cara impor yang benar
import { useReactToPrint } from "react-to-print";
import { useAuth } from "../context/AuthContext";
import feather from "feather-icons";
import "../App.css";

// --- Helper Functions ---
const formatDate = (date) => new Date(date).toISOString().split("T")[0];

// ====================================================================
// --- KOMPONEN PEMBANTU (DIDEFINISIKAN DI LUAR) ---
// ====================================================================

const LabelPrintOut = React.forwardRef(({ data }, ref) => {
  // HOOKS HARUS DI ATAS SEBELUM CONDITIONAL RETURN
  const [spkFontSize, setSpkFontSize] = useState("16pt");

  // Hitung data sebelum conditional
  const namaSPK = data?.header?.pack_nama_spk || "Nama SPK Tidak Tersedia";
  const totalQty =
    data?.items?.reduce((sum, item) => sum + (item.packd_qty || 0), 0) || 0;
  const detailUkuranText = data?.header?.detail_ukuran || "";
  const nomorPO = data?.header?.nomor_po || "N/A";

  // useEffect untuk adjust font size
  useEffect(() => {
    const characterLimit = 35;
    if (namaSPK.length > characterLimit) {
      setSpkFontSize("14pt");
    } else {
      setSpkFontSize("16pt");
    }
  }, [namaSPK]);

  // CONDITIONAL RETURN SETELAH HOOKS
  if (!data) return null;

  return (
    <div ref={ref} className="label-print">
      <div className="print-top-section">
        {/* Bagian Kiri: QR Code */}
        <div className="qr-code-box">
          <QRCodeCanvas
            value={data.header.pack_nomor}
            size={70}
            bgColor={"#ffffff"}
            fgColor={"#000000"}
            level={"L"}
            includeMargin={false}
          />
        </div>
        {/* Bagian Kanan: Info SPK & QTY */}
        <div className="print-info-column">
          <span className="print-packing-no">{data.header.pack_nomor}</span>
          <span className="print-spk-no">{data.header.pack_spk_nomor}</span>
          <span className="print-nomor-po">{nomorPO}</span>
          <span className="print-nomor-po">TOTAL QTY: {totalQty}</span>
        </div>
      </div>

      {/* Bagian Bawah: Nama SPK & Detail Ukuran */}
      <div className="print-middle-section">
        <p
          className="print-nama-spk"
          style={{ textAlign: "center", fontSize: spkFontSize }}
        >
          {namaSPK}
        </p>
        <p className="print-detail-ukuran" style={{ textAlign: "center" }}>
          {detailUkuranText}
        </p>
      </div>
    </div>
  );
});

LabelPrintOut.displayName = "LabelPrintOut";

const BatchPrintComponent = React.forwardRef(
  ({ packNomors, apiClient }, ref) => {
    const [labelsData, setLabelsData] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
      const fetchAllData = async () => {
        if (packNomors.length === 0) {
          setLabelsData([]);
          setIsLoading(false);
          return;
        }
        setIsLoading(true);
        const promises = packNomors.map((nomor) =>
          apiClient.get(`/packing/${encodeURIComponent(nomor)}`)
        );
        try {
          const responses = await Promise.all(promises);
          const data = responses.map((res) => res.data.data);
          setLabelsData(data);
        } catch (err) {
          console.error("Gagal memuat data untuk cetak massal:", err);
        } finally {
          setIsLoading(false);
        }
      };
      fetchAllData();
    }, [packNomors, apiClient]);

    if (isLoading)
      return (
        <div ref={ref}>
          <p>Memuat label untuk dicetak...</p>
        </div>
      );
    if (labelsData.length === 0) return <div ref={ref}></div>;

    return (
      <div ref={ref}>
        {labelsData.map((data) => (
          <div key={data.header.pack_nomor} className="print-page-wrapper">
            <LabelPrintOut data={data} />
            <LabelPrintOut data={data} />
          </div>
        ))}
      </div>
    );
  }
);

const HistoryItem = ({
  item,
  isSelected,
  onToggleSelect,
  onDelete,
  onEdit,
}) => {
  if (!item || !item.pack_nomor) {
    return null;
  }
  return (
    <div className={`history-item ${isSelected ? "selected" : ""}`}>
      <input
        type="checkbox"
        checked={isSelected}
        onChange={(e) => onToggleSelect(item.pack_nomor, e.target.checked)}
        className="history-checkbox"
      />
      <div className="history-info">
        <span className="history-pack-nomor">{item.pack_nomor}</span>
        <span className="history-spk-nomor">
          SPK: {item.pack_spk_nomor || ""}
        </span>
      </div>
      <span className="history-tanggal">
        {item.pack_tanggal
          ? new Date(item.pack_tanggal).toLocaleDateString("id-ID")
          : ""}
      </span>
      <button className="view-button" onClick={() => onEdit(item.pack_nomor)}>
        Edit
      </button>
      <button
        className="delete-button"
        onClick={() => onDelete(item.pack_nomor)}
      >
        Hapus
      </button>
    </div>
  );
};

// --- Komponen LabelPrintOut (UNTUK PREVIEW) ---
// Kita akan buat komponen baru untuk daftar item yang bisa diedit
const EditablePackingItem = ({ item, onQtyChange, onDelete }) => (
  <div className="editable-item">
    <div className="item-info">
      <span className="item-name">
        {item.brg_kaosan || item.nama} ({item.packd_size || item.ukuran})
      </span>
      <span className="item-barcode">{item.packd_barcode || item.barcode}</span>
    </div>
    <div className="qty-controls">
      <button
        className="qty-btn minus"
        onClick={() => onQtyChange(-1)}
        disabled={(item.packd_qty || item.qty) <= 1}
      >
        -
      </button>
      <span className="item-qty">{item.packd_qty || item.qty}</span>
      <button className="qty-btn plus" onClick={() => onQtyChange(1)}>
        +
      </button>
    </div>
    <button className="item-delete-btn" onClick={onDelete}>
      &times;
    </button>
  </div>
);
// --- KOMPONEN UTAMA HALAMAN HOME ---

const HomePage = () => {
  const { logout, apiClient, token } = useAuth();

  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [startDate, setStartDate] = useState(formatDate(new Date()));
  const [endDate, setEndDate] = useState(formatDate(new Date()));
  const [selectedPacks, setSelectedPacks] = useState(new Set());
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
  });
  const [editingData, setEditingData] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // const labelRef = useRef(null);
  const batchPrintRef = useRef();

  useEffect(() => {
    if (typeof feather !== "undefined") {
      feather.replace();
    }
  });

  const fetchHistory = useCallback(
    async (page = 1) => {
      if (!token) return;
      setIsLoading(true);
      setError("");
      setSelectedPacks(new Set());
      try {
        const response = await apiClient.get("/packing/history", {
          params: { startDate, endDate, page, limit: 15 },
        });
        setHistory(response.data.data);
        setPagination(
          response.data.pagination || { currentPage: 1, totalPages: 1 }
        );
      } catch (err) {
        setError("Gagal memuat riwayat packing.", err);
        setHistory([]);
      } finally {
        setIsLoading(false);
      }
    },
    [token, apiClient, startDate, endDate]
  );

  useEffect(() => {
    fetchHistory(1);
  }, [fetchHistory]);

  const handleFilter = () => {
    fetchHistory(1);
  };

  const handleSelectionChange = (packNomor, isSelected) => {
    setSelectedPacks((prev) => {
      const newSet = new Set(prev);
      if (isSelected) newSet.add(packNomor);
      else newSet.delete(packNomor);
      return newSet;
    });
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedPacks(new Set(history.map((item) => item.pack_nomor)));
    } else {
      setSelectedPacks(new Set());
    }
  };

  // const handleSearchAndPrint = useCallback(
  //   async (nomorUntukDicari) => {
  //     if (!nomorUntukDicari) return;
  //     setIsLoading(true);
  //     setError("");
  //     setPackingData(null);
  //     try {
  //       const response = await apiClient.get(
  //         `/packing/${encodeURIComponent(nomorUntukDicari)}`
  //       );
  //       setPackingData(response.data.data);
  //     } catch (err) {
  //       setError("Nomor Packing tidak ditemukan.", err);
  //     } finally {
  //       setIsLoading(false);
  //     }
  //   },
  //   [apiClient]
  // );

  // const handlePrint = useReactToPrint({
  //   contentRef: labelRef,
  //   documentTitle: "Label Packing",
  // });

  const handleBatchPrint = useReactToPrint({
    contentRef: batchPrintRef,
    documentTitle: "Label Packing Massal",
  });

  const handleDeletePacking = async (packNomor) => {
    if (
      !window.confirm(
        `Anda yakin ingin menghapus packing ${packNomor}? Data ini tidak bisa dikembalikan.`
      )
    ) {
      return;
    }

    setError("");
    try {
      // Panggil API delete yang sudah ada di backend
      const response = await apiClient.delete(
        `/packing/${encodeURIComponent(packNomor)}`
      );
      alert(response.data.message); // Tampilkan notifikasi sukses

      // Muat ulang daftar riwayat setelah berhasil hapus
      fetchHistory(pagination.currentPage);
    } catch (err) {
      const message = err.response?.data?.message || "Gagal menghapus packing.";
      setError(message); // Tampilkan error
    }
  };

  const handleOpenEditModal = useCallback(
    async (nomorUntukEdit) => {
      if (!nomorUntukEdit) return;
      setIsLoading(true);
      setError("");
      setEditingData(null);
      try {
        const response = await apiClient.get(
          `/packing/${encodeURIComponent(nomorUntukEdit)}`
        );
        setEditingData(response.data.data);
      } catch (err) {
        setError("Nomor Packing tidak ditemukan.", err);
      } finally {
        setIsLoading(false);
      }
    },
    [apiClient]
  );

  const handleModalQtyChange = (barcode, delta) => {
    setEditingData((prev) => {
      const newItems = prev.items
        .map((item) => {
          if ((item.packd_barcode || item.barcode) === barcode) {
            const currentQty = item.packd_qty || item.qty;
            const newQty = currentQty + delta;
            return { ...item, packd_qty: newQty, qty: newQty };
          }
          return item;
        })
        .filter((item) => (item.packd_qty || item.qty) > 0); // Auto-hapus jika qty 0

      return { ...prev, items: newItems };
    });
  };

  const handleRemoveItemFromModal = (barcode) => {
    setEditingData((prev) => ({
      ...prev,
      items: prev.items.filter(
        (item) => (item.packd_barcode || item.barcode) !== barcode
      ),
    }));
  };

  const handleSaveChanges = async () => {
    if (!editingData) return;

    const { header, items } = editingData;
    setIsSaving(true);
    setError("");

    if (items.length === 0) {
      setError("Koreksi gagal: Packing tidak boleh kosong.");
      setIsSaving(false);
      return;
    }

    try {
      await apiClient.put(`/packing/${encodeURIComponent(header.pack_nomor)}`, {
        items,
      });
      alert("Packing berhasil dikoreksi!");
      setEditingData(null);
      fetchHistory(pagination.currentPage);
    } catch (err) {
      const message = err.response?.data?.message || "Gagal menyimpan koreksi.";
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="container">
      <div className="main-header">
        <h1>Antrian Cetak Label</h1>
        <button onClick={logout} className="logout-button" title="Logout">
          <i data-feather="log-out"></i>
        </button>
      </div>

      <div className="filter-bar">
        <div className="date-group">
          <label>Dari Tanggal</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="date-group">
          <label>Sampai Tanggal</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <button onClick={handleFilter} disabled={isLoading}>
          {isLoading ? "Memuat..." : "Terapkan Filter"}
        </button>
      </div>

      <div className="toolbar">
        <button
          className="print-button"
          onClick={handleBatchPrint}
          disabled={selectedPacks.size === 0}
        >
          Cetak yang Dipilih ({selectedPacks.size})
        </button>

        {/* Area tersembunyi untuk komponen yang akan dicetak */}
        <div style={{ display: "none" }}>
          <BatchPrintComponent
            ref={batchPrintRef}
            packNomors={Array.from(selectedPacks)}
            apiClient={apiClient}
          />
        </div>
      </div>

      {error && !editingData && <p className="error-text">{error}</p>}

      <div className="history-list">
        <div className="history-header">
          <input
            type="checkbox"
            onChange={handleSelectAll}
            checked={
              history.length > 0 && selectedPacks.size === history.length
            }
            disabled={history.length === 0}
          />
          <span>Pilih Semua di Halaman Ini</span>
        </div>
        {isLoading ? (
          <p className="loading-text">Memuat riwayat...</p>
        ) : history.length > 0 ? (
          history.map((item) => (
            <HistoryItem
              key={item.pack_nomor}
              item={item}
              isSelected={selectedPacks.has(item.pack_nomor)}
              onToggleSelect={handleSelectionChange}
              onDelete={handleDeletePacking} // -> Teruskan fungsi hapus ke komponen
              onEdit={handleOpenEditModal}
            />
          ))
        ) : (
          <p className="empty-history-text">
            Tidak ada riwayat pada periode ini.
          </p>
        )}
      </div>

      {history.length > 0 && (
        <div className="pagination-controls">
          <button
            onClick={() => fetchHistory(pagination.currentPage - 1)}
            disabled={pagination.currentPage <= 1 || isLoading}
          >
            Sebelumnya
          </button>
          <span>
            Halaman {pagination.currentPage} dari {pagination.totalPages}
          </span>
          <button
            onClick={() => fetchHistory(pagination.currentPage + 1)}
            disabled={
              pagination.currentPage >= pagination.totalPages || isLoading
            }
          >
            Berikutnya
          </button>
        </div>
      )}
      {editingData && (
        <div className="print-preview-overlay">
          <div className="print-preview-modal">
            <div className="print-header">
              <h3>Koreksi Packing: {editingData.header.pack_nomor}</h3>
              <button
                onClick={() => {
                  setEditingData(null);
                  setError("");
                }}
                className="close-button"
              >
                &times;
              </button>
            </div>

            <div className="editable-list">
              {editingData.items.map((item, index) => (
                <EditablePackingItem
                  key={index}
                  item={item}
                  onQtyChange={(delta) =>
                    handleModalQtyChange(
                      item.packd_barcode || item.barcode,
                      delta
                    )
                  }
                  onDelete={() =>
                    handleRemoveItemFromModal(
                      item.packd_barcode || item.barcode
                    )
                  }
                />
              ))}
            </div>

            {error && (
              <p className="error-text" style={{ margin: "10px 0" }}>
                {error}
              </p>
            )}

            <button
              className="print-button"
              onClick={handleSaveChanges}
              disabled={isSaving}
            >
              {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;
