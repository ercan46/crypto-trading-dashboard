// GitHub Pages Crypto Dashboard - Ana JavaScript
console.log('🚀 GitHub Pages Crypto Dashboard başlatılıyor...');

// API URLs
const binanceFuturesApiUrl = 'https://fapi.binance.com/fapi/v1/klines';
const binanceFuturesExchangeInfoUrl = 'https://fapi.binance.com/fapi/v1/exchangeInfo';

// Global değişkenler
let currentTimeframe = '1h';
let currentTimeRange = 3;
let isUpdating = false;
let updateTimer = null;
let twMode = true;
let cryptoData = [];
let currentChartSymbol = '';
let currentSort = { column: 'buyPct', direction: 'desc' };
let autoRefreshInterval = null;
let isAutoRefresh = false;

// DOM elementleri
const statusElement = document.getElementById('status');
const lastUpdateElement = document.getElementById('lastUpdate');
const cryptoTableBody = document.getElementById('cryptoTableBody');
const chartContainer = document.getElementById('chartContainer');
const chartTitle = document.getElementById('chartTitle');
const statusLoader = document.getElementById('statusLoader');

// Sayfa yüklendiğinde başlat
window.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM yüklendi, GitHub Pages başlatılıyor...');
    updateStatus('GitHub Pages yükleniyor...');
    
    initializeEventListeners();
    setTimeout(initializeData, 1000);
});

function initializeEventListeners() {
    console.log('📡 Event listeners kuruluyor...');
    
    // Sıralama event listeners
    document.querySelectorAll('th.sortable').forEach(th => {
        th.addEventListener('click', function() {
            const column = this.getAttribute('data-sort');
            if (currentSort.column === column) {
                currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort.column = column;
                currentSort.direction = 'desc';
            }
            updateSortIndicators();
            renderTable();
        });
    });

    // Kontrol event listeners
    document.getElementById('refreshData').addEventListener('click', fetchData);
    document.getElementById('autoRefresh').addEventListener('click', toggleAutoRefresh);
    
    document.getElementById('timeframe').addEventListener('change', (e) => {
        currentTimeframe = e.target.value;
        fetchData();
    });
    
    document.getElementById('timeRange').addEventListener('change', (e) => {
        currentTimeRange = parseInt(e.target.value);
        fetchData();
    });
    
    document.getElementById('tw-mode').addEventListener('change', (e) => {
        twMode = e.target.checked;
        fetchData();
    });
    
    console.log('✅ Event listeners kuruldu');
}

async function initializeData() {
    updateStatus('GitHub Pages\'den semboller yükleniyor...');
    showLoader(true);
    
    try {
        console.log('📊 Binance sembollerini çekiyor...');
        const symbols = await fetchAllFuturesSymbols();
        console.log(`✅ ${symbols.length} sembol yüklendi`);
        
        // İlk 50 popüler sembol al
        cryptoData = symbols.slice(0, 50).map(symbol => ({
            ...symbol,
            lastPrice: 0,
            positivePct: null,
            negativePct: null,
            buyPct: null,
            sellPct: null,
            lastUpdate: null,
            lastStrongSignal: null,
            lastSignalStrength: null,
            lastSignalBarsAgo: null
        }));
        
        updateStatus(`${cryptoData.length} sembol hazır. GitHub Pages veriler çekiliyor...`);
        await fetchData();
        
    } catch (error) {
        console.error('❌ GitHub Pages başlatma hatası:', error);
        updateStatus('GitHub Pages başlatma hatası');
        showError(`Hata: ${error.message}`);
    } finally {
        showLoader(false);
    }
}

async function fetchAllFuturesSymbols() {
    try {
        console.log('📡 Binance API\'den semboller çekiliyor...');
        const response = await fetch(binanceFuturesExchangeInfoUrl);
        
        if (!response.ok) {
            throw new Error(`API Hatası: ${response.status}`);
        }
        
        const data = await response.json();
        
        return data.symbols
            .filter(s => s.symbol.endsWith('USDT') && s.status === 'TRADING')
            .map(s => ({
                symbol: s.symbol,
                baseAsset: s.baseAsset,
                quoteAsset: s.quoteAsset,
                market: 'Futures'
            }))
            .sort((a, b) => {
                // Popüler coinleri öne çıkar
                const popular = ['BTC', 'ETH', 'BNB', 'ADA', 'XRP', 'SOL', 'DOT', 'AVAX', 'MATIC', 'LINK', 'LTC', 'UNI', 'ATOM'];
                const aIndex = popular.indexOf(a.baseAsset);
                const bIndex = popular.indexOf(b.baseAsset);
                
                if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
                if (aIndex !== -1) return -1;
                if (bIndex !== -1) return 1;
                return a.symbol.localeCompare(b.symbol);
            });
            
    } catch (error) {
        console.error('❌ Sembol çekme hatası:', error);
        throw error;
    }
}

async function fetchData() {
    if (isUpdating) return;
    
    isUpdating = true;
    updateStatus('GitHub Pages veriler güncelleniyor...');
    showLoader(true);
    
    try {
        console.log('🔄 Veri güncelleme başlatıldı...');
        const batchSize = 8; // Paralel istek sayısını sınırla
        const batches = [];
        
        for (let i = 0; i < cryptoData.length; i += batchSize) {
            batches.push(cryptoData.slice(i, i + batchSize));
        }
        
        let processed = 0;
        for (const batch of batches) {
            const promises = batch.map(crypto => fetchCryptoData(crypto.symbol));
            const results = await Promise.allSettled(promises);
            
            results.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value) {
                    const crypto = batch[index];
                    Object.assign(crypto, result.value);
                }
                processed++;
            });
            
            updateStatus(`GitHub Pages: ${processed}/${cryptoData.length} sembol işlendi...`);
            
            // Her batch sonrası kısa bekleme (rate limiting için)
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        console.log('✅ Tüm veriler güncellendi');
        renderTable();
        
        if (currentChartSymbol) {
            showCryptoChart(currentChartSymbol);
        }
        
        updateStatus('GitHub Pages veriler güncellendi ✅');
        lastUpdateElement.textContent = new Date().toLocaleTimeString();
        
    } catch (error) {
        console.error('❌ Veri güncelleme hatası:', error);
        updateStatus('GitHub Pages güncelleme hatası ❌');
        showError(`Hata: ${error.message}`);
    } finally {
        isUpdating = false;
        showLoader(false);
        
        // Otomatik yenileme zamanlayıcısı
        clearTimeout(updateTimer);
        if (isAutoRefresh) {
            updateTimer = setTimeout(fetchData, 30000); // 30 saniye
        }
    }
}

async function fetchCryptoData(symbol) {
    try {
        const candleLimit = getRequiredCandles();
        const url = `${binanceFuturesApiUrl}?symbol=${symbol}&interval=${currentTimeframe}&limit=${candleLimit}`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`${symbol}: ${response.status}`);
        
        const data = await response.json();
        if (!data || data.length === 0) return null;
        
        // Verileri parse et
        const timestamps = data.map(candle => new Date(candle[0]));
        const opens = data.map(candle => parseFloat(candle[1]));
        const highs = data.map(candle => parseFloat(candle[2]));
        const lows = data.map(candle => parseFloat(candle[3]));
        const closes = data.map(candle => parseFloat(candle[4]));
        const volumes = data.map(candle => parseFloat(candle[5]));
        
        const lastPrice = closes[closes.length - 1];
        const lastUpdate = timestamps[timestamps.length - 1];
        
        // Volume Profile hesapla
        const vpResults = calculateVolumeProfile(opens, highs, lows, closes, volumes);
        
        // Sinyalleri tespit et
        const signals = detectSignals(timestamps, highs, lows, vpResults.buyPct, vpResults.sellPct);
        
        // Son güçlü sinyali bul
        let lastStrongSignal = null;
        let lastSignalStrength = null;
        let lastSignalBarsAgo = null;
        
        const allStrongSignals = [
            ...signals.strongBuySignals.map(s => ({ ...s, type: 'Güçlü Alım' })),
            ...signals.strongSellSignals.map(s => ({ ...s, type: 'Güçlü Satım' }))
        ].sort((a, b) => b.time - a.time);
        
        if (allStrongSignals.length > 0) {
            const latestSignal = allStrongSignals[0];
            lastStrongSignal = latestSignal.type;
            lastSignalStrength = latestSignal.guc;
            
            const signalIndex = timestamps.findIndex(t => t.getTime() === latestSignal.time.getTime());
            lastSignalBarsAgo = signalIndex !== -1 ? timestamps.length - 1 - signalIndex : null;
        }
        
        return {
            lastPrice,
            positivePct: vpResults.positivePct[vpResults.positivePct.length - 1],
            negativePct: vpResults.negativePct[vpResults.negativePct.length - 1],
            buyPct: vpResults.buyPct[vpResults.buyPct.length - 1],
            sellPct: vpResults.sellPct[vpResults.sellPct.length - 1],
            lastUpdate: lastUpdate.toLocaleTimeString(),
            lastStrongSignal,
            lastSignalStrength,
            lastSignalBarsAgo
        };
        
    } catch (error) {
        console.warn(`⚠️ ${symbol} veri hatası:`, error.message);
        return null;
    }
}

// Devamında Volume Profile hesaplama fonksiyonları...
// (Kod çok uzun olduğu için parçalar halinde vereceğim)

// Yardımcı fonksiyonlar
function updateStatus(message) {
    statusElement.textContent = message;
}

function showLoader(show) {
    statusLoader.style.display = show ? 'inline-block' : 'none';
}

function showError(message) {
    console.error('❌', message);
}

console.log('✅ GitHub Pages Dashboard JavaScript yüklendi');
