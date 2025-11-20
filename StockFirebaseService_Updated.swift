//
//  StockFirebaseService.swift
//  goal-folio
//
//  Created by Pratham S on 11/14/25.
//  Updated: 11/20/25 - Simplified with onCall functions
//

import Foundation
import FirebaseFunctions

/// Service for fetching stock data through Firebase Cloud Functions
/// Replaces direct Alpha Vantage API calls with cached, rate-limited backend calls
class StockFirebaseService {
    private let functions = Functions.functions()
    static let shared = StockFirebaseService()
    
    // MARK: - Initialization
    
    private init() {
        // Optional: Configure for specific region if needed
        // functions = Functions.functions(region: "us-central1")
    }
    
    // MARK: - Models
    
    /// Simple stock candle with time and close price
    struct StockCandle: Codable, Identifiable {
        let id = UUID()
        let time: String // ISO 8601 timestamp
        let close: Double
        
        /// Converts ISO timestamp to Date
        var date: Date? {
            let formatter = ISO8601DateFormatter()
            return formatter.date(from: time)
        }
        
        enum CodingKeys: String, CodingKey {
            case time
            case close
        }
    }
    
    struct SearchResponse: Codable {
        let success: Bool
        let query: String
        let count: Int
        let fromCache: Bool
        let results: [Stock]
        let apiError: String?
    }
    
    struct StockDetailsResponse: Codable {
        let success: Bool
        let result: StockDetails?
        let error: String?
    }
    
    struct StockDetails: Codable {
        let symbol: String
        let name: String
        let type: String
        let region: String
        let currency: String
        let lastUpdated: String
    }
    
    // MARK: - Errors
    
    enum FirebaseServiceError: LocalizedError {
        case invalidResponse
        case serverError(String)
        case noData
        
        var errorDescription: String? {
            switch self {
            case .invalidResponse:
                return "Invalid response from server"
            case .serverError(let message):
                return "Server error: \(message)"
            case .noData:
                return "No data received"
            }
        }
    }
    
    // MARK: - Search Functions
    
    /// Search for stocks by symbol or name
    /// - Parameters:
    ///   - query: Search query (e.g., "AAPL" or "Apple")
    ///   - limit: Maximum number of results (default: 10, max: 50)
    /// - Returns: Array of matching stocks
    func searchStocks(query: String, limit: Int = 10) async throws -> [Stock] {
        let baseURL = "https://us-central1-goal-folio.cloudfunctions.net/searchStocks"
        
        guard let url = URL(string: baseURL) else {
            throw FirebaseServiceError.invalidResponse
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "q": query,
            "limit": min(limit, 50)
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, _) = try await URLSession.shared.data(for: request)
        let response = try JSONDecoder().decode(SearchResponse.self, from: data)
        
        if !response.success {
            if let apiError = response.apiError {
                throw FirebaseServiceError.serverError(apiError)
            }
            throw FirebaseServiceError.serverError("Unknown error")
        }
        
        return response.results
    }
    
    /// Get detailed information about a specific stock
    /// - Parameter symbol: Stock symbol (e.g., "AAPL")
    /// - Returns: Stock details
    func getStock(symbol: String) async throws -> StockDetails {
        let data: [String: Any] = [
            "symbol": symbol.uppercased()
        ]
        
        let result = try await functions.httpsCallable("getStock").call(data)
        
        guard let jsonData = try? JSONSerialization.data(withJSONObject: result.data),
              let response = try? JSONDecoder().decode(StockDetailsResponse.self, from: jsonData) else {
            throw FirebaseServiceError.invalidResponse
        }
        
        if !response.success {
            throw FirebaseServiceError.serverError(response.error ?? "Unknown error")
        }
        
        guard let stockDetails = response.result else {
            throw FirebaseServiceError.noData
        }
        
        return stockDetails
    }
    
    // MARK: - Price Functions (Simplified - Direct Array Returns)
    
    /// Fetch intraday prices for a stock
    /// Returns array of StockCandle with time and close price only
    /// - Parameter symbol: Stock symbol (e.g., "AAPL")
    /// - Returns: Array of stock candles sorted by time
    func fetchIntradayPrices(symbol: String) async throws -> [StockCandle] {
        let data: [String: Any] = [
            "symbol": symbol.uppercased()
        ]
        
        let result = try await functions.httpsCallable("fetchIntradayPrices").call(data)
        
        guard let jsonData = try? JSONSerialization.data(withJSONObject: result.data),
              let candles = try? JSONDecoder().decode([StockCandle].self, from: jsonData) else {
            throw FirebaseServiceError.invalidResponse
        }
        
        return candles
    }
    
    /// Get candles for the most recent open trading day
    /// Returns array of StockCandle for just the last trading day
    /// - Parameter symbol: Stock symbol (e.g., "AAPL")
    /// - Returns: Array of candles for the most recent trading day
    func getRecentOpenDayCandles(symbol: String) async throws -> [StockCandle] {
        let data: [String: Any] = [
            "symbol": symbol.uppercased()
        ]
        
        let result = try await functions.httpsCallable("getRecentOpenDayCandles").call(data)
        
        guard let jsonData = try? JSONSerialization.data(withJSONObject: result.data),
              let candles = try? JSONDecoder().decode([StockCandle].self, from: jsonData) else {
            throw FirebaseServiceError.invalidResponse
        }
        
        return candles
    }
    
    // MARK: - Convenience Functions
    
    /// Get the latest close price from candles
    static func getLatestPrice(from candles: [StockCandle]) -> Double? {
        return candles.last?.close
    }
    
    /// Calculate price change from candles
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
}

// MARK: - Usage Examples

/*
 
 // EXAMPLE 1: Search for stocks
 Task {
     do {
         let stocks = try await StockFirebaseService.shared.searchStocks(query: "Apple", limit: 10)
         for stock in stocks {
             print("\(stock.symbol): \(stock.name)")
         }
     } catch {
         print("Search failed: \(error.localizedDescription)")
     }
 }
 
 // EXAMPLE 2: Get stock details
 Task {
     do {
         let details = try await StockFirebaseService.shared.getStock(symbol: "AAPL")
         print("Stock: \(details.name)")
         print("Type: \(details.type)")
         print("Currency: \(details.currency)")
     } catch {
         print("Failed to get stock: \(error.localizedDescription)")
     }
 }
 
 // EXAMPLE 3: Fetch intraday prices (SIMPLIFIED - Just array of candles!)
 Task {
     do {
         let candles = try await StockFirebaseService.shared.fetchIntradayPrices(symbol: "AAPL")
         
         print("Got \(candles.count) candles")
         
         if let latestPrice = StockFirebaseService.getLatestPrice(from: candles) {
             print("Latest price: $\(latestPrice)")
         }
         
         if let change = StockFirebaseService.getPriceChange(from: candles) {
             print("Change: $\(change.change) (\(String(format: "%.2f", change.percentChange))%)")
         }
         
         // Print all candles
         for candle in candles {
             if let date = candle.date {
                 print("\(date): $\(candle.close)")
             }
         }
     } catch {
         print("Failed to fetch prices: \(error.localizedDescription)")
     }
 }
 
 // EXAMPLE 4: Get recent open day candles (SIMPLIFIED - Just array of candles!)
 Task {
     do {
         let candles = try await StockFirebaseService.shared.getRecentOpenDayCandles(symbol: "AAPL")
         
         print("Today's trading has \(candles.count) candles")
         
         for candle in candles {
             if let date = candle.date {
                 let formatter = DateFormatter()
                 formatter.timeStyle = .short
                 print("\(formatter.string(from: date)): $\(candle.close)")
             }
         }
         
         // Show price movement
         if let change = StockFirebaseService.getPriceChange(from: candles) {
             let arrow = change.change >= 0 ? "📈" : "📉"
             print("\(arrow) Today: \(change.change >= 0 ? "+" : "")$\(String(format: "%.2f", change.change)) (\(String(format: "%.2f", change.percentChange))%)")
         }
     } catch {
         print("Failed to get today's candles: \(error.localizedDescription)")
     }
 }
 
 */
