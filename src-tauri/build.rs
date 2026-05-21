fn main() {
    let result = std::panic::catch_unwind(|| {
        tauri_build::build()
    });
    if result.is_err() {
        println!("cargo:warning=tauri_build failed, trying winres fallback to embed manifest");
        if std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default() == "windows" {
            let mut res = winres::WindowsResource::new();
            res.set_manifest_file("app.manifest");
            if let Err(e) = res.compile() {
                println!("cargo:warning=winres fallback also failed: {}", e);
                println!("cargo:warning=Application will need external manifest file app.exe.manifest");
            }
        }
    }
}
