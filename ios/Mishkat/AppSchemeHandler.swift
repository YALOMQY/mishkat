import Foundation
import WebKit
import UniformTypeIdentifiers

/// يقدّم ملفات التطبيق من داخل الحزمة عبر مخطّط `mishkat://`.
/// السبب: WKWebView يمنع `fetch()` من `file://`، فلا يمكن تحميل المصحف والأذكار بدونه.
final class AppSchemeHandler: NSObject, WKURLSchemeHandler {

    static let scheme = "mishkat"
    static let host = "app"
    static var indexURL: URL { URL(string: "\(scheme)://\(host)/index.html")! }

    private let root: URL
    private let queue = DispatchQueue(label: "mishkat.scheme", qos: .userInitiated)

    init(root: URL) { self.root = root.standardizedFileURL }

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url else {
            task.didFailWithError(URLError(.badURL)); return
        }
        // تجاهل الاستعلام والمرساة، ومنع الخروج خارج مجلد الحزمة
        var path = (url.path as NSString).standardizingPath
        if path.isEmpty || path == "/" { path = "/index.html" }
        let file = root.appendingPathComponent(path).standardizedFileURL

        guard file.path == root.path || file.path.hasPrefix(root.path + "/") else {
            task.didFailWithError(URLError(.noPermissionsToReadFile)); return
        }

        queue.async {
            let attributes = try? FileManager.default.attributesOfItem(atPath: file.path)
            let fileSize = (attributes?[.size] as? NSNumber)?.intValue
            guard attributes != nil, let fileSize, fileSize > 0 else {
                let res = HTTPURLResponse(url: url, statusCode: 404, httpVersion: "HTTP/1.1",
                                          headerFields: ["Content-Type": "text/plain; charset=utf-8"])!
                DispatchQueue.main.async {
                    task.didReceive(res)
                    task.didReceive("Not found: \(path)".data(using: .utf8)!)
                    task.didFinish()
                }
                return
            }
            let headers = [
                "Content-Type": Self.mime(for: file.pathExtension),
                "Content-Length": String(fileSize),
                "Cache-Control": "no-cache",
                "Access-Control-Allow-Origin": "*",
                "Accept-Ranges": "bytes"
            ]
            if task.request.httpMethod?.uppercased() == "HEAD" {
                let res = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: headers)!
                DispatchQueue.main.async {
                    task.didReceive(res)
                    task.didFinish()
                }
                return
            }
            guard let data = try? Data(contentsOf: file), !data.isEmpty else {
                DispatchQueue.main.async { task.didFailWithError(URLError(.cannotDecodeContentData)) }
                return
            }
            let res = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: [
                "Content-Type": Self.mime(for: file.pathExtension),
                "Content-Length": String(data.count),
                "Cache-Control": "no-cache",
                "Access-Control-Allow-Origin": "*",
                "Accept-Ranges": "bytes"
            ])!
            DispatchQueue.main.async {
                task.didReceive(res)
                task.didReceive(data)
                task.didFinish()
            }
        }
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}

    private static func mime(for ext: String) -> String {
        switch ext.lowercased() {
        case "html", "htm":   return "text/html; charset=utf-8"
        case "css":           return "text/css; charset=utf-8"
        case "js", "mjs":     return "text/javascript; charset=utf-8"
        case "json":          return "application/json; charset=utf-8"
        case "webmanifest":   return "application/manifest+json; charset=utf-8"
        case "woff2":         return "font/woff2"
        case "woff":          return "font/woff"
        case "ttf":           return "font/ttf"
        case "png":           return "image/png"
        case "jpg", "jpeg":   return "image/jpeg"
        case "svg":           return "image/svg+xml"
        case "mp3":           return "audio/mpeg"
        default:
            return UTType(filenameExtension: ext)?.preferredMIMEType ?? "application/octet-stream"
        }
    }
}
