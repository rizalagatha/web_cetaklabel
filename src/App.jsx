import React, { useState, useRef, useEffect, useCallback } from "react";
import axios from "axios";
import Barcode from "react-barcode";
import feather from "feather-icons";
import { useReactToPrint } from "react-to-print";
import LoginPage from "./LoginPage";
import "./App.css";

const apiClient = axios.create({
  baseURL: "http://103.94.238.252:3000/api",
});

const HistoryItem = ({ item, onSelect }) => (
  <div className="history-item">
    <div className="history-info">
      <span className="history-pack-nomor">{item.pack_nomor}</span>
      <span className="history-spk-nomor">SPK: {item.pack_spk_nomor}</span>
      <span className="history-tanggal">
        {new Date(item.pack_tanggal).toLocaleDateString("id-ID")}
      </span>
    </div>
    <button className="view-button" onClick={() => onSelect(item.pack_nomor)}>
      Lihat & Cetak
    </button>
  </div>
);

function App() {
  const [token, setToken] = useState(localStorage.getItem("authToken"));

  const [packNomor, setPackNomor] = useState("");
  const [history, setHistory] = useState([]);
  const [packingData, setPackingData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isPrinting] = useState(false);
  const [searchResults, setSearchResults] = useState([]);

  const labelRef = useRef(null);

  useEffect(() => {
    if (packNomor.length < 3) {
      // Mulai mencari setelah 3 karakter
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
    }, 500); // Jeda 0.5 detik (debounce)

    return () => clearTimeout(handler);
  }, [packNomor]); // Dijalankan setiap kali packNomor berubah

  const handleSelectSearchResult = (nomor) => {
    setPackNomor(nomor);
    setSearchResults([]); // Sembunyikan hasil setelah dipilih
    // handleSearch(); // Bisa juga langsung trigger pencarian detail
  };

  useEffect(() => {
    if (token) {
      apiClient.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      localStorage.setItem("authToken", token);
    } else {
      delete apiClient.defaults.headers.common["Authorization"];
      localStorage.removeItem("authToken");
    }
  }, [token]);

  const fetchHistory = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      // Panggil API history yang sudah ada
      const response = await apiClient.get("/packing/history");
      setHistory(response.data.data);
    } catch (err) {
      setError("Gagal memuat riwayat packing.", err);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  // Ambil data riwayat saat komponen pertama kali dimuat
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleLoginSuccess = (newToken) => {
    setToken(newToken);
  };
  const handleLogout = () => {
    setToken(null);
    setHistory([]); // Kosongkan riwayat saat logout
    setPackingData(null);
  };

  const handleSearchAndPrint = useCallback(async (nomorUntukDicari) => {
    if (!nomorUntukDicari) return;
    setIsLoading(true);
    setError("");
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
  }, []);

  const handleSearchFromInput = () => {
    handleSearchAndPrint(packNomor); // Panggil fungsi utama dengan nomor dari state
  };

  useEffect(() => {
    // Memastikan library 'feather' sudah dimuat dari index.html
    if (typeof feather !== "undefined") {
      feather.replace();
    }
  });

  const handlePrint = useReactToPrint({
    content: () => labelRef,
    documentTitle: "Label Packing",
    onAfterPrint: () => {
      // --- TAMBAHKAN FEEDBACK SUKSES DI SINI ---
      alert("Berhasil mengirim ke antrian cetak!");
      // Kita gunakan alert() sederhana untuk web
    },
  });

  useEffect(() => {
    if (isPrinting && packingData) {
      handlePrint();
    }
  }, [isPrinting, packingData, handlePrint]);

  if (!token) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // Komponen LabelPrintOut ini akan digunakan untuk cetak dan preview
  const LabelPrintOut = ({ data }) => {
    if (!data) return null;

    const totalQty = data.items.reduce((sum, item) => sum + item.packd_qty, 0);

    return (
      <div className="label-print">
        <p className="print-top-no-packing">{data.header.pack_nomor}</p>

        <div className="print-barcode-area">
          <Barcode
            value={data.header.pack_nomor}
            width={2}
            height={60}
            displayValue={false}
            background="transparent"
            lineColor="#000000"
          />
        </div>

        <div className="print-middle-info">
          <span className="print-spk-no">{data.header.pack_spk_nomor}</span>
          <span className="print-qty">QTY: {totalQty}</span>
        </div>

        {/* Ambil nama SPK langsung dari data header */}
        <p className="print-nama-spk">{data.header.pack_nama_spk || ""}</p>

        {/* Ambil detail ukuran langsung dari data header */}
        <p className="print-detail-ukuran">({data.header.detail_ukuran})</p>
      </div>
    );
  };

  return (
    <div className="container no-print">
      <div className="main-header">
        <h1>Cetak Label Packing</h1>
        <button onClick={handleLogout} className="logout-button">
          Logout
        </button>
      </div>

      <div className="toolbar">
        <button onClick={fetchHistory} disabled={isLoading}>
          {isLoading ? "Memuat..." : "Refresh Daftar"}
        </button>
      </div>

      {/* Daftar Riwayat Packing */}
      <div className="history-list">
        {isLoading && history.length === 0 ? (
          <p>Memuat riwayat...</p>
        ) : history.length > 0 ? ( // -> Cek jika history punya data
          history.map((item) => (
            <HistoryItem
              key={item.pack_nomor}
              item={item}
              onSelect={handleSearchAndPrint}
            />
          ))
        ) : (
          !isLoading && (
            <p className="empty-history-text">Riwayat packing kosong.</p>
          ) // -> Tampilan jika benar-benar kosong
        )}
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

      {error && (
        <div className="error-box">
          <i data-feather="alert-triangle"></i>
          <span>{error}</span>
        </div>
      )}

      {packingData && (
        <div className="label-container">
          {/* Konten untuk dicetak, TIDAK perlu disembunyikan */}
          <div ref={labelRef}>
            <LabelPrintOut data={packingData} />
          </div>

          <button className="print-button" onClick={handlePrint}>
            Cetak Label
          </button>

          <h3 className="preview-title">Preview Label:</h3>
          <div className="label-preview">
            <LabelPrintOut data={packingData} />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
