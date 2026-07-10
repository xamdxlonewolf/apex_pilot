use rand::{distr::Alphanumeric, RngExt};
use serde::Serialize;
use std::env;
use std::net::TcpListener;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::Manager;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct BackendConfig {
    base_url: String,
    bearer_token: String,
}

struct BackendRuntime {
    config: BackendConfig,
    child: Mutex<Option<Child>>,
}

impl BackendRuntime {
    fn start() -> Result<Self, Box<dyn std::error::Error>> {
        let host = env::var("APEX_PILOT_BIND_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
        let port = env::var("APEX_PILOT_BIND_PORT")
            .ok()
            .and_then(|value| value.parse::<u16>().ok())
            .unwrap_or_else(allocate_loopback_port);
        let bearer_token = env::var("APEX_PILOT_BEARER_TOKEN").unwrap_or_else(|_| generate_bearer_token());
        let configured_base_url = env::var("APEX_PILOT_BACKEND_URL").ok();
        let base_url = configured_base_url
            .clone()
            .unwrap_or_else(|| format!("http://{host}:{port}"));
        let should_spawn = env::var("APEX_PILOT_START_BACKEND_SIDECAR")
            .map(|value| value != "0")
            .unwrap_or(!cfg!(debug_assertions) && configured_base_url.is_none());

        let child = if should_spawn {
            let command = env::var("APEX_PILOT_BACKEND_COMMAND").unwrap_or_else(|_| "apex-pilot-api".to_string());
            Some(
                Command::new(command)
                    .env("APEX_PILOT_BIND_HOST", &host)
                    .env("APEX_PILOT_BIND_PORT", port.to_string())
                    .env("APEX_PILOT_BEARER_TOKEN", &bearer_token)
                    .stdin(Stdio::null())
                    .stdout(Stdio::piped())
                    .stderr(Stdio::piped())
                    .spawn()?,
            )
        } else {
            None
        };

        Ok(Self {
            config: BackendConfig {
                base_url,
                bearer_token,
            },
            child: Mutex::new(child),
        })
    }
}

impl Drop for BackendRuntime {
    fn drop(&mut self) {
        if let Ok(mut child_slot) = self.child.lock() {
            if let Some(mut child) = child_slot.take() {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    }
}

#[tauri::command]
fn backend_config(runtime: tauri::State<'_, BackendRuntime>) -> BackendConfig {
    runtime.config.clone()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            app.manage(BackendRuntime::start()?);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![backend_config])
        .run(tauri::generate_context!())
        .expect("error while running Apex Pilot");
}

fn allocate_loopback_port() -> u16 {
    TcpListener::bind(("127.0.0.1", 0))
        .and_then(|listener| listener.local_addr())
        .map(|address| address.port())
        .expect("available loopback port")
}

fn generate_bearer_token() -> String {
    rand::rng()
        .sample_iter(&Alphanumeric)
        .take(48)
        .map(char::from)
        .collect()
}
