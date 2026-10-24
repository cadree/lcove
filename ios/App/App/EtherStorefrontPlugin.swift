import Capacitor
import StoreKit
import UIKit

/// Reads the App Store storefront and opens an allowed https URL in Safari.
/// Checkout must not load inside the Capacitor WebView or an in-app Safari sheet.
@objc(EtherStorefrontPlugin)
public class EtherStorefrontPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "EtherStorefrontPlugin"
    public let jsName = "EtherStorefront"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getCountryCode", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openExternal", returnType: CAPPluginReturnPromise),
    ]

    static let allowedHosts: Set<String> = [
        "etherbylcove.com",
        "www.etherbylcove.com",
        "checkout.stripe.com",
        "billing.stripe.com",
    ]

    @objc public func getCountryCode(_ call: CAPPluginCall) {
        Task {
            let code = await Storefront.current?.countryCode ?? ""
            call.resolve(["countryCode": code])
        }
    }

    @objc public func openExternal(_ call: CAPPluginCall) {
        guard let raw = call.getString("url"),
              let url = URL(string: raw),
              url.scheme?.lowercased() == "https",
              let host = url.host?.lowercased(),
              Self.allowedHosts.contains(host) else {
            call.reject("Checkout link isn't allowed")
            return
        }
        DispatchQueue.main.async {
            UIApplication.shared.open(url, options: [:]) { opened in
                if opened {
                    call.resolve()
                } else {
                    call.reject("Safari did not open")
                }
            }
        }
    }
}
