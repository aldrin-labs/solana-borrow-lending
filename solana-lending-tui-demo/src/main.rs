use std::{io, time::Duration};
use crossterm::{
    event::{self, DisableMouseCapture, EnableMouseCapture, Event, KeyCode},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{
    backend::{Backend, CrosstermBackend},
    layout::{Constraint, Direction, Layout},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, Paragraph},
    Frame, Terminal,
};

enum AppState {
    Home,
    Markets,
    Reserves,
    Deposit,
    Withdraw,
    Borrow,
    Repay,
}

struct App {
    state: AppState,
    running: bool,
}

impl App {
    fn new() -> Self {
        Self {
            state: AppState::Home,
            running: true,
        }
    }

    fn on_key(&mut self, key: KeyCode) {
        match key {
            KeyCode::Char('q') => self.running = false,
            KeyCode::Char('h') => self.state = AppState::Home,
            KeyCode::Char('m') => self.state = AppState::Markets,
            KeyCode::Char('r') => self.state = AppState::Reserves,
            KeyCode::Char('d') => self.state = AppState::Deposit,
            KeyCode::Char('w') => self.state = AppState::Withdraw,
            KeyCode::Char('b') => self.state = AppState::Borrow,
            KeyCode::Char('p') => self.state = AppState::Repay,
            _ => {}
        }
    }
}

fn main() -> Result<(), io::Error> {
    // Setup terminal
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen, EnableMouseCapture)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    // Create app state
    let mut app = App::new();

    // Main loop
    loop {
        terminal.draw(|f| ui(f, &app))?;

        if event::poll(Duration::from_millis(100))? {
            if let Event::Key(key) = event::read()? {
                app.on_key(key.code);
            }
        }

        if !app.running {
            break;
        }
    }

    // Restore terminal
    disable_raw_mode()?;
    execute!(
        terminal.backend_mut(),
        LeaveAlternateScreen,
        DisableMouseCapture
    )?;
    terminal.show_cursor()?;

    Ok(())
}

fn ui<B: Backend>(f: &mut Frame<B>, app: &App) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .margin(1)
        .constraints([Constraint::Percentage(100)].as_ref())
        .split(f.size());

    let title = match app.state {
        AppState::Home => "Home",
        AppState::Markets => "Markets",
        AppState::Reserves => "Reserves",
        AppState::Deposit => "Deposit",
        AppState::Withdraw => "Withdraw",
        AppState::Borrow => "Borrow",
        AppState::Repay => "Repay",
    };

    let text = match app.state {
        AppState::Home => vec![
            Line::from(vec![Span::styled(
                "Welcome to Solana Lending TUI",
                Style::default().fg(Color::Green).add_modifier(Modifier::BOLD),
            )]),
            Line::from(""),
            Line::from("This TUI allows you to interact with the Solana Borrow-Lending protocol."),
            Line::from(""),
            Line::from("Keyboard shortcuts:"),
            Line::from("q - Quit"),
            Line::from("h - Home"),
            Line::from("m - Markets"),
            Line::from("r - Reserves"),
            Line::from("d - Deposit"),
            Line::from("w - Withdraw"),
            Line::from("b - Borrow"),
            Line::from("p - Repay"),
        ],
        AppState::Markets => vec![
            Line::from("Markets"),
            Line::from(""),
            Line::from("Market 1"),
            Line::from("Market 2"),
        ],
        AppState::Reserves => vec![
            Line::from("Reserves"),
            Line::from(""),
            Line::from("Reserve 1"),
            Line::from("Reserve 2"),
        ],
        AppState::Deposit => vec![
            Line::from("Deposit"),
            Line::from(""),
            Line::from("Deposit your tokens to earn interest."),
        ],
        AppState::Withdraw => vec![
            Line::from("Withdraw"),
            Line::from(""),
            Line::from("Withdraw your deposited tokens."),
        ],
        AppState::Borrow => vec![
            Line::from("Borrow"),
            Line::from(""),
            Line::from("Borrow tokens against your collateral."),
        ],
        AppState::Repay => vec![
            Line::from("Repay"),
            Line::from(""),
            Line::from("Repay your borrowed tokens."),
        ],
    };

    let paragraph = Paragraph::new(text)
        .block(Block::default().borders(Borders::ALL).title(title))
        .style(Style::default().fg(Color::White))
        .alignment(ratatui::layout::Alignment::Center);

    f.render_widget(paragraph, chunks[0]);
}