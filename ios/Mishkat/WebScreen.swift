import SwiftUI
import WebKit

/// يعرض «مشكاة» داخل WKWebView من ملفات مضمّنة في التطبيق (يعمل بدون إنترنت).
struct WebScreen: UIViewRepresentable {

    func makeCoordinator() -> NativeBridge { NativeBridge() }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []          // الأذان والتلاوة تعمل تلقائياً
        config.websiteDataStore = .default()

        // تقديم ملفات التطبيق عبر مخطّط مخصّص ليعمل fetch() للمصحف والأذكار
        if let www = Bundle.main.url(forResource: "www", withExtension: nil) {
            config.setURLSchemeHandler(AppSchemeHandler(root: www), forURLScheme: AppSchemeHandler.scheme)
        }

        let ucc = WKUserContentController()
        ucc.add(context.coordinator, name: "mishkat")
        ucc.addUserScript(WKUserScript(source: NativeBridge.injectedJS,
                                       injectionTime: .atDocumentStart,
                                       forMainFrameOnly: true))
        config.userContentController = ucc

        let web = WKWebView(frame: .zero, configuration: config)
        web.isOpaque = false
        web.backgroundColor = UIColor(red: 0.051, green: 0.086, blue: 0.078, alpha: 1)
        web.scrollView.backgroundColor = web.backgroundColor
        web.scrollView.bounces = false
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.uiDelegate = context.coordinator
        web.navigationDelegate = context.coordinator
        if #available(iOS 16.4, *) { web.isInspectable = true }       // للفحص من Safari أثناء التطوير

        context.coordinator.webView = web
        context.coordinator.start()

        guard Bundle.main.url(forResource: "www", withExtension: nil) != nil else {
            web.loadHTMLString("<h3 dir=rtl style='font-family:-apple-system;padding:24px'>"
                               + "لم يتم العثور على ملفات التطبيق داخل الحزمة.</h3>", baseURL: nil)
            return web
        }
        web.load(URLRequest(url: AppSchemeHandler.indexURL))
        return web
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
