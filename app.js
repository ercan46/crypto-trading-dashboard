// GitHub Pages Crypto Dashboard - Optimize Edilmiş Kod
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

// Sayfa yüklendiğinde başlat
window.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM yüklendi, GitHub Pages başlatılıyor...');
    updateStatus('GitHub Pages başlatılıyor...');
    
    initializeEventListeners();
    setTimeout(initializeData, 2000); // 2 saniye bekle
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
    document.getElementById('refreshData').addEventListener('click', () => {
        if (!isUpdating) fetchData();
    });
    
    // Otomatik refresh butonu ekle
    const refreshBtn = document.getElementById('refreshData');
    const autoBtn = document.createElement('button');
    autoBtn.textContent = '⚡ Otomatik';
    autoBtn.id = 'autoRefresh';
    autoBtn.addEventListener('click', toggleAutoRefresh);
    refreshBtn.parentNode.insertBefore(autoBtn, refreshBtn.nextSibling);
    
    document.getElementById('timeframe').addEventListener('change', (e) => {
        currentTimeframe = e.target.value;
        if (!isUpdating) fetchData();
    });
    
    document.getElementById('timeRange').addEventListener('change', (e) => {
        currentTimeRange = parseInt(e.target.value);
        if (!isUpdating) fetchData();
    });
    
    document.getElementById('tw-mode').addEventListener('change', (e) => {
        twMode = e.target.checked;
        if (!isUpdating) fetchData();
    });
    
    console.log('✅ Event listeners kuruldu');
}

async function initializeData() {
    updateStatus('GitHub Pages semboller yükleniyor...');
    
    try {
        console.log('📊 Binance sembollerini çekiyor...');
        const symbols = await fetchAllFuturesSymbols();
        console.log(`✅ ${symbols.length} sembol yüklendi`);
        
        // Sadece 20 popüler sembol al (performans için)
        const popularSymbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'XRPUSDT', 
                               'SOLUSDT', 'DOTUSDT', 'AVAXUSDT', 'MATICUSDT', 'LINKUSDT',
                               'LTCUSDT', 'UNIUSDT', 'ATOMUSDT', 'NEARUSDT', 'ALGOUSDT',
                               'VETUSDT', 'ICPUSDT', 'FILUSDT', 'TRXUSDT', 'ETCUSDT'];
        
        cryptoData = symbols
            .filter(s => popularSymbols.includes(s.symbol))
            .slice(0, 20)
            .map(symbol => ({
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
    }
}

async function fetchAllFuturesSymbols() {
    try {
        console.log('📡 Binance API\'den semboller çekiliyor...');
        
        // Rate limiting için retry mekanizması
        let retryCount = 0;
        while (retryCount < 3) {
            try {
                const response = await fetch(binanceFuturesExchangeInfoUrl);
                
                if (response.status === 429) {
                    console.warn('Rate limit, 2 saniye bekleniyor...');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    retryCount++;
                    continue;
                }
                
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
                        const popular = ['BTC', 'ETH', 'BNB', 'ADA', 'XRP', 'SOL', 'DOT', 'AVAX', 'MATIC', 'LINK'];
                        const aIndex = popular.indexOf(a.baseAsset);
                        const bIndex = popular.indexOf(b.baseAsset);
                        
                        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
                        if (aIndex !== -1) return -1;
                        if (bIndex !== -1) return 1;
                        return a.symbol.localeCompare(b.symbol);
                    });
            } catch (fetchError) {
                retryCount++;
                if (retryCount >= 3) throw fetchError;
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
            
    } catch (error) {
        console.error('❌ Sembol çekme hatası:', error);
        throw error;
    }
}

async function fetchData() {
    if (isUpdating) {
        console.log('⚠️ Zaten güncelleme yapılıyor, atlanıyor...');
        return;
    }
    
    isUpdating = true;
    updateStatus('GitHub Pages veriler güncelleniyor...');
    
    try {
        console.log('🔄 Veri güncelleme başlatıldı...');
        
        // Sıralı olarak işle (paralel değil)
        let processed = 0;
        for (const crypto of cryptoData) {
            try {
                const result = await fetchCryptoData(crypto.symbol);
                if (result) {
                    Object.assign(crypto, result);
                    processed++;
                    updateStatus(`GitHub Pages: ${processed}/${cryptoData.length} sembol işlendi...`);
                }
                
                // Her istek arasında bekleme (rate limiting için)
                await new Promise(resolve => setTimeout(resolve, 150));
                
            } catch (cryptoError) {
                console.warn(`⚠️ ${crypto.symbol} atlandı:`, cryptoError.message);
            }
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
        
        // Otomatik yenileme zamanlayıcısı
        clearTimeout(updateTimer);
        if (isAutoRefresh) {
            updateTimer = setTimeout(fetchData, 60000); // 60 saniye
        }
    }
}

async function fetchCryptoData(symbol) {
    try {
        const candleLimit = getRequiredCandles();
        const url = `${binanceFuturesApiUrl}?symbol=${symbol}&interval=${currentTimeframe}&limit=${candleLimit}`;
        
        // Rate limiting için retry
        let retryCount = 0;
        while (retryCount < 2) {
            try {
                const response = await fetch(url);
                
                if (response.status === 429) {
                    console.warn(`Rate limit ${symbol}, bekleniyor...`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    retryCount++;
                    continue;
                }
                
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
                
            } catch (fetchError) {
                retryCount++;
                if (retryCount >= 2) throw fetchError;
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
    } catch (error) {
        console.warn(`⚠️ ${symbol} veri hatası:`, error.message);
        return null;
    }
}

// Volume Profile hesaplama fonksiyonu
function calculateVolumeProfile(opens, highs, lows, closes, volumes) {
    let cumulativePositive = 0;
    let cumulativeNegative = 0;
    let cumulativeBuy = 0;
    let cumulativeSell = 0;
    
    const avgVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
    
    const positivePct = new Array(closes.length).fill(50);
    const negativePct = new Array(closes.length).fill(50);
    const buyPct = new Array(closes.length).fill(50);
    const sellPct = new Array(closes.length).fill(50);
    
    for (let i = 1; i < closes.length; i++) {
        const priceChange = closes[i] - closes[i-1];
        
        // Fiyat hareketi birikimi
        if (priceChange > 0) {
            cumulativePositive += priceChange;
        } else if (priceChange < 0) {
            cumulativeNegative += Math.abs(priceChange);
        }
        
        // Volume bazlı alım/satım baskısı
        const priceRange = Math.max(0.0001, highs[i] - lows[i]);
        const buyVolume = ((closes[i] - lows[i]) / priceRange) * volumes[i];
        const sellVolume = ((highs[i] - closes[i]) / priceRange) * volumes[i];
        
        cumulativeBuy += buyVolume;
        cumulativeSell += sellVolume;
        
        // Yüzde hesaplamaları
        const totalMove = Math.max(0.0001, cumulativePositive + cumulativeNegative);
        const totalVolume = Math.max(0.0001, cumulativeBuy + cumulativeSell);
        
        positivePct[i] = (cumulativePositive / totalMove) * 100;
        negativePct[i] = (cumulativeNegative / totalMove) * 100;
        buyPct[i] = (cumulativeBuy / totalVolume) * 100;
        sellPct[i] = (cumulativeSell / totalVolume) * 100;
    }
    
    // TradingView modu optimizasyonu
    if (twMode) {
        const significantEvents = [];
        
        for (let i = 5; i < closes.length; i++) {
            const recentPriceChange = Math.abs(closes[i] - closes[i-5]) / closes[i-5];
            const volumeRatio = volumes[i] / avgVolume;
            
            if ((recentPriceChange > 0.02 && volumeRatio > 1.5) || volumeRatio > 2.0) {
                const direction = closes[i] > closes[i-5] ? 'buy' : 'sell';
                const magnitude = Math.min(3.0, 1.0 + recentPriceChange * 2);
                significantEvents.push({ index: i, direction, magnitude });
            }
        }
        
        // Olayların etkisini uygula
        significantEvents.forEach(event => {
            const influenceRange = Math.min(15, Math.max(5, Math.floor(event.magnitude * 6)));
            
            for (let j = Math.max(0, event.index - influenceRange); 
                 j <= Math.min(closes.length - 1, event.index + influenceRange); j++) {
                
                const distance = Math.abs(j - event.index) / influenceRange;
                const effect = (1 - distance) * event.magnitude;
                
                if (event.direction === 'buy') {
                    buyPct[j] = Math.min(100, buyPct[j] + effect * 6);
                    positivePct[j] = Math.min(100, positivePct[j] + effect * 6);
                    sellPct[j] = Math.max(0, sellPct[j] - effect * 3);
                    negativePct[j] = Math.max(0, negativePct[j] - effect * 3);
                } else {
                    sellPct[j] = Math.min(100, sellPct[j] + effect * 6);
                    negativePct[j] = Math.min(100, negativePct[j] + effect * 6);
                    buyPct[j] = Math.max(0, buyPct[j] - effect * 3);
                    positivePct[j] = Math.max(0, positivePct[j] - effect * 3);
                }
            }
        });
    }
    
    return { positivePct, negativePct, buyPct, sellPct };
}

// Sinyal tespit fonksiyonu
function detectSignals(timestamps, highs, lows, buyPct, sellPct) {
    const buySignals = [];
    const sellSignals = [];
    const strongBuySignals = [];
    const strongSellSignals = [];
    
    if (!buyPct || !sellPct || buyPct.length !== timestamps.length) {
        return { buySignals, sellSignals, strongBuySignals, strongSellSignals };
    }
    
    // Güçlü sinyal tespiti (%70 üzeri)
    for (let i = 1; i < timestamps.length; i++) {
        if (buyPct[i] > 70 && buyPct[i-1] <= 70 && buyPct[i] > sellPct[i]) {
            const guc = ((buyPct[i] - 70) / 30) * 10; // 0-10 skala
            strongBuySignals.push({
                time: timestamps[i],
                value: lows[i] * 0.996,
                guc: guc
            });
        } else if (sellPct[i] > 70 && sellPct[i-1] <= 70 && sellPct[i] > buyPct[i]) {
            const guc = ((sellPct[i] - 70) / 30) * 10; // 0-10 skala
            strongSellSignals.push({
                time: timestamps[i],
                value: highs[i] * 1.004,
                guc: guc
            });
        }
    }
    
    return { buySignals, sellSignals, strongBuySignals, strongSellSignals };
}

// Tablo render fonksiyonu
function renderTable() {
    cryptoTableBody.innerHTML = '';
    
    if (cryptoData.length === 0) {
        cryptoTableBody.innerHTML = '<tr><td colspan="11" style="text-align: center;">Veri bulunamadı</td></tr>';
        return;
    }
    
    // Sıralama
    cryptoData.sort((a, b) => {
        let valueA = a[currentSort.column];
        let valueB = b[currentSort.column];
        
        if (valueA === undefined || valueA === null) return 1;
        if (valueB === undefined || valueB === null) return -1;
        
        if (typeof valueA === 'string') {
            valueA = valueA.toUpperCase();
            valueB = valueB.toUpperCase();
        }
        
        if (currentSort.direction === 'asc') {
            return valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
        } else {
            return valueA > valueB ? -1 : valueA < valueB ? 1 : 0;
        }
    });
    
    cryptoData.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong style="color: #58a6ff;">${item.symbol}</strong></td>
            <td><span class="futures-indicator"></span>${item.market}</td>
            <td style="font-family: monospace; color: #ffa657;">${formatPrice(item.lastPrice)}</td>
            <td><span class="percentage-cell positive">
                ${item.positivePct !== null ? item.positivePct.toFixed(1) + '%' : '-'}
            </span></td>
            <td><span class="percentage-cell negative">
                ${item.negativePct !== null ? item.negativePct.toFixed(1) + '%' : '-'}
            </span></td>
            <td><span class="percentage-cell buy">
                ${item.buyPct !== null ? item.buyPct.toFixed(1) + '%' : '-'}
            </span></td>
            <td><span class="percentage-cell sell">
                ${item.sellPct !== null ? item.sellPct.toFixed(1) + '%' : '-'}
            </span></td>
            <td>${item.lastUpdate || '-'}</td>
            <td class="signal-cell ${item.lastStrongSignal === 'Güçlü Satım' ? 'sell' : ''}">
                ${item.lastStrongSignal || '-'}
            </td>
            <td class="signal-cell">
                ${item.lastSignalStrength !== null ? item.lastSignalStrength.toFixed(1) : '-'}
            </td>
            <td class="signal-cell">
                ${item.lastSignalBarsAgo !== null ? item.lastSignalBarsAgo : '-'}
            </td>
        `;
        
        row.addEventListener('click', () => {
            showCryptoChart(item.symbol);
            currentChartSymbol = item.symbol;
        });
        
        cryptoTableBody.appendChild(row);
    });
}

// Grafik göster fonksiyonu
async function showCryptoChart(symbol) {
    chartTitle.textContent = `${symbol} - GitHub Pages %VP (${currentTimeRange} Gün, ${currentTimeframe})`;
    chartContainer.style.display = 'block';
    
    try {
        updateStatus(`${symbol} grafik GitHub\'dan yükleniyor...`);
        
        const candleLimit = getRequiredCandles();
        const response = await fetch(`${binanceFuturesApiUrl}?symbol=${symbol}&interval=${currentTimeframe}&limit=${candleLimit}`);
        
        if (!response.ok) throw new Error(`API Hatası: ${response.status}`);
        
        const data = await response.json();
        if (!data || data.length === 0) throw new Error('Veri alınamadı');
        
        // Verileri parse et
        const timestamps = data.map(candle => new Date(candle[0]));
        const opens = data.map(candle => parseFloat(candle[1]));
        const highs = data.map(candle => parseFloat(candle[2]));
        const lows = data.map(candle => parseFloat(candle[3]));
        const closes = data.map(candle => parseFloat(candle[4]));
        const volumes = data.map(candle => parseFloat(candle[5]));
        
        const vpResults = calculateVolumeProfile(opens, highs, lows, closes, volumes);
        
        createChart(timestamps, opens, highs, lows, closes, 
                   vpResults.positivePct, vpResults.negativePct, 
                   vpResults.buyPct, vpResults.sellPct, symbol);
        
        updateStatus(`${symbol} grafik yüklendi ✅`);
        
    } catch (error) {
        console.error('Grafik hatası:', error);
        updateStatus('Grafik yüklenemedi ❌');
        showError(`Grafik Hatası: ${error.message}`);
    }
}

// Grafik oluştur fonksiyonu
function createChart(timestamps, opens, highs, lows, closes, positivePct, negativePct, buyPct, sellPct, symbol) {
    // Plotly grafiklerini temizle
    Plotly.purge('chartUpper');
    Plotly.purge('chartLower');
    
    const signals = detectSignals(timestamps, highs, lows, buyPct, sellPct);
    
    // Üst grafik: Candlestick + Sinyaller
    const candlestickTrace = {
        x: timestamps,
        open: opens,
        high: highs,
        low: lows,
        close: closes,
        type: 'candlestick',
        name: 'Fiyat',
        increasing: { line: { color: '#26a69a' } },
        decreasing: { line: { color: '#ef5350' } }
    };
    
    const strongBuyTrace = {
        x: signals.strongBuySignals.map(s => s.time),
        y: signals.strongBuySignals.map(s => s.value),
        mode: 'markers',
        name: 'Güçlü Alım',
        marker: {
            symbol: 'circle',
            size: signals.strongBuySignals.map(s => 12 + s.guc * 2),
            color: '#00e676'
        }
    };
    
    const strongSellTrace = {
        x: signals.strongSellSignals.map(s => s.time),
        y: signals.strongSellSignals.map(s => s.value),
        mode: 'markers',
        name: 'Güçlü Satım',
        marker: {
            symbol: 'circle',
            size: signals.strongSellSignals.map(s => 12 + s.guc * 2),
            color: '#ff1744'
        }
    };
    
    const upperData = [candlestickTrace, strongBuyTrace, strongSellTrace]
        .filter(trace => trace.x && trace.x.length > 0);
    
    const upperLayout = {
        xaxis: { title: 'Zaman', type: 'date', gridcolor: '#333' },
        yaxis: { title: 'Fiyat', gridcolor: '#333' },
        showlegend: true,
        legend: { x: 0, y: 1.1, orientation: 'h' },
        margin: { t: 50, b: 50 },
        plot_bgcolor: '#1d2126',
        paper_bgcolor: '#1d2126',
        font: { color: '#e0e0e0' }
    };
    
    // Alt grafik: Volume Profile
    const positiveTrace = {
        x: timestamps,
        y: positivePct,
        type: 'scatter',
        mode: 'lines',
        name: 'Pozitif %',
        line: { color: '#2962ff', width: 2 }
    };
    
    const negativeTrace = {
        x: timestamps,
        y: negativePct,
        type: 'scatter',
        mode: 'lines',
        name: 'Negatif %',
        line: { color: '#9c27b0', width: 2 }
    };
    
    const buyTrace = {
        x: timestamps,
        y: buyPct,
        type: 'scatter',
        mode: 'lines',
        name: 'Alım %',
        line: { color: '#26a69a', width: 2 }
    };
    
    const sellTrace = {
        x: timestamps,
        y: sellPct,
        type: 'scatter',
        mode: 'lines',
        name: 'Satım %',
        line: { color: '#ef5350', width: 2 }
    };
    
    const lowerData = [positiveTrace, negativeTrace, buyTrace, sellTrace];
    
    const lowerLayout = {
        xaxis: { title: 'Zaman', type: 'date', gridcolor: '#333' },
        yaxis: { title: '% Değer', range: [0, 100], gridcolor: '#333' },
        showlegend: true,
        legend: { x: 0, y: 1.1, orientation: 'h' },
        margin: { t: 50, b: 50 },
        plot_bgcolor: '#1d2126',
        paper_bgcolor: '#1d2126',
        font: { color: '#e0e0e0' }
    };
    
    // Grafikleri çiz
    Plotly.newPlot('chartUpper', upperData, upperLayout);
    Plotly.newPlot('chartLower', lowerData, lowerLayout);
}

// Otomatik refresh toggle
function toggleAutoRefresh() {
    const btn = document.getElementById('autoRefresh');
    
    if (isAutoRefresh) {
        clearInterval(autoRefreshInterval);
        isAutoRefresh = false;
        btn.textContent = '⚡ Otomatik';
        btn.style.background = '#2962ff';
        updateStatus('GitHub Pages manuel mod');
    } else {
        autoRefreshInterval = setInterval(() => {
            if (!isUpdating) fetchData();
        }, 60000); // 60 saniye
        isAutoRefresh = true;
        btn.textContent = '⏹️ Durdur';
        btn.style.background = '#ef5350';
        updateStatus('GitHub Pages otomatik mod (60s)');
    }
}

// Yardımcı fonksiyonlar
function updateSortIndicators() {
    document.querySelectorAll('th.sortable').forEach(th => {
        th.classList.remove('asc', 'desc');
        if (th.getAttribute('data-sort') === currentSort.column) {
            th.classList.add(currentSort.direction);
        }
    });
}

function getRequiredCandles() {
    const days = currentTimeRange;
    const candlesPerDay = {
        '1m': 1440, '5m': 288, '15m': 96, '30m': 48,
        '1h': 24, '4h': 6, '1d': 1
    };
    return Math.min(500, (candlesPerDay[currentTimeframe] || 24) * days);
}

function formatPrice(price) {
    if (price === undefined || price === null) return '-';
    if (price < 0.0001) return price.toFixed(8);
    if (price < 0.01) return price.toFixed(6);
    if (price < 1) return price.toFixed(4);
    if (price < 100) return price.toFixed(2);
    return price.toFixed(price < 10000 ? 1 : 0);
}

function updateStatus(message) {
    statusElement.textContent = message;
}

function showError(message) {
    console.error('❌', message);
    const errorElement = document.getElementById('errorMessage');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        setTimeout(() => { errorElement.style.display = 'none'; }, 5000);
    }
}

console.log('🚀 GitHub Pages TradingView Dashboard optimize kod yüklendi');
