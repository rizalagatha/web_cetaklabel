import React, { useState, useRef, useEffect, useCallback } from "react";
import Barcode from "react-barcode";
import { useReactToPrint } from "react-to-print";
import { useAuth } from "../context/AuthContext";
import "../App.css"; // Kita tetap gunakan App.css untuk styling utama

// --- KOMPONEN PEMBANTU ---
const formatDate = (date) => date.toISOString().split("T")[0];

const LabelPrintOut = ({ data }) => {
  if (!data) return null;
  const totalQty = data.items.reduce((sum, item) => sum + item.packd_qty, 0);

  const formattedDetailUkuran = data.header.detail_ukuran
    ? data.header.detail_ukuran.replace(/\s+/g, ", ") // Ganti spasi dengan koma-spasi
    : "";

  return (
    <div className="label-print">
      <p className="print-top-no-packing">{data.header.pack_nomor}</p>
      <div className="print-barcode-area">
        <Barcode
          value={data.header.pack_nomor}
          width={2}
          height={106}
          displayValue={false}
          background="transparent"
          lineColor="#000000"
          margin={0}
          renderer="svg"
        />
      </div>
      <div className="print-middle-info">
        <span className="print-spk-no">{data.header.pack_spk_nomor}</span>
        <span className="print-qty">QTY: {totalQty}</span>
      </div>
      <p className="print-nama-spk">{data.header.pack_nama_spk || ""}</p>
      <p className="print-detail-ukuran">{formattedDetailUkuran}</p>
    </div>
  );
};

// === KOMPONEN HELPER UNTUK BATCH ===
const BatchLabelPrintOut = ({ dataArray }) => {
  if (!dataArray || !Array.isArray(dataArray)) return null;

  return (
    <div>
      {dataArray.map((data, index) => {
        // Validasi data sebelum render
        if (!data || !data.header || !data.items) {
          return (
            <div key={`batch-${index}`} className="batch-page">
              <p>Data tidak valid</p>
            </div>
          );
        }

        const totalQty = data.items.reduce(
          (sum, item) => sum + (item.packd_qty || 0),
          0
        );

        return (
          <div
            key={`batch-${index}-${data.header.pack_nomor}`}
            className="batch-page"
          >
            <div className="label-print">
              <p className="print-top-no-packing">{data.header.pack_nomor}</p>
              <div className="print-barcode-area">
                <Barcode
                  value={data.header.pack_nomor}
                  width={2}
                  height={106}
                  displayValue={false}
                  background="transparent"
                  lineColor="#000000"
                  margin={0}
                  renderer="svg"
                />
              </div>
              <div className="print-middle-info">
                <span className="print-spk-no">
                  {data.header.pack_spk_nomor || ""}
                </span>
                <span className="print-qty">QTY: {totalQty}</span>
              </div>
              <p className="print-nama-spk">
                {data.header.pack_nama_spk || ""}
              </p>
              <p className="print-detail-ukuran">
                {data.header.detail_ukuran
                  ? data.header.detail_ukuran.replace(/\s+/g, ", ")
                  : ""}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const HistoryItem = ({ item, onSelect, isSelected, onToggleSelect }) => {
  // Validasi item
  if (!item || !item.pack_nomor) {
    return null;
  }

  return (
    <div className={`history-item ${isSelected ? "selected" : ""}`}>
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => onToggleSelect(item.pack_nomor)}
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
      <button className="view-button" onClick={() => onSelect(item.pack_nomor)}>
        Lihat & Cetak
      </button>
    </div>
  );
};

// --- KOMPONEN UTAMA HALAMAN HOME ---

const HomePage = () => {
  const { logout, apiClient, token } = useAuth();

  const [packNomor, setPackNomor] = useState("");
  const [history, setHistory] = useState([]);
  const [packingData, setPackingData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isPrinting, setIsPrinting] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [startDate, setStartDate] = useState(formatDate(new Date()));
  const [endDate, setEndDate] = useState(formatDate(new Date()));
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
  });

  const labelRef = useRef(null);
  const batchLabelRef = useRef(null);

  // Efek untuk autocomplete pencarian
  useEffect(() => {
    if (packNomor.length < 3) {
      setSearchResults([]);
      return;
    }
    const handler = setTimeout(async () => {
      try {
        const response = await apiClient.get(
          `/packing/search?term=${packNomor}`
        );
        setSearchResults(response.data.data.items);
      } catch (err) {
        console.error("Gagal mencari:", err);
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [packNomor, apiClient]);

  const handleSelectSearchResult = (nomor) => {
    setPackNomor(nomor);
    setSearchResults([]);
    handleSearchAndPrint(nomor); // Langsung cari detail setelah dipilih
  };

  // Efek untuk memuat riwayat
  const fetchHistory = useCallback(
    async (page = 1) => {
      if (!token) return;
      setIsLoading(true);
      setError("");
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
      } finally {
        setIsLoading(false);
      }
    },
    [token, startDate, endDate, apiClient]
  );

  useEffect(() => {
    fetchHistory(1); // Muat halaman 1 saat filter berubah
  }, [fetchHistory]);

  const handleFilter = () => {
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
    fetchHistory(1);
  };

  // Fungsi untuk mengambil detail packing
  const handleSearchAndPrint = useCallback(
    async (nomorUntukDicari) => {
      if (!nomorUntukDicari) return;
      setIsLoading(true);
      setError("");
      setPackingData(null); // Reset preview lama
      try {
        const response = await apiClient.get(
          `/packing/${encodeURIComponent(nomorUntukDicari)}`
        );
        setPackingData(response.data.data);
      } catch (err) {
        setError("Nomor Packing tidak ditemukan.", err);
      } finally {
        setIsLoading(false);
      }
    },
    [apiClient]
  );

  const handleSearchFromInput = () => {
    handleSearchAndPrint(packNomor);
  };

  // Logika untuk mencetak
  const handlePrint = useReactToPrint({
    contentRef: labelRef,
    documentTitle: "Label Packing",
    onAfterPrint: () => setIsPrinting(false),
  });

  useEffect(() => {
    if (isPrinting && packingData) {
      handlePrint();
    }
  }, [isPrinting, packingData, handlePrint]);

  const triggerPrint = () => {
    setIsPrinting(true);
  };

  // === FUNGSI UNTUK BATCH MODE ===
  const toggleSelectItem = (packNomor) => {
    setSelectedItems((prev) =>
      prev.includes(packNomor)
        ? prev.filter((item) => item !== packNomor)
        : [...prev, packNomor]
    );
  };

  const toggleSelectAll = () => {
    if (selectedItems.length === history.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(history.map((item) => item.pack_nomor));
    }
  };

  const handleBatchPrint = useReactToPrint({
    contentRef: batchLabelRef,
    documentTitle: "Batch Label Packing",
    onAfterPrint: () => {
      setSelectedItems([]);
      setIsBatchMode(false);
      setPackingData(null);
    },
  });

  const triggerBatchPrint = async () => {
    if (selectedItems.length === 0) {
      setError("Pilih minimal 1 item untuk dicetak");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // PENTING: Fetch dalam urutan selectedItems (jangan random)
      const allPackingData = await Promise.all(
        selectedItems.map((nomor) =>
          apiClient
            .get(`/packing/${encodeURIComponent(nomor)}`)
            .then((res) => res.data.data)
            .catch((err) => {
              console.error(`Gagal fetch ${nomor}:`, err);
              return null;
            })
        )
      );

      // Filter out null data TAPI MAINTAIN URUTAN
      const validData = allPackingData
        .map((data, idx) => ({ data, originalIdx: idx }))
        .filter(({ data }) => data !== null)
        .map(({ data }) => data);

      if (validData.length === 0) {
        setError("Tidak ada data yang berhasil dimuat");
        setIsLoading(false);
        return;
      }

      console.log(
        "Data urutan:",
        validData.map((d) => d.header.pack_nomor)
      );

      // Set data dan mode batch
      setPackingData(validData);
      setIsBatchMode(true);
      setIsLoading(false);
    } catch (err) {
      setError("Gagal memuat data untuk batch print: " + err.message);
      setIsLoading(false);
    }
  };

  // === TAMBAHKAN useEffect INI ===
  useEffect(() => {
    if (
      isBatchMode &&
      packingData &&
      Array.isArray(packingData) &&
      batchLabelRef.current
    ) {
      // Delay untuk memastikan DOM sudah terupdate
      const timer = setTimeout(() => {
        handleBatchPrint();
      }, 200);

      return () => clearTimeout(timer);
    }
  }, [isBatchMode, packingData, handleBatchPrint]);

  return (
    <div className="container">
      <div className="main-header">
        <h1>Antrian Cetak Label</h1>
        <button onClick={logout} className="logout-button">
          Logout
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

      {error && <p className="error-text">{error}</p>}

      {history.length > 0 && (
        <div className="batch-controls">
          <label className="select-all-checkbox">
            <input
              type="checkbox"
              checked={
                selectedItems.length === history.length && history.length > 0
              }
              onChange={toggleSelectAll}
            />
            <span>Pilih Semua</span>
          </label>
          {selectedItems.length > 0 && (
            <div className="batch-actions">
              <span>{selectedItems.length} item dipilih</span>
              <button
                className="batch-print-button"
                onClick={triggerBatchPrint}
                disabled={isLoading}
              >
                {isLoading
                  ? "Memproses..."
                  : `Cetak ${selectedItems.length} Label`}
              </button>
            </div>
          )}
        </div>
      )}

      {history && history.length > 0 ? (
        history.map((item) => {
          // Tambahkan key yang unik dan validasi
          if (!item || !item.pack_nomor) return null;

          return (
            <HistoryItem
              key={`history-${item.pack_nomor}-${item.pack_tanggal}`}
              item={item}
              onSelect={handleSearchAndPrint}
              isSelected={selectedItems.includes(item.pack_nomor)}
              onToggleSelect={toggleSelectItem}
            />
          );
        })
      ) : (
        <p className="empty-history-text">Riwayat packing kosong.</p>
      )}

      <div className="pagination-controls">
        <button
          onClick={() => fetchHistory((pagination?.currentPage || 1) - 1)}
          disabled={(pagination?.currentPage || 1) <= 1 || isLoading}
        >
          Sebelumnya
        </button>
        <span>
          Halaman {pagination?.currentPage || 1} dari{" "}
          {pagination?.totalPages || 1}
        </span>
        <button
          onClick={() => fetchHistory((pagination?.currentPage || 1) + 1)}
          disabled={
            (pagination?.currentPage || 1) >= (pagination?.totalPages || 1) ||
            isLoading
          }
        >
          Berikutnya
        </button>
      </div>

      <div className="search-box">
        <input
          type="text"
          value={packNomor}
          onChange={(e) => setPackNomor(e.target.value)}
          placeholder="Atau cari Nomor Packing manual..."
          onKeyDown={(e) => e.key === "Enter" && handleSearchFromInput()}
        />
        <button onClick={handleSearchFromInput} disabled={isLoading}>
          {isLoading ? "Mencari..." : "Cari"}
        </button>
      </div>

      {searchResults.length > 0 && (
        <ul className="search-results">
          {searchResults.map((result) => (
            <li
              key={result.pack_nomor}
              onClick={() => handleSelectSearchResult(result.pack_nomor)}
            >
              {result.pack_nomor}{" "}
              <span className="spk-result">({result.pack_spk_nomor})</span>
            </li>
          ))}
        </ul>
      )}

      <div style={{ display: "none" }}>
        <div ref={batchLabelRef}>
          {isBatchMode && packingData && Array.isArray(packingData) && (
            <BatchLabelPrintOut dataArray={packingData} />
          )}
        </div>
      </div>

      {/* Single print modal tetap seperti sebelumnya */}
      {packingData && !Array.isArray(packingData) && (
        <div className="print-preview-overlay">
          <div className="print-preview-modal">
            <div className="print-header">
              <h3>Preview Label</h3>
              <button
                onClick={() => {
                  setPackingData(null);
                  setIsBatchMode(false);
                }}
                className="close-button"
              >
                &times;
              </button>
            </div>

            <div className="label-preview">
              <LabelPrintOut data={packingData} />
            </div>

            <div style={{ display: "none" }}>
              <div ref={labelRef}>
                <LabelPrintOut data={packingData} />
              </div>
            </div>

            <button className="print-button" onClick={triggerPrint}>
              Cetak Label
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;
