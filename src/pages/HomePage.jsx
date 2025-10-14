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
  if (!data) return null;

  const totalQty = data.items.reduce((sum, item) => sum + item.packd_qty, 0);
  const detailUkuranText = data.header.detail_ukuran || "";
  const nomorPO = data.header.nomor_po || "N/A";

  return (
    <div ref={ref} className="label-print">
      <div className="print-top-section">
        {/* Bagian Kiri: QR Code */}
        <div className="qr-code-box">
          <QRCodeCanvas
            value={data.header.pack_nomor}
            size={70} // QR Code lebih kecil
            bgColor={"#ffffff"}
            fgColor={"#000000"}
            level={"L"}
            includeMargin={true}
          />
        </div>
        {/* Bagian Kanan: Info SPK & QTY */}
        <div className="print-info-column">
          <span className="print-packing-no">{data.header.pack_nomor}</span>
          <span className="print-spk-no">{data.header.pack_spk_nomor}</span>
          <span className="print-nomor-po">{nomorPO}</span>
          <span className="print-qty">TOTAL QTY: {totalQty}</span>
        </div>
      </div>

      {/* Bagian Bawah: Nama SPK & Detail Ukuran */}
      <div className="print-bottom-section">
        <p className="print-nama-spk">
          {data.header.pack_nama_spk || "Nama SPK Tidak Tersedia"}
        </p>
        <p className="print-detail-ukuran">{detailUkuranText}</p>
      </div>
    </div>
  );
});

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

const HistoryItem = ({ item, onSelect }) => (
  <div className="history-item">
    <div className="history-info">
      <span className="history-pack-nomor">{item.pack_nomor}</span>
      <span className="history-spk-nomor">SPK: {item.pack_spk_nomor}</span>
    </div>
    <span className="history-tanggal">
      {new Date(item.pack_tanggal).toLocaleDateString("id-ID")}
    </span>
    <button className="view-button" onClick={() => onSelect(item.pack_nomor)}>
      Lihat & Cetak
    </button>
  </div>
);

// --- KOMPONEN UTAMA HALAMAN HOME ---

const HomePage = () => {
  const { logout, apiClient, token } = useAuth();

  const [history, setHistory] = useState([]);
  // const [packingData, setPackingData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [startDate, setStartDate] = useState(formatDate(new Date()));
  const [endDate, setEndDate] = useState(formatDate(new Date()));
  const [selectedPacks, setSelectedPacks] = useState(new Set());
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
  });

  // const labelRef = useRef(null);
  const batchPrintRef = useRef();

  useEffect(() => {
    feather.replace();
  }, []);

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

      {error && <p className="error-text">{error}</p>}

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
            <div key={item.pack_nomor} className="history-item">
              <input
                type="checkbox"
                checked={selectedPacks.has(item.pack_nomor)}
                onChange={(e) =>
                  handleSelectionChange(item.pack_nomor, e.target.checked)
                }
              />
              <div className="history-info">
                <span className="history-pack-nomor">{item.pack_nomor}</span>
                <span className="history-spk-nomor">
                  SPK: {item.pack_spk_nomor}
                </span>
              </div>
              <span className="history-tanggal">
                {new Date(item.pack_tanggal).toLocaleDateString("id-ID")}
              </span>
            </div>
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
    </div>
  );
};

export default HomePage;
