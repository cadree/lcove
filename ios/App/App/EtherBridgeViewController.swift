import Capacitor

/// Registers the storefront plugin on the App target. Capacitor's generated
/// package list does not include classes that live in this target.
class EtherBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(EtherStorefrontPlugin())
    }
}
