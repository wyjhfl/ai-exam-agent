use tauri::Manager;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandChild;
use std::sync::Mutex;

struct Backend {
    child: Mutex<Option<CommandChild>>,
    started: Mutex<bool>,
    error: Mutex<Option<String>>,
}

#[derive(serde::Serialize)]
struct BackendInfo {
    started: bool,
    error: Option<String>,
    exe_path: String,
}

#[tauri::command]
fn get_backend_info(state: tauri::State<'_, Backend>) -> BackendInfo {
    let started = *state.started.lock().unwrap();
    let error = state.error.lock().unwrap().clone();
    let exe_path = std::env::current_exe()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();
    BackendInfo {
        started,
        error,
        exe_path,
    }
}

fn kill_backend(state: &Backend) {
    let mut guard = state.child.lock().unwrap();
    if let Some(child) = guard.take() {
        let _ = child.kill();
    }
    drop(guard);
    *state.started.lock().unwrap() = false;
}

#[tauri::command]
fn restart_backend(app: tauri::AppHandle, state: tauri::State<'_, Backend>) -> Result<BackendInfo, String> {
    kill_backend(&state);

    std::thread::sleep(std::time::Duration::from_millis(1500));

    let sidecar_result = app.shell().sidecar("ai-exam-backend");
    match sidecar_result {
        Ok(command) => match command.spawn() {
            Ok((mut rx, child)) => {
                {
                    let mut guard = state.child.lock().unwrap();
                    *guard = Some(child);
                }
                *state.started.lock().unwrap() = true;
                *state.error.lock().unwrap() = None;

                tauri::async_runtime::spawn(async move {
                    while let Some(event) = rx.recv().await {
                        match event {
                            tauri_plugin_shell::process::CommandEvent::Stdout(line_bytes) => {
                                let line = String::from_utf8_lossy(&line_bytes);
                                log::info!("[backend] {}", line);
                            }
                            tauri_plugin_shell::process::CommandEvent::Stderr(line_bytes) => {
                                let line = String::from_utf8_lossy(&line_bytes);
                                log::error!("[backend:err] {}", line);
                            }
                            _ => {}
                        }
                    }
                    log::info!("[backend] process exited");
                });

                let exe_path = std::env::current_exe()
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_default();
                Ok(BackendInfo {
                    started: true,
                    error: None,
                    exe_path,
                })
            }
            Err(e) => {
                let err_msg = format!("Failed to spawn backend: {}", e);
                *state.error.lock().unwrap() = Some(err_msg.clone());
                *state.started.lock().unwrap() = false;
                Err(err_msg)
            }
        },
        Err(e) => {
            let err_msg = format!("Sidecar binary not found: {}", e);
            *state.error.lock().unwrap() = Some(err_msg.clone());
            *state.started.lock().unwrap() = false;
            Err(err_msg)
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .manage(Backend {
            child: Mutex::new(None),
            started: Mutex::new(false),
            error: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![get_backend_info, restart_backend])
        .setup(|app| {
            let exe_path = std::env::current_exe().unwrap_or_default();
            log::info!("App executable: {:?}", exe_path);

            let sidecar_dir = exe_path.parent().map(|p| p.to_string_lossy().to_string()).unwrap_or_default();
            log::info!("Sidecar expected at: {}\\ai-exam-backend.exe", sidecar_dir);
            log::info!("Attempting to start backend sidecar...");

            let sidecar_result = app.shell().sidecar("ai-exam-backend");
            match sidecar_result {
                Ok(command) => match command.spawn() {
                    Ok((mut rx, child)) => {
                        {
                            let backend = app.state::<Backend>();
                            *backend.child.lock().unwrap() = Some(child);
                            *backend.started.lock().unwrap() = true;
                        }
                        tauri::async_runtime::spawn(async move {
                            while let Some(event) = rx.recv().await {
                                match event {
                                    tauri_plugin_shell::process::CommandEvent::Stdout(line_bytes) => {
                                        let line = String::from_utf8_lossy(&line_bytes);
                                        log::info!("[backend] {}", line);
                                    }
                                    tauri_plugin_shell::process::CommandEvent::Stderr(line_bytes) => {
                                        let line = String::from_utf8_lossy(&line_bytes);
                                        log::error!("[backend:err] {}", line);
                                    }
                                    _ => {}
                                }
                            }
                            log::info!("[backend] process exited");
                        });
                        log::info!("Backend sidecar started successfully");
                    }
                    Err(e) => {
                        let backend = app.state::<Backend>();
                        *backend.error.lock().unwrap() =
                            Some(format!("Failed to spawn backend: {}", e));
                        log::error!("Failed to spawn backend sidecar: {}", e);
                    }
                },
                Err(e) => {
                    let backend = app.state::<Backend>();
                    *backend.error.lock().unwrap() =
                        Some(format!("Sidecar binary not found: {}", e));
                    log::error!("Failed to create sidecar command: {}", e);
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                if window.label() == "main" {
                    let backend = window.state::<Backend>();
                    kill_backend(&backend);
                    log::info!("Backend sidecar killed on window close");
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::ExitRequested { .. } = event {
                let backend = app_handle.state::<Backend>();
                kill_backend(&backend);
                log::info!("Backend sidecar killed on exit requested");
            }
        });
}
