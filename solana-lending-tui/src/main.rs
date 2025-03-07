mod app;
mod ui;
mod solana;
mod event;
mod config;

use std::{io, time::Duration};
use anyhow::Result;
use crossterm::{
    event::{DisableMouseCapture, EnableMouseCapture},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{backend::CrosstermBackend, Terminal};

use app::App;
use event::{Event, EventHandler};
use ui::ui;

fn main() -> Result<()> {
    // Initialize logger
    env_logger::init();
    
    // Setup terminal
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen, EnableMouseCapture)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    // Create app state
    let mut app = App::new();
    
    // Create event handler
    let event_handler = EventHandler::new(Duration::from_millis(250));
    
    // Create tokio runtime
    let rt = tokio::runtime::Runtime::new()?;
    
    // Main loop
    let res = rt.block_on(run_app(&mut terminal, &mut app, event_handler));

    // Restore terminal
    disable_raw_mode()?;
    execute!(
        terminal.backend_mut(),
        LeaveAlternateScreen,
        DisableMouseCapture
    )?;
    terminal.show_cursor()?;

    if let Err(err) = res {
        println!("{:?}", err);
    }

    Ok(())
}

async fn run_app<B: ratatui::backend::Backend>(
    terminal: &mut Terminal<B>,
    app: &mut App,
    mut event_handler: EventHandler,
) -> Result<()> {
    loop {
        // Draw UI
        terminal.draw(|f| ui(f, app))
            .map_err(|e| AppError::Io(e))?;

        // Handle events
        match event_handler.next()
            .map_err(|e| AppError::Unknown(e.to_string()))? {
            Event::Tick => {
                app.on_tick().await;
            }
            Event::Key(key_event) => {
                if app.handle_key_event(key_event).await {
                    return Ok(());
                }
            }
            Event::Mouse(_) => {}
            Event::Resize(_, _) => {}
        }
    }
}