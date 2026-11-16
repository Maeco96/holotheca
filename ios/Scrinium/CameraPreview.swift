import AVFoundation
import SwiftUI
import UIKit

/// Live preview of the back camera. No capture or analysis yet.
struct CameraPreview: UIViewRepresentable {
    func makeUIView(context: Context) -> PreviewView {
        let view = PreviewView()
        view.start()
        return view
    }

    func updateUIView(_ uiView: PreviewView, context: Context) {}

    static func dismantleUIView(_ uiView: PreviewView, coordinator: ()) {
        uiView.stop()
    }
}

final class PreviewView: UIView {
    private let session = AVCaptureSession()
    private let queue = DispatchQueue(label: "scrinium.camera.session")

    override class var layerClass: AnyClass {
        AVCaptureVideoPreviewLayer.self
    }

    private var previewLayer: AVCaptureVideoPreviewLayer {
        // Safe: layerClass above guarantees the layer type.
        layer as! AVCaptureVideoPreviewLayer
    }

    func start() {
        previewLayer.session = session
        previewLayer.videoGravity = .resizeAspectFill
        let session = self.session
        queue.async {
            guard session.inputs.isEmpty,
                  let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
                  let input = try? AVCaptureDeviceInput(device: device),
                  session.canAddInput(input)
            else { return }
            session.beginConfiguration()
            session.sessionPreset = .photo
            session.addInput(input)
            session.commitConfiguration()
            session.startRunning()
        }
    }

    func stop() {
        let session = self.session
        queue.async {
            if session.isRunning {
                session.stopRunning()
            }
        }
    }
}
