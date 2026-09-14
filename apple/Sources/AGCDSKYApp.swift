import SwiftUI

@main
struct AGCDSKYApp: App {
    @StateObject private var webModel = AGCWebViewModel()

    var body: some Scene {
        WindowGroup("AGC DSKY") {
            ContentView(model: webModel)
        }
#if os(macOS)
        .defaultSize(width: 760, height: 980)
#endif
    }
}

struct ContentView: View {
    @ObservedObject var model: AGCWebViewModel
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        AGCWebView(model: model)
            .ignoresSafeArea()
            .background(Color.black)
            .onAppear {
                model.setAppVisible(true)
            }
            .onDisappear {
                model.setAppVisible(false)
            }
            .onChange(of: scenePhase) { phase in
                model.setAppVisible(phase == .active)
            }
    }
}
