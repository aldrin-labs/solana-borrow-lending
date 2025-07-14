use ratatui::{
    backend::Backend,
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Span, Spans, Text},
    widgets::{Block, Borders, List, ListItem, Paragraph, Tabs, Wrap},
    Frame,
};

use crate::app::{App, AppState};

/// Renders the user interface widgets.
pub fn ui<B: Backend>(frame: &mut Frame<B>, app: &App) {
    // Create the layout
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3),  // Title bar
            Constraint::Min(0),     // Main content
            Constraint::Length(3),  // Status bar
        ])
        .split(frame.size());

    // Render title bar
    render_title_bar(frame, app, chunks[0]);

    // Render main content based on current state
    match app.state {
        AppState::Home => render_home(frame, app, chunks[1]),
        AppState::Markets => render_markets(frame, app, chunks[1]),
        AppState::Reserves => render_reserves(frame, app, chunks[1]),
        AppState::Deposit => render_deposit(frame, app, chunks[1]),
        AppState::Withdraw => render_withdraw(frame, app, chunks[1]),
        AppState::Borrow => render_borrow(frame, app, chunks[1]),
        AppState::Repay => render_repay(frame, app, chunks[1]),
        AppState::Liquidate => render_liquidate(frame, app, chunks[1]),
        AppState::FlashLoan => render_flash_loan(frame, app, chunks[1]),
        AppState::Settings => render_settings(frame, app, chunks[1]),
        AppState::Help => render_help(frame, app, chunks[1]),
    }

    // Render status bar
    render_status_bar(frame, app, chunks[2]);
}

/// Renders the title bar.
fn render_title_bar<B: Backend>(frame: &mut Frame<B>, app: &App, area: Rect) {
    let titles = vec![
        "Home", "Markets", "Reserves", "Deposit", "Withdraw", 
        "Borrow", "Repay", "Liquidate", "Flash Loan", "Settings", "Help",
    ]
    .iter()
    .map(|t| {
        let (first, rest) = t.split_at(1);
        Spans::from(vec![
            Span::styled(
                first,
                Style::default()
                    .fg(Color::Yellow)
                    .add_modifier(Modifier::UNDERLINED),
            ),
            Span::styled(rest, Style::default().fg(Color::White)),
        ])
    })
    .collect();

    let tabs = Tabs::new(titles)
        .block(Block::default().borders(Borders::ALL).title("Solana Lending TUI"))
        .select(app.state as usize)
        .style(Style::default().fg(Color::White))
        .highlight_style(
            Style::default()
                .fg(Color::Yellow)
                .add_modifier(Modifier::BOLD),
        );

    frame.render_widget(tabs, area);
}

/// Renders the home screen.
fn render_home<B: Backend>(frame: &mut Frame<B>, _app: &App, area: Rect) {
    let text = vec![
        Spans::from(vec![Span::styled(
            "Welcome to Solana Lending TUI",
            Style::default().fg(Color::Green).add_modifier(Modifier::BOLD),
        )]),
        Spans::from(vec![Span::raw("")]),
        Spans::from(vec![Span::raw(
            "This TUI allows you to interact with the Solana Borrow-Lending protocol.",
        )]),
        Spans::from(vec![Span::raw("")]),
        Spans::from(vec![Span::raw(
            "Use the keyboard shortcuts shown in the help screen to navigate.",
        )]),
        Spans::from(vec![Span::raw("")]),
        Spans::from(vec![Span::styled(
            "Press '?' for help or 'm' to view markets.",
            Style::default().fg(Color::Yellow),
        )]),
    ];

    let paragraph = Paragraph::new(text)
        .block(Block::default().borders(Borders::ALL).title("Home"))
        .style(Style::default().fg(Color::White))
        .alignment(ratatui::layout::Alignment::Center)
        .wrap(Wrap { trim: true });

    frame.render_widget(paragraph, area);
}

/// Renders the markets screen.
fn render_markets<B: Backend>(frame: &mut Frame<B>, app: &App, area: Rect) {
    let items: Vec<ListItem> = app
        .markets
        .iter()
        .map(|market| {
            ListItem::new(Spans::from(vec![Span::styled(
                market,
                Style::default().fg(Color::White),
            )]))
        })
        .collect();

    let list = List::new(items)
        .block(Block::default().borders(Borders::ALL).title("Markets"))
        .highlight_style(
            Style::default()
                .fg(Color::Yellow)
                .add_modifier(Modifier::BOLD),
        )
        .highlight_symbol("> ");

    let mut state = ratatui::widgets::ListState::default();
    state.select(app.selected_market);

    frame.render_stateful_widget(list, area, &mut state);
}

/// Renders the reserves screen.
fn render_reserves<B: Backend>(frame: &mut Frame<B>, app: &App, area: Rect) {
    let items: Vec<ListItem> = app
        .reserves
        .iter()
        .map(|reserve| {
            ListItem::new(Spans::from(vec![Span::styled(
                reserve,
                Style::default().fg(Color::White),
            )]))
        })
        .collect();

    let list = List::new(items)
        .block(Block::default().borders(Borders::ALL).title("Reserves"))
        .highlight_style(
            Style::default()
                .fg(Color::Yellow)
                .add_modifier(Modifier::BOLD),
        )
        .highlight_symbol("> ");

    let mut state = ratatui::widgets::ListState::default();
    state.select(app.selected_reserve);

    frame.render_stateful_widget(list, area, &mut state);
}

/// Renders the deposit screen.
fn render_deposit<B: Backend>(frame: &mut Frame<B>, _app: &App, area: Rect) {
    let text = vec![
        Spans::from(vec![Span::styled(
            "Deposit",
            Style::default().fg(Color::Green).add_modifier(Modifier::BOLD),
        )]),
        Spans::from(vec![Span::raw("")]),
        Spans::from(vec![Span::raw(
            "Deposit your tokens to earn interest.",
        )]),
    ];

    let paragraph = Paragraph::new(text)
        .block(Block::default().borders(Borders::ALL).title("Deposit"))
        .style(Style::default().fg(Color::White))
        .alignment(ratatui::layout::Alignment::Left)
        .wrap(Wrap { trim: true });

    frame.render_widget(paragraph, area);
}

/// Renders the withdraw screen.
fn render_withdraw<B: Backend>(frame: &mut Frame<B>, _app: &App, area: Rect) {
    let text = vec![
        Spans::from(vec![Span::styled(
            "Withdraw",
            Style::default().fg(Color::Green).add_modifier(Modifier::BOLD),
        )]),
        Spans::from(vec![Span::raw("")]),
        Spans::from(vec![Span::raw(
            "Withdraw your deposited tokens.",
        )]),
    ];

    let paragraph = Paragraph::new(text)
        .block(Block::default().borders(Borders::ALL).title("Withdraw"))
        .style(Style::default().fg(Color::White))
        .alignment(ratatui::layout::Alignment::Left)
        .wrap(Wrap { trim: true });

    frame.render_widget(paragraph, area);
}

/// Renders the borrow screen.
fn render_borrow<B: Backend>(frame: &mut Frame<B>, _app: &App, area: Rect) {
    let text = vec![
        Spans::from(vec![Span::styled(
            "Borrow",
            Style::default().fg(Color::Green).add_modifier(Modifier::BOLD),
        )]),
        Spans::from(vec![Span::raw("")]),
        Spans::from(vec![Span::raw(
            "Borrow tokens against your collateral.",
        )]),
    ];

    let paragraph = Paragraph::new(text)
        .block(Block::default().borders(Borders::ALL).title("Borrow"))
        .style(Style::default().fg(Color::White))
        .alignment(ratatui::layout::Alignment::Left)
        .wrap(Wrap { trim: true });

    frame.render_widget(paragraph, area);
}

/// Renders the repay screen.
fn render_repay<B: Backend>(frame: &mut Frame<B>, _app: &App, area: Rect) {
    let text = vec![
        Spans::from(vec![Span::styled(
            "Repay",
            Style::default().fg(Color::Green).add_modifier(Modifier::BOLD),
        )]),
        Spans::from(vec![Span::raw("")]),
        Spans::from(vec![Span::raw(
            "Repay your borrowed tokens.",
        )]),
    ];

    let paragraph = Paragraph::new(text)
        .block(Block::default().borders(Borders::ALL).title("Repay"))
        .style(Style::default().fg(Color::White))
        .alignment(ratatui::layout::Alignment::Left)
        .wrap(Wrap { trim: true });

    frame.render_widget(paragraph, area);
}

/// Renders the liquidate screen.
fn render_liquidate<B: Backend>(frame: &mut Frame<B>, _app: &App, area: Rect) {
    let text = vec![
        Spans::from(vec![Span::styled(
            "Liquidate",
            Style::default().fg(Color::Green).add_modifier(Modifier::BOLD),
        )]),
        Spans::from(vec![Span::raw("")]),
        Spans::from(vec![Span::raw(
            "Liquidate under-collateralized positions.",
        )]),
    ];

    let paragraph = Paragraph::new(text)
        .block(Block::default().borders(Borders::ALL).title("Liquidate"))
        .style(Style::default().fg(Color::White))
        .alignment(ratatui::layout::Alignment::Left)
        .wrap(Wrap { trim: true });

    frame.render_widget(paragraph, area);
}

/// Renders the flash loan screen.
fn render_flash_loan<B: Backend>(frame: &mut Frame<B>, _app: &App, area: Rect) {
    let text = vec![
        Spans::from(vec![Span::styled(
            "Flash Loan",
            Style::default().fg(Color::Green).add_modifier(Modifier::BOLD),
        )]),
        Spans::from(vec![Span::raw("")]),
        Spans::from(vec![Span::raw(
            "Execute flash loans.",
        )]),
    ];

    let paragraph = Paragraph::new(text)
        .block(Block::default().borders(Borders::ALL).title("Flash Loan"))
        .style(Style::default().fg(Color::White))
        .alignment(ratatui::layout::Alignment::Left)
        .wrap(Wrap { trim: true });

    frame.render_widget(paragraph, area);
}

/// Renders the settings screen.
fn render_settings<B: Backend>(frame: &mut Frame<B>, _app: &App, area: Rect) {
    let text = vec![
        Spans::from(vec![Span::styled(
            "Settings",
            Style::default().fg(Color::Green).add_modifier(Modifier::BOLD),
        )]),
        Spans::from(vec![Span::raw("")]),
        Spans::from(vec![Span::raw(
            "Configure application settings.",
        )]),
    ];

    let paragraph = Paragraph::new(text)
        .block(Block::default().borders(Borders::ALL).title("Settings"))
        .style(Style::default().fg(Color::White))
        .alignment(ratatui::layout::Alignment::Left)
        .wrap(Wrap { trim: true });

    frame.render_widget(paragraph, area);
}

/// Renders the message log.
fn render_message_log<B: Backend>(frame: &mut Frame<B>, app: &App, area: Rect) {
    let messages: Vec<ListItem> = app
        .messages
        .iter()
        .rev() // Show most recent messages first
        .take(4) // Only show the last 4 messages
        .map(|m| {
            ListItem::new(Spans::from(vec![Span::styled(
                m,
                Style::default().fg(Color::White),
            )]))
        })
        .collect();

    let messages_list = List::new(messages)
        .block(Block::default().borders(Borders::ALL).title("Messages"))
        .style(Style::default().fg(Color::White));

    frame.render_widget(messages_list, area);
}

/// Renders an input field.
fn render_input_field<B: Backend>(frame: &mut Frame<B>, input: &InputState, area: Rect) {
    let input_text = input.value();
    let cursor_position = input.input.visual_cursor();

    let input_paragraph = Paragraph::new(input_text)
        .style(Style::default().fg(if input.active { Color::Yellow } else { Color::White }))
        .block(Block::default().borders(Borders::ALL).title(input.label.clone()));

    frame.render_widget(input_paragraph, area);

    if input.active {
        // Make the cursor visible and ask ratatui to put it at the specified coordinates after rendering
        frame.set_cursor(
            // Put cursor past the end of the input text
            area.x + cursor_position as u16 + 1,
            // Move one line down, from the border to the input line
            area.y + 1,
        );
    }
}

/// Renders the help screen.
fn render_help<B: Backend>(frame: &mut Frame<B>, app: &App, area: Rect) {
    let mut text = vec![
        Spans::from(vec![Span::styled(
            "Help",
            Style::default().fg(Color::Green).add_modifier(Modifier::BOLD),
        )]),
        Spans::from(vec![Span::raw("")]),
        Spans::from(vec![Span::raw(
            "Keyboard shortcuts:",
        )]),
        Spans::from(vec![Span::raw("")]),
    ];

    for (key, description) in &app.help {
        text.push(Spans::from(vec![
            Span::styled(
                format!("{:<5}", key),
                Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD),
            ),
            Span::raw(format!("- {}", description)),
        ]));
    }

    let paragraph = Paragraph::new(text)
        .block(Block::default().borders(Borders::ALL).title("Help"))
        .style(Style::default().fg(Color::White))
        .alignment(ratatui::layout::Alignment::Left)
        .wrap(Wrap { trim: true });

    frame.render_widget(paragraph, area);
}

/// Renders the status bar.
fn render_status_bar<B: Backend>(frame: &mut Frame<B>, app: &App, area: Rect) {
    let current_state = format!("Current State: {:?}", app.state);
    
    let selected_market = if let Some(index) = app.selected_market {
        format!("Selected Market: {}", app.markets[index])
    } else {
        "No Market Selected".to_string()
    };
    
    let selected_reserve = if let Some(index) = app.selected_reserve {
        format!("Selected Reserve: {}", app.reserves[index])
    } else {
        "No Reserve Selected".to_string()
    };
    
    let status = format!("{} | {} | {}", current_state, selected_market, selected_reserve);
    
    let paragraph = Paragraph::new(status)
        .block(Block::default().borders(Borders::ALL).title("Status"))
        .style(Style::default().fg(Color::White))
        .alignment(ratatui::layout::Alignment::Left)
        .wrap(Wrap { trim: true });

    frame.render_widget(paragraph, area);
}