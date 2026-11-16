import AVFoundation
import SwiftUI

/// Phase 0 screen: proves that the app installs, launches and can open the camera.
struct ContentView: View {
    @State private var authorization = AVCaptureDevice.authorizationStatus(for: .video)

    private var versionText: String {
        let info = Bundle.main.infoDictionary
        let version = info?["CFBundleShortVersionString"] as? String ?? "?"
        let build = info?["CFBundleVersion"] as? String ?? "?"
        return "Scrinium \(version) (\(build))"
    }

    var body: some View {
        VStack(spacing: 16) {
            Text(versionText)
                .font(.headline)

            Group {
                switch authorization {
                case .authorized:
                    CameraPreview()
                case .notDetermined:
                    Button("Allow camera access") {
                        AVCaptureDevice.requestAccess(for: .video) { _ in
                            DispatchQueue.main.async {
                                authorization = AVCaptureDevice.authorizationStatus(for: .video)
                            }
                        }
                    }
                    .buttonStyle(.borderedProminent)
                default:
                    Text("Camera access is denied. Enable it in Settings > Scrinium.")
                        .multilineTextAlignment(.center)
                        .foregroundColor(.secondary)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color.black.opacity(0.05))
            .clipShape(RoundedRectangle(cornerRadius: 12))

            Text("Phase 0 build: install and camera check only.")
                .font(.footnote)
                .foregroundColor(.secondary)
        }
        .padding()
    }
}
