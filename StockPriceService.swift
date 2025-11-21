//
//  StockPriceService.swift
//  goal-folio
//
//  Created on 11/20/25
//  Firebase Cloud Functions - Stock Price Methods
//

import Foundation
import FirebaseFunctions

/// Service for fetching stock price data from Firebase Cloud Functions
class StockPriceService {
    private let functions = Functions.functions()
    static let shared = StockPriceService()
    
    // MARK: - Initialization
    
    private init() {
        // Optional: Configure for specific region if needed
        // functions = Functions.functions(region: "us-central1")
    }
    
    // MARK: - Models
    
    /// Stock candle with OHLCV data
    struct StockCandle: Codable, Identifiable {
        let id = UUID()
        let time: String      // ISO 8601 timestamp
        let open: Double
        let high: Double
        let low: Double
        let close: Double
        let volume: Int
        
        /// Converts ISO timestamp to Date
        var date: Date? {
            let formatter = ISO8601DateFormatter()
            return formatter.date(from: time)
        }
        
        enum CodingKeys: String, CodingKey {
            case time, open, high, low, close, volume
        }
    }
    
    /// Response from getIntradayPrices
    struct IntradayPricesResponse: Codable {
        let symbol: String
        let interval: String
        let candles: [StockCandle]
    }
    
    /// Response from getRecentOpenDay
    struct RecentOpenDayResponse: Codable {
        let symbol: String
        let interval: String
        let tradingDay: String?
        let candles: [StockCandle]
    }
    
    // MARK: - Errors
    
    enum PriceServiceError: LocalizedError {
        case invalidResponse
        case decodingFailed
        case emptySymbol
        
        var errorDescription: String? {
            switch self {
            case .invalidResponse:
                return "Invalid response from server"
            case .decodingFailed:
                return "Failed to decode response data"
            case .emptySymbol:
                return "Stock symbol cannot be empty"
            }
        }
    }
    
    // MARK: - Cloud Functions
    
    /// Fetch intraday prices for a stock
    /// - Parameters:
    ///   - symbol: Stock symbol (e.g., "AAPL")
    ///   - interval: Time interval (default: "15min"). Options: "1min", "5min", "15min", "30min", "60min"
    ///   - outputSize: "compact" (last 100 data points) or "full" (default: "compact")
    ///   - adjusted: Whether to adjust for splits/dividends (default: true)
    ///   - extendedHours: Include extended trading hours (default: false)
    ///   - month: Specific month in YYYY-MM format (optional)
    /// - Returns: Array of stock candles with OHLCV data
    func fetchIntradayPrices(
        symbol: String,
        interval: String = "15min",
        outputSize: String = "compact",
        adjusted: Bool = true,
        extendedHours: Bool = false,
        month: String? = nil
    ) async throws -> [StockCandle] {
        guard !symbol.trimmingCharacters(in: .whitespaces).isEmpty else {
            throw PriceServiceError.emptySymbol
        }
        
        var data: [String: Any] = [
            "symbol": symbol.uppercased(),
            "interval": interval,
            "outputSize": outputSize,
            "adjusted": adjusted,
            "extendedHours": extendedHours
        ]
        
        if let month = month {
            data["month"] = month
        }
        
        let result = try await functions.httpsCallable("getIntradayPrices").call(data)
        
        guard let jsonData = try? JSONSerialization.data(withJSONObject: result.data) else {
            throw PriceServiceError.invalidResponse
        }
        
        guard let response = try? JSONDecoder().decode(IntradayPricesResponse.self, from: jsonData) else {
            throw PriceServiceError.decodingFailed
        }
        
        return response.candles
    }
    
    /// Get candles for the most recent open trading day
    /// - Parameters:
    ///   - symbol: Stock symbol (e.g., "AAPL")
    ///   - interval: Time interval (default: "15min"). Options: "1min", "5min", "15min", "30min", "60min"
    /// - Returns: Array of candles for the most recent trading day
    func getRecentOpenDayCandles(
        symbol: String,
        interval: String = "15min"
    ) async throws -> [StockCandle] {
        guard !symbol.trimmingCharacters(in: .whitespaces).isEmpty else {
            throw PriceServiceError.emptySymbol
        }
        
        let data: [String: Any] = [
            "symbol": symbol.uppercased(),
            "interval": interval
        ]
        
        let result = try await functions.httpsCallable("getRecentOpenDay").call(data)
        
        guard let jsonData = try? JSONSerialization.data(withJSONObject: result.data) else {
            throw PriceServiceError.invalidResponse
        }
        
        guard let response = try? JSONDecoder().decode(RecentOpenDayResponse.self, from: jsonData) else {
            throw PriceServiceError.decodingFailed
        }
        
        return response.candles
    }
    
    // MARK: - Convenience Methods
    
    /// Get the latest candle from an array
    static func getLatestCandle(from candles: [StockCandle]) -> StockCandle? {
        return candles.last
    }
    
    /// Get the latest close price
    static func getLatestPrice(from candles: [StockCandle]) -> Double? {
        return candles.last?.close
    }
    
    /// Calculate price change from first to last candle
    static func getPriceChange(from candles: [StockCandle]) -> (change: Double, percentChange: Double)? {
        guard let first = candles.first,
              let last = candles.last,
              first.close > 0 else {
            return nil
        }
        
        let change = last.close - first.close
        let percentChange = (change / first.close) * 100.0
        
        return (change, percentChange)
    }
    
    /// Get price range (high/low) from candles
    static func getPriceRange(from candles: [StockCandle]) -> (low: Double, high: Double)? {
        guard !candles.isEmpty else { return nil }
        
        let low = candles.map { $0.low }.min() ?? 0
        let high = candles.map { $0.high }.max() ?? 0
        
        return (low, high)
    }
    
    /// Calculate total volume
    static func getTotalVolume(from candles: [StockCandle]) -> Int {
        return candles.reduce(0) { $0 + $1.volume }
    }
}

// MARK: - Usage Examples

/*
 
 // EXAMPLE 1: Fetch intraday prices with default 15min interval
 Task {
     do {
         let candles = try await StockPriceService.shared.fetchIntradayPrices(symbol: "AAPL")
         
         print("Received \(candles.count) candles")
         
         // Get latest price
         if let latestPrice = StockPriceService.getLatestPrice(from: candles) {
             print("Latest price: $\(String(format: "%.2f", latestPrice))")
         }
         
         // Get price change
         if let change = StockPriceService.getPriceChange(from: candles) {
             print("Change: $\(String(format: "%.2f", change.change)) (\(String(format: "%.2f", change.percentChange))%)")
         }
         
         // Get price range
         if let range = StockPriceService.getPriceRange(from: candles) {
             print("Range: $\(String(format: "%.2f", range.low)) - $\(String(format: "%.2f", range.high))")
         }
         
     } catch {
         print("Error: \(error.localizedDescription)")
     }
 }
 
 // EXAMPLE 2: Fetch with custom interval and parameters
 Task {
     do {
         let candles = try await StockPriceService.shared.fetchIntradayPrices(
             symbol: "TSLA",
             interval: "5min",
             outputSize: "full",
             adjusted: true,
             extendedHours: false
         )
         
         print("Got \(candles.count) 5-minute candles for TSLA")
         
         // Display each candle
         for candle in candles.prefix(5) {
             print("""
                 Time: \(candle.time)
                 Open: $\(candle.open)
                 High: $\(candle.high)
                 Low: $\(candle.low)
                 Close: $\(candle.close)
                 Volume: \(candle.volume)
                 ---
                 """)
         }
         
     } catch {
         print("Error: \(error.localizedDescription)")
     }
 }
 
 // EXAMPLE 3: Get recent trading day candles
 Task {
     do {
         let candles = try await StockPriceService.shared.getRecentOpenDayCandles(
             symbol: "NVDA",
             interval: "15min"
         )
         
         print("Today's trading has \(candles.count) candles")
         
         if let change = StockPriceService.getPriceChange(from: candles) {
             let arrow = change.change >= 0 ? "📈" : "📉"
             print("\(arrow) Today: \(change.change >= 0 ? "+" : "")\(String(format: "%.2f", change.change)) (\(String(format: "%.2f", change.percentChange))%)")
         }
         
         // Total volume for the day
         let totalVolume = StockPriceService.getTotalVolume(from: candles)
         print("Total volume: \(totalVolume.formatted())")
         
     } catch {
         print("Error: \(error.localizedDescription)")
     }
 }
 
 // EXAMPLE 4: Fetch specific month data
 Task {
     do {
         let candles = try await StockPriceService.shared.fetchIntradayPrices(
             symbol: "AAPL",
             interval: "60min",
             outputSize: "full",
             month: "2025-01"
         )
         
         print("January 2025: \(candles.count) hourly candles")
         
     } catch {
         print("Error: \(error.localizedDescription)")
     }
 }
 
 // EXAMPLE 5: Use in SwiftUI View
 @StateObject private var viewModel = StockPriceViewModel()
 
 class StockPriceViewModel: ObservableObject {
     @Published var candles: [StockPriceService.StockCandle] = []
     @Published var isLoading = false
     @Published var errorMessage: String?
     
     func loadPrices(for symbol: String) {
         isLoading = true
         errorMessage = nil
         
         Task {
             do {
                 let fetchedCandles = try await StockPriceService.shared.fetchIntradayPrices(
                     symbol: symbol,
                     interval: "15min"
                 )
                 
                 await MainActor.run {
                     self.candles = fetchedCandles
                     self.isLoading = false
                 }
             } catch {
                 await MainActor.run {
                     self.errorMessage = error.localizedDescription
                     self.isLoading = false
                 }
             }
         }
     }
 }
 
 */
